import axios from 'axios';

class NSEScraper {
  constructor() {
    this.baseURL = 'https://www.nseindia.com';
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.sessionCookies = null;
  }

  // Initialize session with NSE
  async initializeSession() {
    try {
      console.log('🔐 Initializing NSE session...');
      
      // First, get the main page to establish session
      const response = await axios.get(this.baseURL, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000,
        maxRedirects: 5
      });

      // Extract cookies from response
      if (response.headers['set-cookie']) {
        this.sessionCookies = response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
        console.log('✅ NSE session initialized successfully');
      } else {
        console.log('⚠️ No cookies received, proceeding without session');
      }

      return true;
    } catch (error) {
      console.error('❌ Error initializing NSE session:', error.message);
      return false;
    }
  }

  // Get stock quote from NSE
  async getStockQuote(symbol) {
    try {
      if (!this.sessionCookies) {
        await this.initializeSession();
      }

      console.log(`🔍 Fetching quote for ${symbol} from NSE...`);
      
      // NSE quote API endpoint
      const quoteURL = `${this.baseURL}/api/quote-equity?symbol=${symbol}`;
      
      const response = await axios.get(quoteURL, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': `${this.baseURL}/`,
          'Cookie': this.sessionCookies || '',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        },
        timeout: 15000
      });

      if (response.data && response.data.priceInfo) {
        const data = response.data;
        console.log(`✅ Real-time data received for ${symbol}`);
        
        return {
          symbol: data.info?.symbol || symbol.toUpperCase(),
          price: data.priceInfo?.lastPrice || 0,
          change: data.priceInfo?.change || 0,
          changePercent: data.priceInfo?.pChange || 0,
          volume: data.marketDeptOrderBook?.totalTradedVolume || 0,
          high: data.priceInfo?.dayHigh || 0,
          low: data.priceInfo?.dayLow || 0,
          open: data.priceInfo?.open || 0,
          prevClose: data.priceInfo?.previousClose || 0,
          marketCap: data.securityWiseDP?.marketCap || 0,
          source: 'nse',
          timestamp: new Date(),
          isRealData: true
        };
      } else {
        throw new Error('Invalid data structure received from NSE');
      }

    } catch (error) {
      console.error(`❌ Error fetching NSE quote for ${symbol}:`, error.message);
      
      // Return mock data if NSE fails
      return this.getMockData(symbol);
    }
  }

  // Get historical data from NSE
  async getHistoricalData(symbol, days = 30) {
    try {
      if (!this.sessionCookies) {
        await this.initializeSession();
      }

      console.log(`📅 Fetching ${days} days historical data for ${symbol} from NSE...`);
      
      // NSE historical data endpoint
      const historicalURL = `${this.baseURL}/api/historical/cm/equity?symbol=${symbol}`;
      
      const response = await axios.get(historicalURL, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Cookie': this.sessionCookies || '',
          'Referer': `${this.baseURL}/`
        },
        timeout: 20000
      });

      if (response.data && response.data.data) {
        const historicalData = response.data.data
          .slice(-days) // Get last N days
          .map(item => ({
            date: new Date(item.date),
            open: parseFloat(item.open) || 0,
            high: parseFloat(item.high) || 0,
            low: parseFloat(item.low) || 0,
            close: parseFloat(item.close) || 0,
            volume: parseInt(item.totalTradedVolume) || 0
          }));

        console.log(`✅ Historical data received: ${historicalData.length} days`);
        return historicalData;
      } else {
        throw new Error('Invalid historical data structure received');
      }

    } catch (error) {
      console.error(`❌ Error fetching historical data for ${symbol}:`, error.message);
      return this.getMockHistoricalData(symbol, days);
    }
  }

  // Get market status
  async getMarketStatus() {
    try {
      if (!this.sessionCookies) {
        await this.initializeSession();
      }

      const statusURL = `${this.baseURL}/api/marketStatus`;
      
      const response = await axios.get(statusURL, {
        headers: {
          'User-Agent': this.userAgent,
          'Cookie': this.sessionCookies || ''
        },
        timeout: 10000
      });

      if (response.data) {
        return {
          market: response.data.market || 'NSE',
          status: response.data.status || 'Unknown',
          timestamp: new Date(),
          isRealData: true
        };
      }

    } catch (error) {
      console.error('❌ Error fetching market status:', error.message);
      return {
        market: 'NSE',
        status: 'Unknown (Mock)',
        timestamp: new Date(),
        isRealData: false
      };
    }
  }

  // Mock data fallback
  getMockData(symbol) {
    const basePrice = 100 + Math.random() * 900;
    const change = (Math.random() - 0.5) * 100;
    const changePercent = (change / basePrice) * 100;
    
    return {
      symbol: symbol.toUpperCase(),
      price: basePrice,
      change: change,
      changePercent: changePercent,
      volume: Math.floor(Math.random() * 1000000),
      high: basePrice * 1.05,
      low: basePrice * 0.95,
      open: basePrice * (1 + (Math.random() - 0.5) * 0.02),
      prevClose: basePrice - change,
      marketCap: basePrice * Math.floor(Math.random() * 1000000),
      source: 'mock',
      timestamp: new Date(),
      isRealData: false
    };
  }

  // Mock historical data fallback
  getMockHistoricalData(symbol, days) {
    const historicalData = [];
    const today = new Date();
    let basePrice = 100 + Math.random() * 900;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const dailyChange = (Math.random() - 0.5) * 0.1;
      basePrice = basePrice * (1 + dailyChange);
      
      const open = basePrice;
      const close = basePrice * (1 + (Math.random() - 0.5) * 0.05);
      const high = Math.max(open, close) * (1 + Math.random() * 0.03);
      const low = Math.min(open, close) * (1 - Math.random() * 0.03);
      
      historicalData.push({
        date: date,
        open: open,
        high: high,
        low: low,
        close: close,
        volume: Math.floor(Math.random() * 1000000)
      });
    }
    
    return historicalData;
  }
}

// Demo function
async function demo() {
  console.log('🚀 NSE SCRAPER DEMO');
  console.log('=====================================');
  
  const scraper = new NSEScraper();
  
  try {
    // Initialize session
    await scraper.initializeSession();
    
    // Get market status
    const marketStatus = await scraper.getMarketStatus();
    console.log('\n📊 Market Status:');
    console.log(`   Market: ${marketStatus.market}`);
    console.log(`   Status: ${marketStatus.status}`);
    console.log(`   Real Data: ${marketStatus.isRealData ? '✅ Yes' : '❌ No (Mock)'}`);
    
    // Test with JIOFIN
    const jiofinData = await scraper.getStockQuote('JIOFIN');
    
    console.log('\n📊 JIOFIN Data:');
    console.log(`   Symbol: ${jiofinData.symbol}`);
    console.log(`   Price: ₹${jiofinData.price.toFixed(2)}`);
    console.log(`   Change: ₹${jiofinData.change.toFixed(2)}`);
    console.log(`   Change %: ${jiofinData.changePercent.toFixed(2)}%`);
    console.log(`   Volume: ${jiofinData.volume.toLocaleString()}`);
    console.log(`   High: ₹${jiofinData.high.toFixed(2)}`);
    console.log(`   Low: ₹${jiofinData.low.toFixed(2)}`);
    console.log(`   Source: ${jiofinData.source}`);
    console.log(`   Real Data: ${jiofinData.isRealData ? '✅ Yes' : '❌ No (Mock)'}`);
    
    // Test with another stock
    const relianceData = await scraper.getStockQuote('RELIANCE');
    
    console.log('\n📊 RELIANCE Data:');
    console.log(`   Symbol: ${relianceData.symbol}`);
    console.log(`   Price: ₹${relianceData.price.toFixed(2)}`);
    console.log(`   Change: ₹${relianceData.change.toFixed(2)}`);
    console.log(`   Change %: ${relianceData.changePercent.toFixed(2)}%`);
    console.log(`   Source: ${relianceData.source}`);
    console.log(`   Real Data: ${relianceData.isRealData ? '✅ Yes' : '❌ No (Mock)'}`);
    
    // Get historical data
    const historical = await scraper.getHistoricalData('JIOFIN', 5);
    
    console.log('\n📈 Last 5 Days Data (JIOFIN):');
    historical.forEach(day => {
      const date = day.date.toLocaleDateString();
      const change = day.close - day.open;
      const changePercent = ((day.close - day.open) / day.open) * 100;
      const changeColor = change >= 0 ? '🟢' : '🔴';
      
      console.log(`   ${date}: O: ₹${day.open.toFixed(2)} | H: ₹${day.high.toFixed(2)} | L: ₹${day.low.toFixed(2)} | C: ₹${day.close.toFixed(2)} | ${changeColor} ${changePercent.toFixed(2)}%`);
    });
    
    console.log('\n🎉 NSE Scraper Demo completed!');
    console.log('\n💡 To use with real data:');
    console.log('   1. ✅ NSE session management implemented');
    console.log('   2. 🔄 Real-time quote fetching ready');
    console.log('   3. 📊 Historical data scraping ready');
    console.log('   4. ⚠️ Respect rate limits and terms of service');
    console.log('   5. 🚀 Integrate with trade book system');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run the demo
demo().catch(console.error);
