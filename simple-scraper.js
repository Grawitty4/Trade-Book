import axios from 'axios';

class SimpleEquityScraper {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async getEquityData(symbol) {
    try {
      console.log(`🔍 Fetching data for ${symbol}...`);
      
      // Try to get data from a simple API endpoint first
      const response = await axios.get(`https://api.github.com/users/${symbol}`, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      // This is just a test - in reality you'd parse actual equity data
      console.log(`✅ Data retrieved for ${symbol}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Data available: ${response.data ? 'Yes' : 'No'}`);
      
      return {
        symbol: symbol.toUpperCase(),
        price: Math.random() * 1000, // Mock price for demo
        change: Math.random() * 50 - 25, // Mock change
        changePercent: Math.random() * 10 - 5, // Mock percentage
        volume: Math.floor(Math.random() * 1000000), // Mock volume
        source: 'demo',
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(`❌ Error fetching data for ${symbol}:`, error.message);
      
      // Return mock data if network fails
      return {
        symbol: symbol.toUpperCase(),
        price: Math.random() * 1000,
        change: Math.random() * 50 - 25,
        changePercent: Math.random() * 10 - 5,
        volume: Math.floor(Math.random() * 1000000),
        source: 'mock',
        timestamp: new Date()
      };
    }
  }

  async getHistoricalData(symbol, days = 7) {
    console.log(`📅 Getting ${days} days of historical data for ${symbol}...`);
    
    const historicalData = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      historicalData.push({
        date: date,
        open: Math.random() * 1000,
        high: Math.random() * 1000 + 50,
        low: Math.random() * 1000 - 50,
        close: Math.random() * 1000,
        volume: Math.floor(Math.random() * 1000000)
      });
    }
    
    return historicalData;
  }
}

// Demo function
async function demo() {
  console.log('🚀 Simple Equity Scraper Demo');
  console.log('=====================================');
  
  const scraper = new SimpleEquityScraper();
  
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
    
    // Get historical data
    const historical = await scraper.getHistoricalData('JIOFIN', 5);
    
    console.log('\n📈 Last 5 Days Data:');
    historical.forEach(day => {
      const date = day.date.toLocaleDateString();
      const change = day.close - day.open;
      const changePercent = ((day.close - day.open) / day.open) * 100;
      const changeColor = change >= 0 ? '🟢' : '🔴';
      
      console.log(`   ${date}: O: ₹${day.open.toFixed(2)} | H: ₹${day.high.toFixed(2)} | L: ₹${day.low.toFixed(2)} | C: ₹${day.close.toFixed(2)} | ${changeColor} ${changePercent.toFixed(2)}%`);
    });
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 To use with real data:');
    console.log('   1. Replace mock data with actual web scraping');
    console.log('   2. Add proper error handling and rate limiting');
    console.log('   3. Implement data validation');
    console.log('   4. Add caching and persistence');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run the demo
demo();
