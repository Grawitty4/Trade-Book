import express from 'express';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Simple in-memory storage
let users = new Map();
let userTrades = new Map();
let currentUserId = 1;

// Simple user session (just store username)
let currentUser = null;

console.log('🚀 Starting Simple Trade Book Server...');

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            server: 'running',
            storage: 'memory'
        }
    });
});

// Simple auth - just username
app.post('/api/auth/simple-login', (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: 'Username required' });
        }

        // Find or create user
        let user = null;
        for (const [id, userData] of users) {
            if (userData.username === username) {
                user = { id, ...userData };
                break;
            }
        }

        if (!user) {
            // Create new user
            const userId = currentUserId++;
            const userData = {
                username,
                email: `${username}@tradebook.com`,
                created_at: new Date().toISOString()
            };
            users.set(userId, userData);
            user = { id: userId, ...userData };
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
app.get('/api/trades', (req, res) => {
    if (!currentUser) {
        return res.status(401).json({ 
            success: false,
            error: 'Authentication required',
            trades: []
        });
    }

    const trades = userTrades.get(currentUser.id) || [];
    res.json({
        success: true,
        trades: trades
    });
});

// Add trade
app.post('/api/trades', (req, res) => {
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

        const userTradeList = userTrades.get(currentUser.id) || [];
        userTradeList.push(trade);
        userTrades.set(currentUser.id, userTradeList);

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
    res.json({ 
        success: true, 
        message: 'Profile visibility updated',
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
    res.sendFile(join(__dirname, 'simple-index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('🎉 Simple Trade Book Server Started Successfully!');
    console.log('============================================================');
    console.log(`🌐 Main App: http://localhost:${PORT}`);
    console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
    console.log('✨ Features:');
    console.log('   📝 Simple username-based auth');
    console.log('   💼 Trade management');
    console.log('   📊 Portfolio tracking');
    console.log('   🔍 Mock stock data');
    console.log('💡 Just enter a username to get started!');
    console.log('============================================================');
});
