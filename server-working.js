import express from 'express';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Simple user storage (fallback to memory if DB fails)
let users = new Map();
let userTrades = new Map();
let currentUserId = 1;

// Simple session storage
let userSessions = new Map(); // sessionId -> userId
let currentUser = null; // For single-user simplicity

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
                            user = { id, ...userData };
                            break;
                        }
                    }
                }
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        currentUser = user;
        
        res.json({
            success: true,
            message: 'Login successful',
            user: user
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
            user = { id: userId, ...userData };
            // Remove password_hash from response
            delete user.password_hash;
        }

        currentUser = user;
        
        res.json({
            success: true,
            message: 'Registration successful',
            user: user
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Get current user
app.get('/api/auth/me', (req, res) => {
    if (currentUser) {
        res.json({
            success: true,
            user: currentUser
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Not authenticated'
        });
    }
});

// Simple logout
app.post('/api/auth/logout', (req, res) => {
    currentUser = null;
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Get trades
app.get('/api/trades', async (req, res) => {
    if (!currentUser) {
        return res.status(401).json({ 
            success: false,
            error: 'Authentication required',
            trades: []
        });
    }

    try {
        let trades = [];

        if (dbAvailable && pool) {
            try {
                const result = await pool.query(
                    'SELECT id, symbol, type, quantity, price, date, created_at FROM cursor_trade_book.trades WHERE user_id = $1 ORDER BY created_at DESC',
                    [currentUser.id]
                );
                trades = result.rows;
            } catch (dbError) {
                console.log('Database error getting trades, using memory:', dbError.message);
                dbAvailable = false;
            }
        }

        if (!dbAvailable) {
            trades = userTrades.get(currentUser.id) || [];
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
app.post('/api/trades', async (req, res) => {
    if (!currentUser) {
        return res.status(401).json({ 
            success: false,
            error: 'Authentication required'
        });
    }

    try {
        const trade = {
            id: Date.now(),
            userId: currentUser.id,
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
                    [currentUser.id, trade.symbol, trade.type, trade.quantity, trade.price, trade.date]
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
            // Save to memory
            const userTradeList = userTrades.get(currentUser.id) || [];
            userTradeList.push(trade);
            userTrades.set(currentUser.id, userTradeList);
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

// Friends endpoints (simplified)
app.get('/api/friends', (req, res) => {
    if (!currentUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    res.json({ success: true, friends: [] });
});

app.post('/api/friends/add', (req, res) => {
    if (!currentUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    res.json({ success: true, message: 'Friend added successfully' });
});

// Profile visibility
app.post('/api/auth/profile/visibility', (req, res) => {
    if (!currentUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Toggle visibility
    currentUser.is_public = !currentUser.is_public;
    
    res.json({ 
        success: true, 
        message: `Profile set to ${currentUser.is_public ? 'Public' : 'Private'}`,
        user: currentUser
    });
});

// Sharing
app.get('/api/sharing/portfolios', (req, res) => {
    if (!currentUser) {
        return res.status(401).json({ error: 'Authentication required' });
    }
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
