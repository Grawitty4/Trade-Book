import express from 'express';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'trade-book-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

// CORS: always reflect the request origin when present so any frontend (e.g. trade-logs.netlify.app) is allowed.
// Do not send Access-Control-Allow-Credentials so preflight is never rejected.
function corsMiddleware(req, res, next) {
    const requestOrigin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
}
app.use(corsMiddleware);

// Middleware: parse JSON and text/plain (text/plain avoids CORS preflight from frontend)
app.use(express.json());
app.use(express.text({ type: 'text/plain' }));
app.use(express.static(__dirname));

// Simple user storage (fallback to memory if DB fails)
let users = new Map();
let userTrades = new Map();
let currentUserId = 1;

console.log('🚀 Starting Working Trade Book Server...');

// Try to connect to database, but don't fail if it doesn't work
let dbAvailable = false;
let pool = null;

async function initDatabase() {
    try {
        const { Pool } = await import('pg');
        
        // Use Railway database URL or fallback to local
        const connectionString = process.env.DATABASE_URL || 
            'postgresql://postgres:password@containers-us-west-1.railway.app:5432/railway';
        
        pool = new Pool({
            connectionString: connectionString,
            ssl: connectionString.includes('railway.app') ? { rejectUnauthorized: false } : false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
        
        // Test the connection
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        
        // Make sure our schema and tables exist
        await client.query(`
            CREATE SCHEMA IF NOT EXISTS cursor_trade_book;
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS cursor_trade_book.users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                is_public BOOLEAN DEFAULT false,
                profile_picture TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS cursor_trade_book.trades (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES cursor_trade_book.users(id) ON DELETE CASCADE,
                symbol VARCHAR(50) NOT NULL,
                type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                price DECIMAL(10,2) NOT NULL CHECK (price > 0),
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            ALTER TABLE cursor_trade_book.users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
        `);
        await client.query(`
            ALTER TABLE cursor_trade_book.trades ADD COLUMN IF NOT EXISTS market_index VARCHAR(10);
        `);
        await client.query(`
            ALTER TABLE cursor_trade_book.trades ADD COLUMN IF NOT EXISTS trade_type VARCHAR(20);
        `);
        await client.query(`
            ALTER TABLE cursor_trade_book.trades ADD COLUMN IF NOT EXISTS reason TEXT;
        `);
        await client.query(`
            ALTER TABLE cursor_trade_book.trades ADD COLUMN IF NOT EXISTS expiry DATE;
        `);
        await client.query(`
            ALTER TABLE cursor_trade_book.trades ADD COLUMN IF NOT EXISTS strike_price DECIMAL(10,2);
        `);
        await client.query(`
            ALTER TABLE cursor_trade_book.trades ADD COLUMN IF NOT EXISTS trade_month VARCHAR(7);
        `);
        await client.query(`
            UPDATE cursor_trade_book.trades SET trade_month = TO_CHAR(date, 'YYYY-MM') WHERE trade_month IS NULL OR trade_month = '';
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS cursor_trade_book.holdings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES cursor_trade_book.users(id) ON DELETE CASCADE,
                symbol VARCHAR(50) NOT NULL,
                avg_buy_price DECIMAL(12,2),
                avg_buy_qty DECIMAL(14,2) DEFAULT 0,
                avg_sell_price DECIMAL(12,2),
                avg_sell_qty DECIMAL(14,2) DEFAULT 0,
                additional_detail JSONB DEFAULT '[]',
                current_price DECIMAL(12,2),
                invested_value DECIMAL(14,2),
                current_value DECIMAL(14,2),
                net_change_pct DECIMAL(8,2),
                UNIQUE(user_id, symbol)
            );
        `);
        
        client.release();
        dbAvailable = true;
        console.log('✅ Database schema initialized');
    } catch (error) {
        console.log('⚠️ Database not available, using memory storage:', error.message);
        dbAvailable = false;
    }
}

// Initialize database connection
initDatabase();

// Refresh holdings from cash trades for a user (DB only)
async function refreshHoldingsForUser(userId) {
    if (!dbAvailable || !pool) return;
    try {
        const cashTrades = await pool.query(
            `SELECT id, symbol, type, quantity, price, date
             FROM cursor_trade_book.trades
             WHERE user_id = $1 AND LOWER(COALESCE(trade_type, '')) = 'cash'
             ORDER BY date ASC, id ASC`,
            [userId]
        );
        const bySymbol = new Map();
        for (const row of cashTrades.rows) {
            const sym = (row.symbol || '').trim() || '?';
            if (!bySymbol.has(sym)) {
                bySymbol.set(sym, {
                    buyQty: 0,
                    buyValue: 0,
                    sellQty: 0,
                    sellValue: 0,
                    details: []
                });
            }
            const rec = bySymbol.get(sym);
            const qty = Number(row.quantity) || 0;
            const price = Number(row.price) || 0;
            const dateStr = row.date ? String(row.date).slice(0, 10) : '';
            rec.details.push({
                transactiontype: (row.type || '').toLowerCase() === 'sell' ? 'sell' : 'buy',
                date: dateStr,
                qty,
                price
            });
            if ((row.type || '').toLowerCase() === 'sell') {
                rec.sellQty += qty;
                rec.sellValue += qty * price;
            } else {
                rec.buyQty += qty;
                rec.buyValue += qty * price;
            }
        }
        for (const [symbol, rec] of bySymbol.entries()) {
            const avgBuyPrice = rec.buyQty > 0 ? rec.buyValue / rec.buyQty : null;
            const avgSellPrice = rec.sellQty > 0 ? rec.sellValue / rec.sellQty : null;
            const currentQty = rec.buyQty - rec.sellQty;
            const investedValue = currentQty > 0 && avgBuyPrice != null ? currentQty * avgBuyPrice : null;
            const existing = await pool.query(
                'SELECT current_price FROM cursor_trade_book.holdings WHERE user_id = $1 AND symbol = $2',
                [userId, symbol]
            );
            const currentPrice = existing.rows[0]?.current_price ?? null;
            const effectivePrice = currentPrice != null ? currentPrice : avgBuyPrice;
            const currentValue = currentQty > 0 && effectivePrice != null ? currentQty * effectivePrice : null;
            const netChangePct = investedValue != null && investedValue > 0 && currentValue != null && currentPrice != null
                ? ((currentValue - investedValue) / investedValue) * 100
                : null;
            await pool.query(
                `INSERT INTO cursor_trade_book.holdings
                 (user_id, symbol, avg_buy_price, avg_buy_qty, avg_sell_price, avg_sell_qty, additional_detail, current_price, invested_value, current_value, net_change_pct)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (user_id, symbol) DO UPDATE SET
                   avg_buy_price = EXCLUDED.avg_buy_price,
                   avg_buy_qty = EXCLUDED.avg_buy_qty,
                   avg_sell_price = EXCLUDED.avg_sell_price,
                   avg_sell_qty = EXCLUDED.avg_sell_qty,
                   additional_detail = EXCLUDED.additional_detail,
                   current_price = COALESCE(EXCLUDED.current_price, cursor_trade_book.holdings.current_price),
                   invested_value = EXCLUDED.invested_value,
                   current_value = EXCLUDED.current_value,
                   net_change_pct = EXCLUDED.net_change_pct`,
                [userId, symbol, avgBuyPrice, rec.buyQty, avgSellPrice, rec.sellQty, JSON.stringify(rec.details), currentPrice, investedValue, currentValue, netChangePct]
            );
        }
        // Remove holdings for symbols that have no cash trades left (all sold)
        const symbols = [...bySymbol.keys()];
        if (symbols.length > 0) {
            await pool.query(
                'DELETE FROM cursor_trade_book.holdings WHERE user_id = $1 AND symbol != ALL($2)',
                [userId, symbols]
            );
        } else {
            await pool.query('DELETE FROM cursor_trade_book.holdings WHERE user_id = $1', [userId]);
        }
    } catch (err) {
        console.error('refreshHoldingsForUser error:', err);
    }
}

// Resolve user by id from DB or memory (for JWT auth)
async function resolveUserById(userId) {
    if (dbAvailable && pool) {
        try {
            const result = await pool.query(
                'SELECT id, username, email, full_name, is_public, phone_number FROM cursor_trade_book.users WHERE id = $1',
                [userId]
            );
            if (result.rows.length > 0) {
                const row = result.rows[0];
                return { id: row.id, username: row.username, email: row.email, full_name: row.full_name, is_public: row.is_public, phone_number: row.phone_number || null };
            }
        } catch (e) {
            // fall through to memory
        }
    }
    const mem = users.get(Number(userId));
    if (mem) {
        return {
            id: Number(userId),
            username: mem.username,
            email: mem.email,
            full_name: mem.full_name,
            is_public: mem.is_public || false,
            phone_number: mem.phone_number || null
        };
    }
    return null;
}

// JWT auth middleware: sets req.user or 401
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await resolveUserById(decoded.id);
        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            server: 'running',
            database: dbAvailable ? 'connected' : 'offline',
            storage: dbAvailable ? 'postgresql' : 'memory'
        }
    });
});

// Railway health check
app.get('/railway-health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'trade-book-working'
    });
});

// Login endpoint - requires password
app.post('/api/auth/login', async (req, res) => {
    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
        }
        body = body || {};
        const { identifier, password } = body;
        
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Username/email and password are required' });
        }

        let user = null;

        if (dbAvailable && pool) {
            // Try database first
            try {
                const result = await pool.query(
                    'SELECT id, username, email, full_name, is_public, phone_number, password_hash FROM cursor_trade_book.users WHERE username = $1 OR email = $1',
                    [identifier]
                );
                
                if (result.rows.length > 0) {
                    const dbUser = result.rows[0];
                    
                    // Verify password (required)
                    const validPassword = await bcrypt.compare(password, dbUser.password_hash);
                    if (!validPassword) {
                        return res.status(401).json({ error: 'Invalid credentials' });
                    }
                    
                    user = {
                        id: dbUser.id,
                        username: dbUser.username,
                        email: dbUser.email,
                        full_name: dbUser.full_name,
                        is_public: dbUser.is_public,
                        phone_number: dbUser.phone_number || null
                    };
                } else {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
            } catch (dbError) {
                console.log('Database error during auth, falling back to memory:', dbError.message);
                dbAvailable = false;
            }
        }

        if (!user) {
            // Check memory storage
            for (const [id, userData] of users) {
                if (userData.username === identifier || userData.email === identifier) {
                    // Verify password for memory users too
                    if (userData.password_hash) {
                        const validPassword = await bcrypt.compare(password, userData.password_hash);
                        if (validPassword) {
                            user = { id, username: userData.username, email: userData.email, full_name: userData.full_name, is_public: userData.is_public || false, phone_number: userData.phone_number || null };
                            break;
                        }
                    }
                }
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({
            success: true,
            message: 'Login successful',
            user,
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register endpoint (for compatibility)
app.post('/api/auth/register', async (req, res) => {
    try {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
        }
        body = body || {};
        const { username, email, password, fullName } = body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        let user = null;

        if (dbAvailable && pool) {
            try {
                // Check if user exists
                const checkResult = await pool.query(
                    'SELECT id FROM cursor_trade_book.users WHERE username = $1 OR email = $2',
                    [username, email || `${username}@tradebook.com`]
                );
                
                if (checkResult.rows.length > 0) {
                    return res.status(400).json({ error: 'User already exists' });
                }

                const hashedPassword = await bcrypt.hash(password, 10);
                const result = await pool.query(
                    'INSERT INTO cursor_trade_book.users (username, email, password_hash, full_name, is_public, phone_number) VALUES ($1, $2, $3, $4, $5, NULL) RETURNING id, username, email, full_name, is_public, phone_number',
                    [username, email || `${username}@tradebook.com`, hashedPassword, fullName || username, false]
                );
                const row = result.rows[0];
                user = { id: row.id, username: row.username, email: row.email, full_name: row.full_name, is_public: row.is_public, phone_number: row.phone_number || null };
            } catch (dbError) {
                console.log('Database error during register, falling back to memory:', dbError.message);
                dbAvailable = false;
            }
        }

        if (!user) {
            // Check memory storage
            for (const [id, userData] of users) {
                if (userData.username === username || userData.email === (email || `${username}@tradebook.com`)) {
                    return res.status(400).json({ error: 'User already exists' });
                }
            }

            // Create in memory with hashed password
            const userId = currentUserId++;
            const hashedPassword = await bcrypt.hash(password, 10);
            const userData = {
                username,
                email: email || `${username}@tradebook.com`,
                password_hash: hashedPassword,
                full_name: fullName || username,
                is_public: false,
                phone_number: null,
                created_at: new Date().toISOString()
            };
            users.set(userId, userData);
            user = { id: userId, username: userData.username, email: userData.email, full_name: userData.full_name, is_public: false, phone_number: null };
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({
            success: true,
            message: 'Registration successful',
            user,
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Get current user (JWT required)
app.get('/api/auth/me', requireAuth, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Get full profile (same as me; for profile page)
app.get('/api/auth/profile', requireAuth, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Update profile (email, full_name, phone_number)
app.patch('/api/auth/profile', requireAuth, async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { email, full_name, phone_number } = body;
        const updates = [];
        const values = [];
        let idx = 1;
        if (typeof email === 'string' && email.trim()) {
            updates.push(`email = $${idx++}`);
            values.push(email.trim());
        }
        if (typeof full_name === 'string') {
            updates.push(`full_name = $${idx++}`);
            values.push(full_name.trim() || null);
        }
        if (typeof phone_number === 'string') {
            updates.push(`phone_number = $${idx++}`);
            values.push(phone_number.trim() || null);
        }
        if (updates.length === 0) {
            return res.json({ success: true, user: req.user });
        }
        values.push(req.user.id);
        if (dbAvailable && pool) {
            await pool.query(
                `UPDATE cursor_trade_book.users SET ${updates.join(', ')} WHERE id = $${idx}`,
                values
            );
        }
        const mem = users.get(req.user.id);
        if (mem) {
            if (email !== undefined && email) mem.email = email.trim();
            if (full_name !== undefined) mem.full_name = full_name ? full_name.trim() : null;
            if (phone_number !== undefined) mem.phone_number = phone_number ? phone_number.trim() : null;
        }
        const updated = await resolveUserById(req.user.id);
        res.json({ success: true, user: updated });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(400).json({ error: 'Failed to update profile' });
    }
});

// Logout (client clears token; server no-op)
app.post('/api/auth/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Get trades
app.get('/api/trades', requireAuth, async (req, res) => {
    try {
        let trades = [];

        if (dbAvailable && pool) {
            try {
                const result = await pool.query(
                    'SELECT id, symbol, type, quantity, price, date, created_at, market_index, trade_type, reason, expiry, strike_price, trade_month FROM cursor_trade_book.trades WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
                    [req.user.id]
                );
                trades = result.rows.map(r => ({
                    ...r,
                    trade_action: r.type,
                    market_index: r.market_index || null,
                    trade_type: r.trade_type || null,
                    reason: r.reason || null,
                    expiry: r.expiry || null,
                    strike_price: r.strike_price != null ? r.strike_price : null,
                    trade_month: r.trade_month || (r.date ? String(r.date).slice(0, 7) : null)
                }));
            } catch (dbError) {
                console.log('Database error getting trades, using memory:', dbError.message);
                dbAvailable = false;
            }
        }

        if (!dbAvailable) {
            const raw = userTrades.get(req.user.id) || [];
            trades = raw.map(t => ({
                ...t,
                trade_action: t.type,
                market_index: t.market_index || null,
                trade_type: t.trade_type || null,
                reason: t.reason || null,
                expiry: t.expiry || null,
                strike_price: t.strike_price != null ? t.strike_price : null,
                trade_month: t.trade_month || (t.date ? String(t.date).slice(0, 7) : null)
            }));
        }

        res.json({
            success: true,
            trades: trades
        });
    } catch (error) {
        console.error('Get trades error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get trades',
            trades: []
        });
    }
});

// Get holdings (cash summary); refresh from cash trades then return
app.get('/api/holdings', requireAuth, async (req, res) => {
    try {
        let holdings = [];
        if (dbAvailable && pool) {
            await refreshHoldingsForUser(req.user.id);
            const result = await pool.query(
                `SELECT id, user_id, symbol, avg_buy_price, avg_buy_qty, avg_sell_price, avg_sell_qty,
                        additional_detail, current_price, invested_value, current_value, net_change_pct
                 FROM cursor_trade_book.holdings WHERE user_id = $1 ORDER BY symbol`,
                [req.user.id]
            );
            holdings = result.rows.map(r => ({
                id: r.id,
                user_id: r.user_id,
                symbol: r.symbol,
                avg_buy_price: r.avg_buy_price != null ? Number(r.avg_buy_price) : null,
                avg_buy_qty: r.avg_buy_qty != null ? Number(r.avg_buy_qty) : null,
                avg_sell_price: r.avg_sell_price != null ? Number(r.avg_sell_price) : null,
                avg_sell_qty: r.avg_sell_qty != null ? Number(r.avg_sell_qty) : null,
                additional_detail: r.additional_detail || [],
                current_price: r.current_price != null ? Number(r.current_price) : null,
                invested_value: r.invested_value != null ? Number(r.invested_value) : null,
                current_value: r.current_value != null ? Number(r.current_value) : null,
                net_change_pct: r.net_change_pct != null ? Number(r.net_change_pct) : null
            }));
        }
        res.json({ success: true, holdings });
    } catch (error) {
        console.error('Get holdings error:', error);
        res.status(500).json({ success: false, error: 'Failed to get holdings', holdings: [] });
    }
});

// Add trade
app.post('/api/trades', requireAuth, async (req, res) => {
    try {
        const tradeAction = (req.body.trade_action || req.body.type || '').toLowerCase();
        const expiryVal = (req.body.expiry || '').trim() || null;
        const strikePriceVal = req.body.strike_price != null && req.body.strike_price !== '' ? parseFloat(req.body.strike_price) : null;
        const dateVal = req.body.date || new Date().toISOString().split('T')[0];
        const trade_monthVal = dateVal.length >= 7 ? dateVal.slice(0, 7) : null;
        const trade = {
            id: Date.now(),
            userId: req.user.id,
            symbol: (req.body.symbol || '').trim(),
            type: (tradeAction === 'sell' ? 'sell' : 'buy'),
            quantity: parseInt(req.body.quantity, 10),
            price: parseFloat(req.body.price),
            date: dateVal,
            market_index: (req.body.market_index || '').trim() || null,
            trade_type: (req.body.trade_type || '').trim() || null,
            reason: (req.body.reason || '').trim() || null,
            expiry: expiryVal,
            strike_price: strikePriceVal,
            trade_month: trade_monthVal,
            created_at: new Date().toISOString()
        };

        if (dbAvailable && pool) {
            try {
                const result = await pool.query(
                    'INSERT INTO cursor_trade_book.trades (user_id, symbol, type, quantity, price, date, market_index, trade_type, reason, expiry, strike_price, trade_month) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, symbol, type, quantity, price, date, created_at, market_index, trade_type, reason, expiry, strike_price, trade_month',
                    [req.user.id, trade.symbol, trade.type, trade.quantity, trade.price, trade.date, trade.market_index, trade.trade_type, trade.reason, trade.expiry, trade.strike_price, trade.trade_month]
                );
                const dbTrade = result.rows[0];
                trade.id = dbTrade.id;
                trade.created_at = dbTrade.created_at;
                trade.market_index = dbTrade.market_index;
                trade.trade_type = dbTrade.trade_type;
                trade.reason = dbTrade.reason;
                trade.expiry = dbTrade.expiry;
                trade.strike_price = dbTrade.strike_price;
                trade.trade_month = dbTrade.trade_month;
                if ((trade.trade_type || '').toLowerCase() === 'cash') {
                    refreshHoldingsForUser(req.user.id).catch(e => console.error('Refresh holdings after trade:', e));
                }
            } catch (dbError) {
                console.log('Database error saving trade, using memory:', dbError.message);
                dbAvailable = false;
            }
        }

        if (!dbAvailable) {
            const userTradeList = userTrades.get(req.user.id) || [];
            userTradeList.push(trade);
            userTrades.set(req.user.id, userTradeList);
        }

        const out = { ...trade, trade_action: trade.type };
        res.json({
            success: true,
            message: 'Trade saved successfully',
            trade: out
        });
    } catch (error) {
        console.error('Add trade error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to add trade' 
        });
    }
});

// Get all users (for friend selection dropdown)
app.get('/api/users', requireAuth, async (req, res) => {
    try {
        let userList = [];

        if (dbAvailable && pool) {
            try {
                const result = await pool.query(
                    'SELECT id, username, full_name, email FROM cursor_trade_book.users WHERE id != $1 ORDER BY username',
                    [req.user.id]
                );
                userList = result.rows;
            } catch (dbError) {
                console.log('Database error getting users, using memory:', dbError.message);
                dbAvailable = false;
            }
        }

        if (!dbAvailable) {
            for (const [id, userData] of users) {
                if (id !== req.user.id) {
                    userList.push({
                        id,
                        username: userData.username,
                        full_name: userData.full_name,
                        email: userData.email
                    });
                }
            }
        }

        res.json({ success: true, users: userList });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users', users: [] });
    }
});

// Friends endpoints (simplified)
app.get('/api/friends', requireAuth, (req, res) => {
    res.json({ success: true, friends: [] });
});

app.post('/api/friends/add', requireAuth, (req, res) => {
    res.json({ success: true, message: 'Friend added successfully' });
});

// Profile visibility (persist in DB when available)
app.post('/api/auth/profile/visibility', requireAuth, async (req, res) => {
    const isPublic = req.body.isPublic === true;
    if (dbAvailable && pool) {
        try {
            await pool.query(
                'UPDATE cursor_trade_book.users SET is_public = $1 WHERE id = $2',
                [isPublic, req.user.id]
            );
        } catch (e) {
            // ignore
        }
    } else {
        const mem = users.get(req.user.id);
        if (mem) mem.is_public = isPublic;
    }
    res.json({
        success: true,
        message: `Profile set to ${isPublic ? 'Public' : 'Private'}`,
        user: { ...req.user, is_public: isPublic }
    });
});

// Sharing
app.get('/api/sharing/portfolios', requireAuth, (req, res) => {
    res.json({ success: true, portfolios: [] });
});

// Stock data endpoint (mock)
app.post('/api/stock-data', async (req, res) => {
    const { symbol } = req.body;
    
    // Return mock data
    res.json({
        success: true,
        data: {
            symbol: symbol,
            price: Math.floor(Math.random() * 3000) + 1000,
            change: (Math.random() * 10 - 5).toFixed(2),
            volume: Math.floor(Math.random() * 1000000),
            high: Math.floor(Math.random() * 3500) + 1000,
            low: Math.floor(Math.random() * 2500) + 800,
            market_cap: '₹' + (Math.floor(Math.random() * 500000) + 100000).toLocaleString() + ' Cr',
            pe_ratio: (Math.random() * 30 + 10).toFixed(2),
            source: 'Mock Data'
        }
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

// Auth page
app.get('/auth', (req, res) => {
    res.sendFile(join(__dirname, 'auth.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('🎉 Working Trade Book Server Started Successfully!');
    console.log('============================================================');
    console.log(`🌐 Main App: http://localhost:${PORT}`);
    console.log(`🔐 Auth Page: http://localhost:${PORT}/auth`);
    console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🚀 Railway Health: http://localhost:${PORT}/railway-health`);
    console.log('✨ Features:');
    console.log('   📝 Simple but robust authentication');
    console.log('   💾 Database integration with memory fallback');
    console.log('   💼 Trade management');
    console.log('   📊 Portfolio tracking');
    console.log('   🔍 Mock stock data');
    console.log('   🚀 Railway deployment ready');
    console.log(`📊 Database Status: ${dbAvailable ? '✅ Connected' : '❌ Offline (using memory)'}`);
    console.log('💡 Use simple username login or register with password!');
    console.log('============================================================');
});
