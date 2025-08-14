# Trade Book 📊💼

A comprehensive user-based trade book with authentication, stock scraping, and portfolio management for Indian stocks.

## 🌐 Live Demo

**🚀 Live App:** [Trade Book on Railway](https://your-app-name.railway.app)
- ✅ User authentication & registration
- ✅ Real-time stock data scraping  
- ✅ Portfolio management & P&L tracking
- ✅ Social features (friends & sharing)
- ✅ PostgreSQL database with full schema

## Features ✨

- **Multi-source Equity Data Scraping**: Get real-time data from MoneyControl, Yahoo Finance, Screener.in, and NSE
- **Trade Management**: Track buy/sell trades, calculate P&L, and manage portfolio positions
- **Historical Data**: Fetch historical price data for technical analysis
- **Portfolio Analytics**: Real-time portfolio valuation and performance tracking
- **Flexible Data Sources**: Fallback mechanisms for reliable data retrieval

## Supported Data Sources 🌐

1. **MoneyControl** - Most reliable for Indian stocks
2. **Yahoo Finance** - International platform with Indian stocks
3. **Screener.in** - Fundamental analysis and financial data
4. **NSE India** - Official exchange data (requires careful handling)

## Installation 🚀

```bash
# Clone the repository
git clone https://github.com/Grawitty4/Trade-Book.git
cd TradeBook

# Install dependencies
npm install

# Or using yarn
yarn install
```

## Dependencies 📦

- `axios` - HTTP client for API requests
- `cheerio` - HTML parsing for web scraping
- `puppeteer` - Browser automation for dynamic content
- `node-cron` - Scheduled data updates
- `dotenv` - Environment variable management

## Quick Start 🏃‍♂️

### Basic Usage

```javascript
import { EquityScraper } from './src/scrapers/EquityScraper.js';
import { TradeManager } from './src/utils/TradeManager.js';

// Initialize scraper
const scraper = new EquityScraper();

// Get equity data for JIOFIN
const jiofinData = await scraper.getEquityData('JIOFIN');
console.log(`JIOFIN Price: ₹${jiofinData.price}`);

// Initialize trade manager
const tradeManager = new TradeManager();

// Add a buy trade
tradeManager.addTrade({
  symbol: 'JIOFIN',
  type: 'BUY',
  quantity: 100,
  price: 250,
  notes: 'Initial position'
});
```

### Run Demo

```bash
npm start
```

This will run a comprehensive demo showing all features.

## API Reference 📚

### EquityScraper

#### `getEquityData(symbol, source?)`
Get equity data from multiple sources with fallback.

```javascript
const data = await scraper.getEquityData('JIOFIN');
// Tries multiple sources automatically

const data = await scraper.getEquityData('JIOFIN', 'moneycontrol');
// From specific source
```

#### `getHistoricalData(symbol, days)`
Get historical price data.

```javascript
const historical = await scraper.getHistoricalData('JIOFIN', 30);
// Last 30 days of data
```

#### Available Sources
- `EQUITY_SOURCES.MONEYCONTROL`
- `EQUITY_SOURCES.YAHOO_FINANCE`
- `EQUITY_SOURCES.SCREENER`
- `EQUITY_SOURCES.NSE`

### TradeManager

#### `addTrade(trade)`
Add a new trade to the portfolio.

```javascript
const trade = {
  symbol: 'JIOFIN',
  type: 'BUY', // or 'SELL'
  quantity: 100,
  price: 250,
  date: new Date(),
  notes: 'Optional notes'
};

const tradeRecord = tradeManager.addTrade(trade);
```

#### `calculatePortfolioValue(currentPrices)`
Calculate current portfolio value and P&L.

```javascript
const currentPrices = new Map([
  ['JIOFIN', 260],
  ['RELIANCE', 2850]
]);

const portfolio = tradeManager.calculatePortfolioValue(currentPrices);
console.log(`Total P&L: ₹${portfolio.totalPnL}`);
```

#### `getTradeHistory(symbol)`
Get trade history for a specific symbol.

```javascript
const history = tradeManager.getTradeHistory('JIOFIN');
```

## Data Structure 📊

### EquityData
```javascript
{
  symbol: 'JIOFIN',
  price: 260.50,
  change: 5.50,
  changePercent: 2.16,
  volume: 1500000,
  high: 265.00,
  low: 255.00,
  open: 255.00,
  prevClose: 255.00,
  marketCap: 50000000000,
  peRatio: 25.5,
  dividendYield: 1.2,
  timestamp: Date,
  source: 'moneycontrol'
}
```

### Trade Record
```javascript
{
  id: 'TRADE_1234567890_abc123',
  symbol: 'JIOFIN',
  type: 'BUY',
  quantity: 100,
  price: 250.00,
  date: Date,
  notes: 'Initial position',
  timestamp: Date
}
```

## Examples 💡

### Portfolio Tracking
```javascript
// Track multiple stocks
const symbols = ['JIOFIN', 'RELIANCE', 'TCS'];
const portfolioData = {};

for (const symbol of symbols) {
  try {
    const data = await scraper.getEquityData(symbol);
    portfolioData[symbol] = data;
  } catch (error) {
    console.error(`Failed to get data for ${symbol}`);
  }
}

// Calculate portfolio value
const currentPrices = new Map(
  Object.entries(portfolioData).map(([symbol, data]) => [symbol, data.price])
);

const portfolioValue = tradeManager.calculatePortfolioValue(currentPrices);
```

### Scheduled Updates
```javascript
import cron from 'node-cron';

// Update portfolio every 5 minutes during market hours
cron.schedule('*/5 9-15 * * 1-5', async () => {
  console.log('Updating portfolio...');
  // Your update logic here
});
```

### Data Export
```javascript
// Export portfolio data
const exportData = tradeManager.exportPortfolio();
const jsonString = JSON.stringify(exportData, null, 2);

// Save to file
fs.writeFileSync('portfolio-export.json', jsonString);
```

## Error Handling ⚠️

The scraper includes comprehensive error handling:

- **Rate Limiting**: Automatic delays and retry mechanisms
- **Source Fallback**: If one source fails, tries others
- **Data Validation**: Ensures scraped data is valid
- **Graceful Degradation**: Continues operation even if some sources fail

## Legal Considerations ⚖️

- **Terms of Service**: Respect each website's terms of service
- **Rate Limiting**: Implement appropriate delays between requests
- **Data Usage**: Use data responsibly and in accordance with terms
- **Attribution**: Credit data sources when appropriate

## Contributing 🤝

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License 📄

MIT License - see LICENSE file for details

## Support 💬

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review error logs for troubleshooting

## Roadmap 🗺️

- [ ] Real-time WebSocket data
- [ ] Technical indicators
- [ ] Backtesting framework
- [ ] Mobile app
- [ ] API endpoints
- [ ] Database integration
- [ ] Advanced analytics

---

**Disclaimer**: This tool is for educational and personal use. Always verify data accuracy and comply with relevant terms of service. Trading involves risk; use at your own discretion.
