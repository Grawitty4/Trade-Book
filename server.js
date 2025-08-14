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

// Authentication check for main app
app.get('/', optionalAuth, (req, res) => {
    if (!req.user) {
        // Redirect to login if not authenticated
        return res.redirect('/auth');
    }
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

// Initialize database and start server
async function startServer() {
    try {
        console.log('🚀 Starting Trade Book Server...');
        
        // Test database connection
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.log('⚠️ Database connection failed. Please check your Railway PostgreSQL configuration.');
            console.log('💡 Update config.js with your Railway database URL');
            console.log('📖 Continuing with limited functionality...');
        } else {
            // Initialize database schema
            await initializeDatabase();
        }
        
        app.listen(PORT, () => {
            console.log('🎉 Trade Book Server Started Successfully!');
            console.log('='.repeat(60));
            console.log(`🌐 Main App: http://localhost:${PORT}`);
            console.log(`🔐 Login/Register: http://localhost:${PORT}/auth`);
            console.log(`🔧 Legacy Interface: http://localhost:${PORT}/old`);
            console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
            console.log('');
            console.log('✨ New Features:');
            console.log('   🔐 User authentication (JWT + Sessions)');
            console.log('   👥 Friend system with portfolio sharing');
            console.log('   🔒 Public/Private portfolio settings');
            console.log('   🗄️ PostgreSQL database with Railway');
            console.log('   🔍 Real-time stock data scraping');
            console.log('   📈 Multi-user portfolio management');
            console.log('');
            console.log('📊 Database Status:', dbConnected ? '✅ Connected' : '❌ Offline');
            console.log('🔑 Authentication: ✅ Enabled');
            console.log('👥 Social Features: ✅ Ready');
            console.log('');
            console.log('💡 To get started:');
            console.log('   1. Visit http://localhost:3000/auth to create an account');
            console.log('   2. Login and start building your portfolio');
            console.log('   3. Add friends and share your trading success!');
        });
        
    } catch (error) {
        console.error('💥 Server startup failed:', error);
        process.exit(1);
    }
}

startServer();

export default app;