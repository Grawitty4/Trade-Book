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

// Session middleware
app.use(session({
    store: new PgSession({
        conString: config.database.url,
        tableName: 'session',
        schemaName: 'cursor_trade_book'
    }),
    secret: config.auth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.app.nodeEnv === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

app.use(express.static(__dirname));

// Authentication routes
app.use('/api/auth', authRoutes);

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
        sessionUserId: req.session?.userId
    });
    
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

// Trade Book API endpoints
app.get('/api/trades', async (req, res) => {
    try {
        const data = await fs.readFile('trade-data.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(404).json({ error: 'No trade data found' });
    }
});

app.post('/api/trades', async (req, res) => {
    try {
        const data = req.body;
        await fs.writeFile('trade-data.json', JSON.stringify(data, null, 2));
        res.json({ success: true, message: 'Data saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save data' });
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