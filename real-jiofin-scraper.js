import axios from 'axios';
import fs from 'fs/promises';

/**
 * Real JIOFIN Data Scraper
 * This scraper attempts to fetch actual JIOFIN data from legitimate financial data sources
 */

class RealJIOFINScraper {
  constructor() {
    this.symbol = 'JIOFIN';
    this.nseSymbol = 'JIOFINANCIAL'; // NSE trading symbol
    this.yahooSymbol = 'JIOFINANCIAL.NS'; // Yahoo Finance symbol
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  }

  /**
   * Attempt to fetch real data from Yahoo Finance API
   * This is one of the most reliable free financial data sources
   */
  async fetchFromYahooFinance() {
    console.log('🔍 Attempting to fetch from Yahoo Finance...');
    
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${this.yahooSymbol}`;
      console.log(`📡 URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      console.log(`📊 Response Status: ${response.status}`);
      
      if (response.data?.chart?.result?.[0]) {
        const data = response.data.chart.result[0];
        const meta = data.meta;
        
        const currentPrice = meta.regularMarketPrice || meta.previousClose;
        const prevClose = meta.previousClose;
        const change = currentPrice - prevClose;
        const changePercent = (change / prevClose) * 100;

        console.log('✅ Successfully retrieved real data from Yahoo Finance!');
        
        return {
          symbol: this.symbol,
          price: currentPrice,
          change: change,
          changePercent: changePercent,
          volume: meta.regularMarketVolume || 0,
          high: meta.regularMarketDayHigh || currentPrice,
          low: meta.regularMarketDayLow || currentPrice,
          open: meta.regularMarketOpen || currentPrice,
          prevClose: prevClose,
          marketCap: meta.marketCap || 'N/A',
          source: 'yahoo_finance_real',
          sourceUrl: url,
          timestamp: new Date(),
          isRealData: true,
          currency: meta.currency || 'INR'
        };
      }
      
      throw new Error('Invalid Yahoo Finance response structure');
      
    } catch (error) {
      console.log(`❌ Yahoo Finance failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Attempt to fetch from Alpha Vantage (requires free API key)
   * This is another reliable source for real financial data
   */
  async fetchFromAlphaVantage() {
    console.log('🔍 Attempting to fetch from Alpha Vantage...');
    
    // Note: This requires a free API key from https://www.alphavantage.co/
    const apiKey = 'demo'; // Replace with real API key
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${this.nseSymbol}.BSE&apikey=${apiKey}`;
    
    try {
      console.log(`📡 URL: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000
      });

      console.log(`📊 Response Status: ${response.status}`);
      
      if (response.data?.['Global Quote']) {
        const quote = response.data['Global Quote'];
        
        console.log('✅ Successfully retrieved real data from Alpha Vantage!');
        
        return {
          symbol: this.symbol,
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
          volume: parseInt(quote['06. volume']),
          high: parseFloat(quote['03. high']),
          low: parseFloat(quote['04. low']),
          open: parseFloat(quote['02. open']),
          prevClose: parseFloat(quote['08. previous close']),
          source: 'alpha_vantage_real',
          sourceUrl: url,
          timestamp: new Date(),
          isRealData: true,
          currency: 'INR'
        };
      }
      
      throw new Error('Invalid Alpha Vantage response');
      
    } catch (error) {
      console.log(`❌ Alpha Vantage failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Attempt to fetch from NSE India (Direct from source)
   * This is the most authoritative source but has strict access controls
   */
  async fetchFromNSEDirect() {
    console.log('🔍 Attempting to fetch from NSE India...');
    
    try {
      // NSE requires specific headers and session handling
      const url = `https://www.nseindia.com/api/quote-equity?symbol=${this.nseSymbol}`;
      console.log(`📡 URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.nseindia.com/',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000
      });

      console.log(`📊 Response Status: ${response.status}`);
      
      if (response.data?.priceInfo) {
        const data = response.data.priceInfo;
        
        console.log('✅ Successfully retrieved real data from NSE India!');
        
        return {
          symbol: this.symbol,
          price: data.lastPrice,
          change: data.change,
          changePercent: data.pChange,
          volume: data.totalTradedVolume,
          high: data.intraDayHighLow?.max || data.lastPrice,
          low: data.intraDayHighLow?.min || data.lastPrice,
          open: data.open,
          prevClose: data.previousClose,
          source: 'nse_india_real',
          sourceUrl: url,
          timestamp: new Date(),
          isRealData: true,
          currency: 'INR'
        };
      }
      
      throw new Error('Invalid NSE response structure');
      
    } catch (error) {
      console.log(`❌ NSE India failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate realistic mock data with clear indication it's not real
   * This is used as a fallback when real APIs are not accessible
   */
  generateFallbackData() {
    console.log('⚠️ Using fallback mock data - NOT REAL MARKET DATA');
    
    // Generate realistic but clearly fake data
    const basePrice = 280; // Approximate JIOFIN price range
    const randomVariation = (Math.random() - 0.5) * 20; // ±10 variation
    const price = basePrice + randomVariation;
    const change = (Math.random() - 0.5) * 15; // ±7.5 change
    const changePercent = (change / price) * 100;
    
    return {
      symbol: this.symbol,
      price: price,
      change: change,
      changePercent: changePercent,
      volume: Math.floor(Math.random() * 1000000) + 100000,
      high: price + Math.random() * 10,
      low: price - Math.random() * 10,
      open: price + (Math.random() - 0.5) * 5,
      prevClose: price - change,
      source: 'MOCK_DATA_FALLBACK',
      sourceUrl: 'NO_REAL_SOURCE',
      timestamp: new Date(),
      isRealData: false,
      currency: 'INR',
      warning: '⚠️ THIS IS MOCK DATA - NOT REAL MARKET DATA'
    };
  }

  /**
   * Try all real data sources in order, fallback to mock if all fail
   */
  async getRealJIOFINData() {
    console.log('🚀 Real JIOFIN Data Scraper');
    console.log('='.repeat(50));
    console.log(`📊 Attempting to fetch real data for: ${this.symbol}`);
    console.log(`🔗 NSE Symbol: ${this.nseSymbol}`);
    console.log(`🔗 Yahoo Symbol: ${this.yahooSymbol}`);
    console.log('');

    const dataSources = [
      {
        name: 'Yahoo Finance',
        method: this.fetchFromYahooFinance.bind(this),
        reliability: 'High'
      },
      {
        name: 'NSE India Direct',
        method: this.fetchFromNSEDirect.bind(this),
        reliability: 'Highest (but restricted)'
      },
      {
        name: 'Alpha Vantage',
        method: this.fetchFromAlphaVantage.bind(this),
        reliability: 'High (requires API key)'
      }
    ];

    for (const source of dataSources) {
      try {
        console.log(`🔄 Trying ${source.name} (${source.reliability})...`);
        const data = await source.method();
        
        if (data && data.price > 0) {
          console.log(`✅ Successfully retrieved data from ${source.name}!`);
          return data;
        }
      } catch (error) {
        console.log(`❌ ${source.name} failed: ${error.message}`);
        continue;
      }
    }

    console.log('');
    console.log('🚨 ALL REAL DATA SOURCES FAILED');
    console.log('📋 Possible reasons:');
    console.log('   • Network connectivity issues');
    console.log('   • API rate limiting');
    console.log('   • Invalid symbols (JIOFIN vs JIOFINANCIAL)');
    console.log('   • Anti-scraping measures');
    console.log('   • Market closed');
    console.log('');
    console.log('💡 Solutions:');
    console.log('   • Get Alpha Vantage API key (free)');
    console.log('   • Try during market hours (9:15 AM - 3:30 PM IST)');
    console.log('   • Use paid financial data API');
    console.log('');

    // Return mock data with clear warning
    return this.generateFallbackData();
  }

  /**
   * Display data with clear source information
   */
  displayData(data) {
    console.log('');
    console.log('📊 JIOFIN DATA RESULTS');
    console.log('='.repeat(50));
    
    if (!data.isRealData) {
      console.log('🚨 WARNING: THIS IS MOCK DATA, NOT REAL MARKET DATA');
      console.log('='.repeat(50));
    }
    
    console.log(`💰 Current Price: ₹${data.price.toFixed(2)}`);
    console.log(`📈 Change: ₹${data.change.toFixed(2)} (${data.changePercent.toFixed(2)}%)`);
    console.log(`📊 Volume: ${data.volume?.toLocaleString() || 'N/A'}`);
    console.log(`🔝 Day High: ₹${data.high?.toFixed(2) || 'N/A'}`);
    console.log(`🔻 Day Low: ₹${data.low?.toFixed(2) || 'N/A'}`);
    console.log(`🏁 Open: ₹${data.open?.toFixed(2) || 'N/A'}`);
    console.log(`📅 Previous Close: ₹${data.prevClose?.toFixed(2) || 'N/A'}`);
    console.log(`💱 Currency: ${data.currency || 'INR'}`);
    console.log('');
    console.log('📋 DATA SOURCE INFORMATION:');
    console.log(`🔗 Source: ${data.source}`);
    console.log(`🌐 Source URL: ${data.sourceUrl || 'N/A'}`);
    console.log(`✅ Real Data: ${data.isRealData ? 'YES' : 'NO - MOCK DATA'}`);
    console.log(`⏰ Timestamp: ${data.timestamp.toLocaleString()}`);
    
    if (data.warning) {
      console.log('');
      console.log(`⚠️ ${data.warning}`);
    }
  }

  /**
   * Save data with source information
   */
  async saveData(data) {
    try {
      const saveData = {
        jiofin: data,
        dataSourceInfo: {
          isRealData: data.isRealData,
          source: data.source,
          sourceUrl: data.sourceUrl,
          lastUpdated: new Date().toISOString(),
          reliability: data.isRealData ? 'Real market data' : 'Mock data fallback'
        }
      };

      await fs.writeFile('jiofin-real-data.json', JSON.stringify(saveData, null, 2));
      console.log('💾 Data saved to: jiofin-real-data.json');

      // CSV format
      const csvData = `Symbol,Price,Change,ChangePercent,Volume,Source,IsRealData,Timestamp\n${data.symbol},${data.price.toFixed(2)},${data.change.toFixed(2)},${data.changePercent.toFixed(2)},${data.volume || 0},${data.source},${data.isRealData},${data.timestamp.toISOString()}`;
      
      await fs.writeFile('jiofin-real-data.csv', csvData);
      console.log('📊 Data saved to: jiofin-real-data.csv');

    } catch (error) {
      console.error('❌ Error saving data:', error.message);
    }
  }
}

// Main execution
async function main() {
  const scraper = new RealJIOFINScraper();
  
  try {
    const data = await scraper.getRealJIOFINData();
    scraper.displayData(data);
    await scraper.saveData(data);
    
    console.log('');
    console.log('🎉 Scraping completed!');
    console.log('📁 Check these files for the data:');
    console.log('   • jiofin-real-data.json');
    console.log('   • jiofin-real-data.csv');
    
  } catch (error) {
    console.error('💥 Scraper failed completely:', error.message);
  }
}

// Run the scraper
main().catch(console.error);
