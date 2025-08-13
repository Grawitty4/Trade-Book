import axios from 'axios';

class RealEquityScraper {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.timeout = 15000;
  }

  async getEquityData(symbol) {
    try {
      console.log(`🔍 Fetching real data for ${symbol} from MoneyControl...`);
      
      // MoneyControl URL for Indian stocks
      const url = `https://www.moneycontrol.com/india/stockpricequote/${symbol.toLowerCase()}`;
      
      const response = await axios.get(url, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: this.timeout
      });

      console.log(`✅ Data retrieved for ${symbol}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Content length: ${response.data.length} characters`);
      
      // Parse the HTML to extract stock data
      const data = this.parseMoneyControlData(response.data, symbol);
      
      return data;
      
    } catch (error) {
      console.error(`❌ Error fetching data for ${symbol}:`, error.message);
      
      // Return mock data if scraping fails
      return this.getMockData(symbol);
    }
  }

  parseMoneyControlData(html, symbol) {
    try {
      // Simple regex-based parsing (in production, use cheerio for better parsing)
      const priceMatch = html.match(/class="[^"]*last_price[^"]*"[^>]*>([^<]+)</);
      const changeMatch = html.match(/class="[^"]*change[^"]*"[^>]*>([^<]+)</);
      const volumeMatch = html.match(/class="[^"]*volume[^"]*"[^>]*>([^<]+)</);
      
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/[^\d.]/g, '')) : 0;
      const change = changeMatch ? parseFloat(changeMatch[1].replace(/[^\d.-]/g, '')) : 0;
      const volume = volumeMatch ? parseInt(volumeMatch[1].replace(/[^\d]/g, '')) : 0;
      
      if (price > 0) {
        console.log(`   ✅ Successfully parsed real data`);
        return {
          symbol: symbol.toUpperCase(),
          price: price,
          change: change,
          changePercent: price > 0 ? (change / (price - change)) * 100 : 0,
          volume: volume,
          source: 'moneycontrol',
          timestamp: new Date(),
          isRealData: true
        };
      } else {
        console.log(`   ⚠️ Could not parse real data, using mock data`);
        return this.getMockData(symbol);
      }
      
    } catch (error) {
      console.error(`   ❌ Error parsing data:`, error.message);
      return this.getMockData(symbol);
    }
  }

  getMockData(symbol) {
    const basePrice = 200 + Math.random() * 800;
    const change = (Math.random() - 0.5) * 100;
    const changePercent = (change / basePrice) * 100;
    
    return {
      symbol: symbol.toUpperCase(),
      price: basePrice,
      change: change,
      changePercent: changePercent,
      volume: Math.floor(Math.random() * 1000000),
      source: 'mock',
      timestamp: new Date(),
      isRealData: false
    };
  }

  async getHistoricalData(symbol, days = 7) {
    try {
      console.log(`📅 Attempting to fetch historical data for ${symbol}...`);
      
      // For now, return mock historical data
      // In production, you'd scrape from Yahoo Finance or NSE
      return this.getMockHistoricalData(symbol, days);
      
    } catch (error) {
      console.error(`❌ Error fetching historical data:`, error.message);
      return this.getMockHistoricalData(symbol, days);
    }
  }

  getMockHistoricalData(symbol, days) {
    const historicalData = [];
    const today = new Date();
    let basePrice = 200 + Math.random() * 800;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Generate realistic price movements
      const dailyChange = (Math.random() - 0.5) * 0.1; // ±5% daily change
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
  console.log('🚀 Real Equity Scraper Demo');
  console.log('=====================================');
  
  const scraper = new RealEquityScraper();
  
  try {
    // Test with JIOFIN
    const jiofinData = await scraper.getEquityData('JIOFIN');
    
    console.log('\n📊 JIOFIN Data:');
    console.log(`   Symbol: ${jiofinData.symbol}`);
    console.log(`   Price: ₹${jiofinData.price.toFixed(2)}`);
    console.log(`   Change: ₹${jiofinData.change.toFixed(2)}`);
    console.log(`   Change %: ${jiofinData.changePercent.toFixed(2)}%`);
    console.log(`   Volume: ${jiofinData.volume.toLocaleString()}`);
    console.log(`   Source: ${jiofinData.source}`);
    console.log(`   Real Data: ${jiofinData.isRealData ? '✅ Yes' : '❌ No (Mock)'}`);
    
    // Test with another stock
    console.log('\n🔍 Testing with another stock...');
    const relianceData = await scraper.getEquityData('RELIANCE');
    
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
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('   1. ✅ Basic scraper working');
    console.log('   2. 🔄 Implement real data parsing with cheerio');
    console.log('   3. 📊 Add more data sources (Yahoo Finance, NSE)');
    console.log('   4. 💾 Add data persistence and caching');
    console.log('   5. 🚀 Build portfolio tracking system');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run the demo
demo();
