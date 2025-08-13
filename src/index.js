import { EquityScraper } from './scrapers/EquityScraper.js';
import { TradeManager } from './utils/TradeManager.js';
import { EQUITY_SOURCES } from './types/equity.js';

/**
 * Trade Book - Main Application
 * Demonstrates equity data scraping and trade management
 */

class TradeBook {
  constructor() {
    this.scraper = new EquityScraper();
    this.tradeManager = new TradeManager();
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('🚀 Trade Book Initialized');
    console.log('📊 Equity Data Scraper Ready');
    console.log('💼 Trade Manager Ready');
    console.log('=====================================');
  }

  /**
   * Demo: Get equity data for JIOFIN
   */
  async demoJiofinData() {
    try {
      console.log('\n🔍 Fetching JIOFIN data...');
      
      // Try to get data from multiple sources
      const data = await this.scraper.getEquityData('JIOFIN');
      
      console.log('✅ JIOFIN Data Retrieved:');
      console.log(`   Symbol: ${data.symbol}`);
      console.log(`   Current Price: ₹${data.price}`);
      console.log(`   Change: ₹${data.change} (${data.changePercent}%)`);
      console.log(`   Volume: ${data.volume.toLocaleString()}`);
      console.log(`   Day High: ₹${data.high}`);
      console.log(`   Day Low: ₹${data.low}`);
      console.log(`   Source: ${data.source}`);
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching JIOFIN data:', error.message);
      return null;
    }
  }

  /**
   * Demo: Compare data from different sources
   */
  async demoSourceComparison() {
    try {
      console.log('\n🔍 Comparing data from different sources...');
      
      const sources = [EQUITY_SOURCES.MONEYCONTROL, EQUITY_SOURCES.YAHOO_FINANCE, EQUITY_SOURCES.SCREENER];
      const results = {};
      
      for (const source of sources) {
        try {
          console.log(`   Fetching from ${source}...`);
          const data = await this.scraper.scrapeFromSource('JIOFIN', source);
          results[source] = data;
          console.log(`   ✅ ${source}: ₹${data.price}`);
        } catch (error) {
          console.log(`   ❌ ${source}: Failed - ${error.message}`);
          results[source] = null;
        }
      }
      
      return results;
    } catch (error) {
      console.error('❌ Error in source comparison:', error.message);
      return {};
    }
  }

  /**
   * Demo: Trade management
   */
  async demoTradeManagement() {
    try {
      console.log('\n💼 Demo Trade Management...');
      
      // Add some sample trades
      const trades = [
        { symbol: 'JIOFIN', type: 'BUY', quantity: 100, price: 250, notes: 'Initial position' },
        { symbol: 'JIOFIN', type: 'BUY', quantity: 50, price: 245, notes: 'Averaging down' },
        { symbol: 'RELIANCE', type: 'BUY', quantity: 25, price: 2800, notes: 'Blue chip addition' }
      ];
      
      trades.forEach(trade => {
        const tradeRecord = this.tradeManager.addTrade(trade);
        console.log(`   ✅ Added ${trade.type} trade: ${trade.quantity} ${trade.symbol} @ ₹${trade.price}`);
      });
      
      // Get portfolio summary
      const summary = this.tradeManager.getPortfolioSummary();
      console.log('\n📊 Portfolio Summary:');
      console.log(`   Total Symbols: ${summary.totalSymbols}`);
      console.log(`   Total Trades: ${summary.totalTrades}`);
      console.log(`   Active Positions: ${summary.activePositions}`);
      
      // Get trade history for JIOFIN
      const jiofinHistory = this.tradeManager.getTradeHistory('JIOFIN');
      console.log('\n📈 JIOFIN Trade History:');
      jiofinHistory.forEach(trade => {
        console.log(`   ${trade.date.toLocaleDateString()}: ${trade.type} ${trade.quantity} @ ₹${trade.price}`);
      });
      
      return summary;
    } catch (error) {
      console.error('❌ Error in trade management demo:', error.message);
      return null;
    }
  }

  /**
   * Demo: Portfolio P&L calculation
   */
  async demoPortfolioPnL() {
    try {
      console.log('\n💰 Portfolio P&L Calculation...');
      
      // Simulate current prices
      const currentPrices = new Map([
        ['JIOFIN', 260],
        ['RELIANCE', 2850]
      ]);
      
      // Calculate portfolio value
      const portfolioValue = this.tradeManager.calculatePortfolioValue(currentPrices);
      
      console.log('📊 Portfolio Summary:');
      console.log(`   Total Invested: ₹${portfolioValue.totalInvested.toLocaleString()}`);
      console.log(`   Current Value: ₹${portfolioValue.totalValue.toLocaleString()}`);
      console.log(`   Total P&L: ₹${portfolioValue.totalPnL.toLocaleString()}`);
      console.log(`   P&L %: ${portfolioValue.totalPnLPercent.toFixed(2)}%`);
      
      console.log('\n📈 Position Details:');
      portfolioValue.positions.forEach(position => {
        const pnlColor = position.pnl >= 0 ? '🟢' : '🔴';
        console.log(`   ${position.symbol}: ${position.quantity} shares @ ₹${position.averagePrice}`);
        console.log(`     Current: ₹${position.currentPrice} | P&L: ${pnlColor} ₹${position.pnl.toLocaleString()} (${position.pnlPercent.toFixed(2)}%)`);
      });
      
      return portfolioValue;
    } catch (error) {
      console.error('❌ Error in P&L calculation:', error.message);
      return null;
    }
  }

  /**
   * Demo: Historical data
   */
  async demoHistoricalData() {
    try {
      console.log('\n📅 Fetching Historical Data for JIOFIN...');
      
      const historicalData = await this.scraper.getHistoricalData('JIOFIN', 7);
      
      console.log('📊 Last 7 Days Data:');
      historicalData.forEach(day => {
        const date = day.date.toLocaleDateString();
        const change = day.close - day.open;
        const changePercent = ((day.close - day.open) / day.open) * 100;
        const changeColor = change >= 0 ? '🟢' : '🔴';
        
        console.log(`   ${date}: O: ₹${day.open} | H: ₹${day.high} | L: ₹${day.low} | C: ₹${day.close} | ${changeColor} ${changePercent.toFixed(2)}%`);
      });
      
      return historicalData;
    } catch (error) {
      console.error('❌ Error fetching historical data:', error.message);
      return null;
    }
  }

  /**
   * Run all demos
   */
  async runDemos() {
    await this.init();
    
    // Run demos sequentially
    await this.demoJiofinData();
    await this.demoSourceComparison();
    await this.demoTradeManagement();
    await this.demoPortfolioPnL();
    await this.demoHistoricalData();
    
    console.log('\n🎉 All demos completed!');
    console.log('\n📚 Usage Examples:');
    console.log('   const scraper = new EquityScraper();');
    console.log('   const data = await scraper.getEquityData("JIOFIN");');
    console.log('   const historical = await scraper.getHistoricalData("JIOFIN", 30);');
    console.log('\n   const tradeManager = new TradeManager();');
    console.log('   tradeManager.addTrade({ symbol: "JIOFIN", type: "BUY", quantity: 100, price: 250 });');
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tradeBook = new TradeBook();
  tradeBook.runDemos().catch(console.error);
}

export default TradeBook;
