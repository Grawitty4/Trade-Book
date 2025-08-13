import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

class TradeBookSystem {
  constructor() {
    this.trades = [];
    this.portfolio = new Map();
    this.dataFile = 'trade-data.json';
    this.loadData();
  }

  // Load existing data from file
  async loadData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(data);
      this.trades = parsed.trades || [];
      this.portfolio = new Map(parsed.portfolio || []);
      console.log(`✅ Loaded ${this.trades.length} trades and ${this.portfolio.size} portfolio positions`);
    } catch (error) {
      console.log('📝 No existing data found, starting fresh');
    }
  }

  // Save data to file
  async saveData() {
    try {
      const data = {
        trades: this.trades,
        portfolio: Array.from(this.portfolio.entries()),
        lastUpdated: new Date().toISOString()
      };
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
      console.log('💾 Data saved successfully');
    } catch (error) {
      console.error('❌ Error saving data:', error.message);
    }
  }

  // Add a new trade
  addTrade(symbol, type, quantity, price, date = new Date(), notes = '') {
    const trade = {
      id: `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: symbol.toUpperCase(),
      type: type.toUpperCase(), // BUY or SELL
      quantity: quantity,
      price: price,
      date: date,
      notes: notes,
      timestamp: new Date()
    };

    this.trades.push(trade);
    this.updatePortfolio(trade);
    this.saveData();
    
    console.log(`✅ Added ${type} trade: ${quantity} ${symbol} @ ₹${price}`);
    return trade;
  }

  // Update portfolio based on trade
  updatePortfolio(trade) {
    const symbol = trade.symbol;
    
    if (!this.portfolio.has(symbol)) {
      this.portfolio.set(symbol, {
        symbol,
        totalQuantity: 0,
        averagePrice: 0,
        totalInvested: 0,
        trades: []
      });
    }

    const position = this.portfolio.get(symbol);
    position.trades.push(trade);

    if (trade.type === 'BUY') {
      const newTotalQuantity = position.totalQuantity + trade.quantity;
      const newTotalInvested = position.totalInvested + (trade.quantity * trade.price);
      
      position.totalQuantity = newTotalQuantity;
      position.totalInvested = newTotalInvested;
      position.averagePrice = newTotalInvested / newTotalQuantity;
    } else if (trade.type === 'SELL') {
      position.totalQuantity -= trade.quantity;
      
      if (position.totalQuantity <= 0) {
        position.totalQuantity = 0;
        position.averagePrice = 0;
        position.totalInvested = 0;
      }
    }
  }

  // Get current portfolio value with P&L
  async getPortfolioValue() {
    const portfolioData = [];
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalPnL = 0;

    for (const [symbol, position] of this.portfolio) {
      if (position.totalQuantity > 0) {
        try {
          // Try to get current price from NSE (mock for now)
          const currentPrice = await this.getCurrentPrice(symbol);
          const currentValue = position.totalQuantity * currentPrice;
          const pnl = currentValue - position.totalInvested;
          const pnlPercent = position.totalInvested > 0 ? (pnl / position.totalInvested) * 100 : 0;

          portfolioData.push({
            symbol: position.symbol,
            quantity: position.totalQuantity,
            averagePrice: position.averagePrice,
            currentPrice: currentPrice,
            currentValue: currentValue,
            totalInvested: position.totalInvested,
            pnl: pnl,
            pnlPercent: pnlPercent
          });

          totalInvested += position.totalInvested;
          totalCurrentValue += currentValue;
          totalPnL += pnl;

        } catch (error) {
          console.error(`❌ Error getting price for ${symbol}:`, error.message);
        }
      }
    }

    return {
      positions: portfolioData,
      totalInvested,
      totalCurrentValue,
      totalPnL,
      totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
    };
  }

  // Get current price (mock implementation - replace with real NSE scraping)
  async getCurrentPrice(symbol) {
    try {
      // This is where you'd implement real NSE scraping
      // For now, returning mock data
      const basePrice = 100 + Math.random() * 900;
      return basePrice;
    } catch (error) {
      throw new Error(`Failed to get price for ${symbol}`);
    }
  }

  // Get trade history for a symbol
  getTradeHistory(symbol) {
    return this.trades
      .filter(trade => trade.symbol.toUpperCase() === symbol.toUpperCase())
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // Get all trades with filters
  getAllTrades(filters = {}) {
    let filteredTrades = [...this.trades];

    if (filters.symbol) {
      filteredTrades = filteredTrades.filter(trade => 
        trade.symbol.toUpperCase().includes(filters.symbol.toUpperCase())
      );
    }

    if (filters.type) {
      filteredTrades = filteredTrades.filter(trade => 
        trade.type.toUpperCase() === filters.type.toUpperCase()
      );
    }

    if (filters.startDate) {
      filteredTrades = filteredTrades.filter(trade => 
        new Date(trade.date) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      filteredTrades = filteredTrades.filter(trade => 
        new Date(trade.date) <= new Date(filters.endDate)
      );
    }

    return filteredTrades.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // Export data to CSV
  async exportToCSV(filename = 'trade-export.csv') {
    try {
      let csvContent = 'Date,Symbol,Type,Quantity,Price,Notes\n';
      
      this.trades.forEach(trade => {
        const date = new Date(trade.date).toLocaleDateString();
        csvContent += `${date},${trade.symbol},${trade.type},${trade.quantity},${trade.price},${trade.notes}\n`;
      });

      await fs.writeFile(filename, csvContent);
      console.log(`📊 Data exported to ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Error exporting to CSV:', error.message);
    }
  }

  // Display portfolio summary
  async displayPortfolio() {
    console.log('\n📊 PORTFOLIO SUMMARY');
    console.log('=====================================');
    
    const portfolioValue = await this.getPortfolioValue();
    
    console.log(`💰 Total Invested: ₹${portfolioValue.totalInvested.toLocaleString()}`);
    console.log(`📈 Current Value: ₹${portfolioValue.totalCurrentValue.toLocaleString()}`);
    console.log(`💵 Total P&L: ₹${portfolioValue.totalPnL.toLocaleString()}`);
    console.log(`📊 P&L %: ${portfolioValue.totalPnLPercent.toFixed(2)}%`);
    
    console.log('\n📋 POSITION DETAILS:');
    portfolioValue.positions.forEach(position => {
      const pnlColor = position.pnl >= 0 ? '🟢' : '🔴';
      console.log(`\n   ${position.symbol}:`);
      console.log(`     Quantity: ${position.quantity} shares`);
      console.log(`     Avg Price: ₹${position.averagePrice.toFixed(2)}`);
      console.log(`     Current Price: ₹${position.currentPrice.toFixed(2)}`);
      console.log(`     Current Value: ₹${position.currentValue.toLocaleString()}`);
      console.log(`     P&L: ${pnlColor} ₹${position.pnl.toLocaleString()} (${position.pnlPercent.toFixed(2)}%)`);
    });
  }

  // Display trade history
  displayTradeHistory(symbol = null) {
    console.log('\n📈 TRADE HISTORY');
    console.log('=====================================');
    
    const trades = symbol ? this.getTradeHistory(symbol) : this.trades;
    
    if (trades.length === 0) {
      console.log('   No trades found');
      return;
    }

    trades.forEach(trade => {
      const date = new Date(trade.date).toLocaleDateString();
      const time = new Date(trade.date).toLocaleTimeString();
      console.log(`   ${date} ${time} | ${trade.type} ${trade.quantity} ${trade.symbol} @ ₹${trade.price} | ${trade.notes}`);
    });
  }

  // Analyze scrip performance
  async analyzeScrip(symbol) {
    console.log(`\n🔍 SCRIP ANALYSIS: ${symbol.toUpperCase()}`);
    console.log('=====================================');
    
    const trades = this.getTradeHistory(symbol);
    const position = this.portfolio.get(symbol.toUpperCase());
    
    if (!position || position.totalQuantity <= 0) {
      console.log('   No active position in this scrip');
      return;
    }

    console.log(`📊 Position Summary:`);
    console.log(`   Total Quantity: ${position.totalQuantity} shares`);
    console.log(`   Average Price: ₹${position.averagePrice.toFixed(2)}`);
    console.log(`   Total Invested: ₹${position.totalInvested.toLocaleString()}`);
    
    console.log(`\n📈 Trade Analysis:`);
    const buyTrades = trades.filter(t => t.type === 'BUY');
    const sellTrades = trades.filter(t => t.type === 'SELL');
    
    console.log(`   Buy Trades: ${buyTrades.length}`);
    console.log(`   Sell Trades: ${sellTrades.length}`);
    
    if (buyTrades.length > 0) {
      const avgBuyPrice = buyTrades.reduce((sum, t) => sum + t.price, 0) / buyTrades.length;
      console.log(`   Average Buy Price: ₹${avgBuyPrice.toFixed(2)}`);
    }
    
    if (sellTrades.length > 0) {
      const avgSellPrice = sellTrades.reduce((sum, t) => sum + t.price, 0) / sellTrades.length;
      console.log(`   Average Sell Price: ₹${avgSellPrice.toFixed(2)}`);
    }
  }
}

// Demo function
async function demo() {
  console.log('🚀 TRADE BOOK SYSTEM DEMO');
  console.log('=====================================');
  
  const tradeBook = new TradeBookSystem();
  
  // Add some sample trades
  console.log('\n💼 Adding sample trades...');
  tradeBook.addTrade('JIOFIN', 'BUY', 100, 250, new Date('2025-01-01'), 'Initial position');
  tradeBook.addTrade('JIOFIN', 'BUY', 50, 245, new Date('2025-01-15'), 'Averaging down');
  tradeBook.addTrade('RELIANCE', 'BUY', 25, 2800, new Date('2025-01-10'), 'Blue chip addition');
  tradeBook.addTrade('TCS', 'BUY', 10, 3500, new Date('2025-01-20'), 'Tech exposure');
  
  // Display portfolio
  await tradeBook.displayPortfolio();
  
  // Display trade history
  tradeBook.displayTradeHistory();
  
  // Analyze specific scrip
  await tradeBook.analyzeScrip('JIOFIN');
  
  // Export to CSV
  await tradeBook.exportToCSV();
  
  console.log('\n🎉 Demo completed!');
  console.log('\n💡 Your trade data is now stored in:');
  console.log('   - trade-data.json (JSON format)');
  console.log('   - trade-export.csv (CSV format)');
  console.log('\n📊 To view your data anytime, run:');
  console.log('   node trade-book-system.js');
}

// Run the demo
demo().catch(console.error);
