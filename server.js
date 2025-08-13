import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import UniversalStockScraper from './universal-stock-scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const scraper = new UniversalStockScraper();

app.use(express.json());
app.use(express.static(__dirname));

// Serve the new two-tab interface
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
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

app.listen(PORT, () => {
    console.log('🚀 Trade Book Web Server with Stock Scraper');
    console.log('='.repeat(50));
    console.log(`📊 Main Interface: http://localhost:${PORT}`);
    console.log(`🔧 Legacy Interface: http://localhost:${PORT}/old`);
    console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('✨ Features:');
    console.log('   🔍 Real-time stock data scraping');
    console.log('   📈 Portfolio management');
    console.log('   💰 P&L calculation');
    console.log('   📊 Multi-source data fetching');
    console.log('');
    console.log('💡 The new interface includes:');
    console.log('   Tab 1: Stock Scraper (any symbol)');
    console.log('   Tab 2: Trade Book (portfolio)');
});

export default app;