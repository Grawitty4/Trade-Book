import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'web-interface.html'));
});

// API endpoint to get trade data
app.get('/api/trades', async (req, res) => {
    try {
        const data = await fs.readFile('trade-data.json', 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(404).json({ error: 'No trade data found' });
    }
});

// API endpoint to save trade data
app.post('/api/trades', async (req, res) => {
    try {
        const data = req.body;
        await fs.writeFile('trade-data.json', JSON.stringify(data, null, 2));
        res.json({ success: true, message: 'Data saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Trade Book Web Server running on http://localhost:${PORT}`);
    console.log(`📊 Open your browser and navigate to: http://localhost:${PORT}`);
    console.log(`💡 The web interface will load your trade data automatically`);
});

export default app;
