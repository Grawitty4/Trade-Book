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

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = rawAllowedOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

// CORS: reflect request origin so Netlify/any frontend works. Do not send
// Access-Control-Allow-Credentials (we use JWT in header, not cookies) so
// preflight never hits the "*" + credentials rejection.
function corsMiddleware(req, res, next) {
    const requestOrigin = req.headers.origin;
    const hasAllowList = allowedOrigins.length > 0;
    const isAllowedOrigin = hasAllowList && requestOrigin && allowedOrigins.includes(requestOrigin);
    const allowOrigin = requestOrigin && (isAllowedOrigin || !hasAllowList)
        ? requestOrigin
        : '*';
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
}
app.use(corsMiddleware);

// Middleware
app.use(express.json());
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

// Resolve user by id from DB or memory (for JWT auth)
async function resolveUserById(userId) {
    if (dbAvailable && pool) {
        try {
            const result = await pool.query(
                'SELECT id, username, email, full_name, is_public FROM cursor_trade_book.users WHERE id = $1',
                [userId]
            );
            if (result.rows.length > 0) {
                return result.rows[0];
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
            is_public: mem.is_public || false
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
        const { identifier, password } = req.body;
        
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Username/email and password are required' });
        }

        let user = null;

        if (dbAvailable && pool) {
            // Try database first
            try {
                const result = await pool.query(
                    'SELECT id, username, email, full_name, is_public, password_hash FROM cursor_trade_book.users WHERE username = $1 OR email = $1',
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
                        is_public: dbUser.is_public
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
                            user = { id, username: userData.username, email: userData.email, full_name: userData.full_name, is_public: userData.is_public || false };
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
        const { username, email, password, fullName } = req.body;
        
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
                    'INSERT INTO cursor_trade_book.users (username, email, password_hash, full_name, is_public) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, full_name, is_public',
                    [username, email || `${username}@tradebook.com`, hashedPassword, fullName || username, false]
                );
                user = result.rows[0];
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
                created_at: new Date().toISOString()
            };
            users.set(userId, userData);
            user = { id: userId, username: userData.username, email: userData.email, full_name: userData.full_name, is_public: false };
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
                    'SELECT id, symbol, type, quantity, price, date, created_at FROM cursor_trade_book.trades WHERE user_id = $1 ORDER BY created_at DESC',
                    [req.user.id]
                );
                trades = result.rows;
            } catch (dbError) {
                console.log('Database error getting trades, using memory:', dbError.message);
                dbAvailable = false;
            }
        }

        if (!dbAvailable) {
            trades = userTrades.get(req.user.id) || [];
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

// Add trade
app.post('/api/trades', requireAuth, async (req, res) => {
    try {
        const trade = {
            id: Date.now(),
            userId: req.user.id,
            symbol: req.body.symbol,
            type: req.body.type,
            quantity: parseInt(req.body.quantity),
            price: parseFloat(req.body.price),
            date: req.body.date || new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };

        if (dbAvailable && pool) {
            try {
                const result = await pool.query(
                    'INSERT INTO cursor_trade_book.trades (user_id, symbol, type, quantity, price, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, symbol, type, quantity, price, date, created_at',
                    [req.user.id, trade.symbol, trade.type, trade.quantity, trade.price, trade.date]
                );
                const dbTrade = result.rows[0];
                trade.id = dbTrade.id;
                trade.created_at = dbTrade.created_at;
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

        res.json({
            success: true,
            message: 'Trade saved successfully',
            trade: trade
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
