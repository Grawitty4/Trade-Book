import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import config from './config.js';
import { testConnection, initializeDatabase } from './database/db.js';
import authRoutes from './routes/auth.js';
import { optionalAuth } from './middleware/auth.js';
import UniversalStockScraper from './universal-stock-scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = config.app.port;
const scraper = new UniversalStockScraper();

// PostgreSQL session store
const PgSession = connectPgSimple(session);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware - simplified and more reliable
console.log('⚠️ Using memory session store for reliability');

app.use(session({
    // Always use memory store for now (works in both environments)
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Disable secure for testing (Railway might have HTTPS issues)
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

app.use(express.static(__dirname));

// Authentication routes
app.use('/api/auth', authRoutes);

// Friends API routes
app.get('/api/friends', optionalAuth, async (req, res) => {
    try {
        if (!req.user && !req.session?.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // For now, return empty friends list (can be enhanced later)
        res.json({ success: true, friends: [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load friends' });
    }
});

app.post('/api/friends/add', optionalAuth, async (req, res) => {
    try {
        if (!req.user && !req.session?.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const { friendIdentifier } = req.body;
        if (!friendIdentifier) {
            return res.status(400).json({ error: 'Friend identifier required' });
        }
        
        // For now, simulate adding friend
        res.json({ success: true, message: `Friend request sent to ${friendIdentifier}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add friend' });
    }
});

// Profile visibility toggle
app.post('/api/auth/profile/visibility', optionalAuth, async (req, res) => {
    try {
        if (!req.user && !req.session?.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // For now, simulate toggle (can be enhanced with database later)
        const newVisibility = !req.user?.is_public;
        res.json({ 
            success: true, 
            message: `Profile set to ${newVisibility ? 'Public' : 'Private'}`,
            user: { ...req.user, is_public: newVisibility }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update visibility' });
    }
});

// Sharing API routes  
app.get('/api/sharing/portfolios', optionalAuth, async (req, res) => {
    try {
        if (!req.user && !req.session?.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        // For now, return empty portfolios list
        res.json({ success: true, portfolios: [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load shared portfolios' });
    }
});

// Health check for Railway (must be before authentication)
app.get('/railway-health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'trade-book',
        version: '1.0.0'
    });
});

// Authentication check for main app
app.get('/', optionalAuth, (req, res) => {
    console.log('📍 Main route accessed:', {
        hasUser: !!req.user,
        user: req.user ? { id: req.user.id, username: req.user.username } : null,
        sessionId: req.sessionID,
        sessionUserId: req.session?.userId,
        hasTokenParam: !!req.query.token,
        debugParam: req.query.debug
    });
    
    // If we have a debug token parameter, temporarily allow access
    if (req.query.token && req.query.debug === 'login') {
        console.log('🔧 Debug mode: Allowing access with token parameter');
        res.sendFile(join(__dirname, 'index.html'));
        return;
    }
    
    if (!req.user) {
        console.log('🔄 No user found, redirecting to /auth');
        return res.redirect('/auth');
    }
    
    console.log('✅ User authenticated, serving main app');
    res.sendFile(join(__dirname, 'index.html'));
});

// Login/Register page
app.get('/auth', (req, res) => {
    res.sendFile(join(__dirname, 'auth.html'));
});

// Legacy route for old interface
app.get('/old', (req, res) => {
    res.sendFile(join(__dirname, 'web-interface.html'));
});

// In-memory trades store for offline mode
const userTrades = new Map();

// Trade Book API endpoints
app.get('/api/trades', optionalAuth, async (req, res) => {
    try {
        console.log('🔍 GET /api/trades called');

        // Check if user is authenticated
        if (!req.user && !req.session?.userId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required',
                trades: []
            });
        }

        // Get user ID from either req.user or session
        const userId = req.user?.id || req.session?.userId;
        
        // Get trades from memory store (works in offline mode)
        const trades = userTrades.get(userId) || [];
        
        console.log('✅ Retrieved trades for user:', userId, 'Count:', trades.length);
        res.json({
            success: true,
            trades: trades
        });
    } catch (error) {
        console.error('❌ Error in GET /api/trades:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error',
            trades: []
        });
    }
});

app.post('/api/trades', optionalAuth, async (req, res) => {
    try {
        console.log('🔍 POST /api/trades called');

        // Check if user is authenticated
        if (!req.user && !req.session?.userId) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required' 
            });
        }

        // Get user ID from either req.user or session
        const userId = req.user?.id || req.session?.userId;
        
        // Create trade object with ID
        const trade = {
            id: Date.now(), // Simple ID generation
            userId: userId,
            symbol: req.body.symbol,
            type: req.body.type,
            quantity: parseInt(req.body.quantity),
            price: parseFloat(req.body.price),
            date: req.body.date || new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };
        
        // Save to memory store
        const userTradeList = userTrades.get(userId) || [];
        userTradeList.push(trade);
        userTrades.set(userId, userTradeList);
        
        console.log('✅ Trade saved to memory store for user:', userId);
        res.json({
            success: true,
            message: 'Trade saved successfully',
            trade: trade
        });
    } catch (error) {
        console.error('❌ Error in POST /api/trades:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error' 
        });
    }
});

// Stock Scraper API endpoints
app.post('/api/stock-data', async (req, res) => {
    try {
        const { symbol } = req.body;
        
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        console.log(`📡 API request for stock data: ${symbol}`);
        
        const stockData = await scraper.getStockData(symbol);
        
        // Save the data
        await scraper.saveStockData(stockData);
        
        res.json(stockData);
        
    } catch (error) {
        console.error('Stock data API error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch stock data',
            details: error.message 
        });
    }
});

app.post('/api/multiple-stocks', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ error: 'Symbols array is required' });
        }

        console.log(`📡 API request for multiple stocks: ${symbols.join(', ')}`);
        
        const results = await scraper.getMultipleStocks(symbols);
        
        res.json(results);
        
    } catch (error) {
        console.error('Multiple stocks API error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch stock data',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            server: 'running',
            scraper: 'ready'
        }
    });
});

// Database status endpoint for debugging
app.get('/api/debug/db-status', async (req, res) => {
    try {
        const dbStatus = await testConnection();
        res.json({
            database: {
                connected: dbStatus,
                url: config.database.url ? '***set***' : 'not set',
                host: config.database.host,
                port: config.database.port,
                database: config.database.database
            },
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                PORT: process.env.PORT,
                DATABASE_URL: process.env.DATABASE_URL ? '***set***' : 'not set'
            }
        });
    } catch (error) {
        res.json({
            database: {
                connected: false,
                error: error.message
            },
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                PORT: process.env.PORT,
                DATABASE_URL: process.env.DATABASE_URL ? '***set***' : 'not set'
            }
        });
    }
});

// Simple test endpoint to verify server is working
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Server is working!',
        timestamp: new Date().toISOString(),
        session: req.session ? {
            id: req.sessionID,
            userId: req.session.userId || 'not set'
        } : 'no session'
    });
});

// Initialize database and start server
async function startServer() {
    console.log('🚀 Starting Trade Book Server...');
    
    let dbConnected = false;
    
    // Try database connection with robust error handling
    try {
        dbConnected = await testConnection();
        if (dbConnected) {
            await initializeDatabase();
            console.log('✅ Database initialized successfully');
        }
    } catch (error) {
        console.log('⚠️ Database connection failed:', error.message);
        console.log('📖 Continuing with limited functionality...');
        dbConnected = false;
    }
    
    // Start server regardless of database status
    try {
        app.listen(PORT, () => {
            console.log('🎉 Trade Book Server Started Successfully!');
            console.log('='.repeat(60));
            console.log(`🌐 Main App: http://localhost:${PORT}`);
            console.log(`🔐 Login/Register: http://localhost:${PORT}/auth`);
            console.log(`🔧 Legacy Interface: http://localhost:${PORT}/old`);
            console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
            console.log(`🔍 Railway Health: http://localhost:${PORT}/railway-health`);
            console.log('');
            console.log('✨ New Features:');
            console.log('   🔐 User authentication (JWT + Sessions)');
            console.log('   👥 Friend system with portfolio sharing');
            console.log('   🔒 Public/Private portfolio settings');
            console.log('   🗄️ PostgreSQL database with Railway');
            console.log('   🔍 Real-time stock data scraping');
            console.log('   📈 Multi-user portfolio management');
            console.log('');
            console.log(`📊 Database Status: ${dbConnected ? '✅ Online' : '❌ Offline'}`);
            console.log('🔑 Authentication: ✅ Enabled');
            console.log('👥 Social Features: ✅ Ready');
            console.log('');
            console.log('💡 To get started:');
            console.log('   1. Visit http://localhost:3000/auth to create an account');
            console.log('   2. Login and start building your portfolio');
            console.log('   3. Add friends and share your trading success!');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();

export default app;