import axios from 'axios';
import fs from 'fs/promises';

/**
 * Universal Stock Scraper
 * Fetches real market data for any Indian stock symbol from multiple reliable sources
 */

class UniversalStockScraper {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.timeout = 15000;
    this.retryAttempts = 3;
  }

  /**
   * Main method to get stock data for any symbol
   */
  async getStockData(symbol) {
    console.log(`🔍 Fetching data for: ${symbol.toUpperCase()}`);
    console.log('='.repeat(50));

    const sources = [
      this.fetchFromYahooFinance.bind(this),
      this.fetchFromMoneyControl.bind(this),
      this.fetchFromNSEWebsite.bind(this),
      this.fetchFromTradingView.bind(this),
      this.fetchFromAlphaVantage.bind(this)
    ];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      try {
        console.log(`🔄 Trying source ${i + 1}/${sources.length}...`);
        const data = await this.retryRequest(source, symbol);
        
        if (data && data.price > 0) {
          console.log(`✅ Success! Got data from ${data.source}`);
          return this.normalizeData(data, symbol);
        }
      } catch (error) {
        console.log(`❌ Source ${i + 1} failed: ${error.message}`);
        continue;
      }
    }

    // If all sources fail, return mock data with clear warning
    console.log('🚨 All sources failed, returning mock data...');
    return this.generateMockData(symbol);
  }

  /**
   * Retry mechanism for failed requests
   */
  async retryRequest(sourceFunction, symbol) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await sourceFunction(symbol);
      } catch (error) {
        if (attempt === this.retryAttempts) {
          throw error;
        }
        console.log(`   Attempt ${attempt} failed, retrying...`);
        await this.delay(1000 * attempt); // Exponential backoff
      }
    }
  }

  /**
   * Yahoo Finance API - Most reliable
   */
  async fetchFromYahooFinance(symbol) {
    const yahooSymbol = `${symbol.toUpperCase()}.NS`; // NSE suffix
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
    
    console.log(`   📡 Yahoo Finance: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: this.timeout
    });

    if (response.data?.chart?.result?.[0]) {
      const data = response.data.chart.result[0];
      const meta = data.meta;
      
      if (!meta.regularMarketPrice && !meta.previousClose) {
        throw new Error('Invalid price data from Yahoo Finance');
      }

      const currentPrice = meta.regularMarketPrice || meta.previousClose;
      const prevClose = meta.previousClose;
      const change = currentPrice - prevClose;
      const changePercent = (change / prevClose) * 100;

      return {
        symbol: symbol.toUpperCase(),
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        volume: meta.regularMarketVolume || 0,
        high: meta.regularMarketDayHigh || currentPrice,
        low: meta.regularMarketDayLow || currentPrice,
        open: meta.regularMarketOpen || currentPrice,
        prevClose: prevClose,
        marketCap: meta.marketCap,
        currency: meta.currency || 'INR',
        source: 'yahoo_finance',
        sourceUrl: url,
        timestamp: new Date(),
        isRealData: true
      };
    }
    
    throw new Error('Invalid Yahoo Finance response structure');
  }

  /**
   * MoneyControl scraper (simplified - no HTML parsing)
   */
  async fetchFromMoneyControl(symbol) {
    // MoneyControl would require complex HTML parsing with cheerio
    // For now, we'll skip this and rely on Yahoo Finance and NSE
    throw new Error('MoneyControl integration requires HTML parsing - skipping for faster deployment');
  }

  /**
   * NSE Website direct API
   */
  async fetchFromNSEWebsite(symbol) {
    const url = `https://www.nseindia.com/api/quote-equity?symbol=${symbol.toUpperCase()}`;
    
    console.log(`   📡 NSE India: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nseindia.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache'
      },
      timeout: this.timeout
    });

    if (response.data?.priceInfo) {
      const data = response.data.priceInfo;
      
      return {
        symbol: symbol.toUpperCase(),
        price: data.lastPrice,
        change: data.change,
        changePercent: data.pChange,
        volume: data.totalTradedVolume,
        high: data.intraDayHighLow?.max || data.lastPrice,
        low: data.intraDayHighLow?.min || data.lastPrice,
        open: data.open,
        prevClose: data.previousClose,
        currency: 'INR',
        source: 'nse_india',
        sourceUrl: url,
        timestamp: new Date(),
        isRealData: true
      };
    }
    
    throw new Error('Invalid NSE response structure');
  }

  /**
   * TradingView approach (simplified)
   */
  async fetchFromTradingView(symbol) {
    // TradingView has complex WebSocket APIs, this is a simplified approach
    throw new Error('TradingView integration requires WebSocket connection - complex implementation');
  }

  /**
   * Alpha Vantage API
   */
  async fetchFromAlphaVantage(symbol) {
    // Note: Requires API key from https://www.alphavantage.co/
    const apiKey = 'demo'; // Replace with real API key
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}.BSE&apikey=${apiKey}`;
    
    console.log(`   📡 Alpha Vantage: ${url}`);
    
    const response = await axios.get(url, {
      timeout: this.timeout
    });

    if (response.data?.['Global Quote']) {
      const quote = response.data['Global Quote'];
      
      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        volume: parseInt(quote['06. volume']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        open: parseFloat(quote['02. open']),
        prevClose: parseFloat(quote['08. previous close']),
        currency: 'INR',
        source: 'alpha_vantage',
        sourceUrl: url,
        timestamp: new Date(),
        isRealData: true
      };
    }
    
    throw new Error('Invalid Alpha Vantage response');
  }

  /**
   * Generate realistic mock data when all sources fail
   */
  generateMockData(symbol) {
    console.log(`⚠️ Generating mock data for ${symbol.toUpperCase()}`);
    
    // Base prices for common stocks (you can expand this)
    const basePrices = {
      'JIOFIN': 280,
      'JIOFINANCIAL': 280,
      'RELIANCE': 2800,
      'TCS': 3500,
      'INFY': 1400,
      'HDFCBANK': 1600,
      'ICICIBANK': 900,
      'BAJFINANCE': 6500,
      'BHARTIARTL': 800,
      'ITC': 450
    };

    const basePrice = basePrices[symbol.toUpperCase()] || 500; // Default 500 if unknown
    const randomVariation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const price = basePrice * (1 + randomVariation);
    const change = (Math.random() - 0.5) * basePrice * 0.05; // ±2.5% change
    const changePercent = (change / price) * 100;
    
    return {
      symbol: symbol.toUpperCase(),
      price: price,
      change: change,
      changePercent: changePercent,
      volume: Math.floor(Math.random() * 1000000) + 100000,
      high: price * (1 + Math.random() * 0.05),
      low: price * (1 - Math.random() * 0.05),
      open: price * (1 + (Math.random() - 0.5) * 0.02),
      prevClose: price - change,
      currency: 'INR',
      source: 'MOCK_DATA',
      sourceUrl: 'NO_REAL_SOURCE',
      timestamp: new Date(),
      isRealData: false,
      warning: '⚠️ THIS IS MOCK DATA - REAL SOURCES FAILED'
    };
  }

  /**
   * Normalize data format across all sources
   */
  normalizeData(data, symbol) {
    return {
      ...data,
      symbol: symbol.toUpperCase(),
      price: parseFloat(data.price.toFixed(2)),
      change: parseFloat(data.change.toFixed(2)),
      changePercent: parseFloat(data.changePercent.toFixed(2)),
      volume: parseInt(data.volume) || 0,
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Save fetched data to file
   */
  async saveStockData(data) {
    try {
      const filename = `stock-data-${data.symbol.toLowerCase()}.json`;
      const saveData = {
        stockData: data,
        fetchInfo: {
          source: data.source,
          isRealData: data.isRealData,
          fetchedAt: data.fetchedAt,
          reliability: data.isRealData ? 'Real market data' : 'Mock data (real sources failed)'
        }
      };

      await fs.writeFile(filename, JSON.stringify(saveData, null, 2));
      console.log(`💾 Data saved to: ${filename}`);

      // Also save to CSV
      const csvFilename = `stock-data-${data.symbol.toLowerCase()}.csv`;
      const csvData = `Symbol,Price,Change,ChangePercent,Volume,High,Low,Open,PrevClose,Source,IsRealData,Timestamp
${data.symbol},${data.price},${data.change},${data.changePercent},${data.volume},${data.high},${data.low},${data.open},${data.prevClose},${data.source},${data.isRealData},${data.fetchedAt}`;
      
      await fs.writeFile(csvFilename, csvData);
      console.log(`📊 CSV saved to: ${csvFilename}`);

      return { jsonFile: filename, csvFile: csvFilename };
    } catch (error) {
      console.error('❌ Error saving data:', error.message);
      return null;
    }
  }

  /**
   * Display stock data in a nice format
   */
  displayStockData(data) {
    console.log('\n📊 STOCK DATA RESULTS');
    console.log('='.repeat(50));
    
    if (!data.isRealData) {
      console.log('🚨 WARNING: THIS IS MOCK DATA');
      console.log('='.repeat(50));
    }
    
    console.log(`📈 ${data.symbol}`);
    console.log(`💰 Current Price: ₹${data.price}`);
    
    const changeColor = data.change >= 0 ? '🟢' : '🔴';
    const changeSign = data.change >= 0 ? '+' : '';
    console.log(`${changeColor} Change: ${changeSign}₹${data.change} (${changeSign}${data.changePercent}%)`);
    
    console.log(`📊 Volume: ${data.volume?.toLocaleString() || 'N/A'}`);
    console.log(`🔝 Day High: ₹${data.high}`);
    console.log(`🔻 Day Low: ₹${data.low}`);
    console.log(`🏁 Open: ₹${data.open}`);
    console.log(`📅 Prev Close: ₹${data.prevClose}`);
    console.log(`💱 Currency: ${data.currency}`);
    console.log('');
    console.log('📋 SOURCE INFO:');
    console.log(`🔗 Source: ${data.source}`);
    console.log(`✅ Real Data: ${data.isRealData ? 'YES' : 'NO'}`);
    console.log(`⏰ Fetched: ${new Date(data.fetchedAt).toLocaleString()}`);
    
    if (data.warning) {
      console.log(`\n⚠️ ${data.warning}`);
    }
  }

  /**
   * Utility: Add delay for retry mechanism
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get multiple stocks at once
   */
  async getMultipleStocks(symbols) {
    console.log(`🔍 Fetching data for ${symbols.length} stocks: ${symbols.join(', ')}`);
    console.log('='.repeat(60));
    
    const results = [];
    
    for (const symbol of symbols) {
      try {
        const data = await this.getStockData(symbol);
        results.push(data);
        console.log(`✅ ${symbol}: ₹${data.price} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent}%)`);
      } catch (error) {
        console.log(`❌ ${symbol}: Failed - ${error.message}`);
        results.push({
          symbol: symbol.toUpperCase(),
          error: error.message,
          failed: true
        });
      }
      
      // Add delay between requests to avoid rate limiting
      await this.delay(1000);
    }
    
    return results;
  }
}

// Export for use in other modules
export default UniversalStockScraper;

// Command line usage
async function main() {
  const scraper = new UniversalStockScraper();
  
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🚀 Universal Stock Scraper Demo');
    console.log('=====================================');
    console.log('Testing with popular stocks...\n');
    
    const testSymbols = ['JIOFIN', 'RELIANCE', 'TCS', 'INFY'];
    const results = await scraper.getMultipleStocks(testSymbols);
    
    console.log('\n📊 SUMMARY:');
    results.forEach(stock => {
      if (!stock.failed) {
        console.log(`${stock.symbol}: ₹${stock.price} (${stock.source})`);
      }
    });
    
  } else {
    // Use provided symbol
    const symbol = args[0].toUpperCase();
    
    try {
      const data = await scraper.getStockData(symbol);
      scraper.displayStockData(data);
      await scraper.saveStockData(data);
      
      console.log('\n🎉 Stock data fetched successfully!');
      
    } catch (error) {
      console.error(`💥 Failed to fetch data for ${symbol}:`, error.message);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
