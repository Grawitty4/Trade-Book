import fs from 'fs/promises';

class DataGenerator {
  constructor() {
    this.trades = [];
    this.portfolio = new Map();
  }

  // Generate sample trades
  generateSampleTrades() {
    console.log('💼 Generating sample trades...');
    
    const sampleTrades = [
      { symbol: 'JIOFIN', type: 'BUY', quantity: 100, price: 250, date: '2025-01-01', notes: 'Initial position' },
      { symbol: 'JIOFIN', type: 'BUY', quantity: 50, price: 245, date: '2025-01-15', notes: 'Averaging down' },
      { symbol: 'RELIANCE', type: 'BUY', quantity: 25, price: 2800, date: '2025-01-10', notes: 'Blue chip addition' },
      { symbol: 'TCS', type: 'BUY', quantity: 10, price: 3500, date: '2025-01-20', notes: 'Tech exposure' },
      { symbol: 'INFY', type: 'BUY', quantity: 30, price: 1500, date: '2025-01-25', notes: 'IT sector' },
      { symbol: 'JIOFIN', type: 'SELL', quantity: 25, price: 280, date: '2025-02-01', notes: 'Partial profit booking' },
      { symbol: 'HDFC', type: 'BUY', quantity: 15, price: 1800, date: '2025-02-05', notes: 'Banking sector' }
    ];

    this.trades = sampleTrades.map(trade => ({
      id: `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...trade,
      timestamp: new Date(trade.date)
    }));

    console.log(`✅ Generated ${this.trades.length} sample trades`);
  }

  // Update portfolio based on trades
  updatePortfolio() {
    console.log('📊 Updating portfolio...');
    
    this.trades.forEach(trade => {
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
    });

    console.log(`✅ Portfolio updated with ${this.portfolio.size} positions`);
  }

  // Save data to JSON file
  async saveToJSON() {
    try {
      const data = {
        trades: this.trades,
        portfolio: Array.from(this.portfolio.entries()),
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeFile('trade-data.json', JSON.stringify(data, null, 2));
      console.log('💾 Data saved to trade-data.json');
    } catch (error) {
      console.error('❌ Error saving JSON:', error.message);
    }
  }

  // Export to CSV
  async exportToCSV() {
    try {
      let csvContent = 'Date,Symbol,Type,Quantity,Price,Notes\n';
      
      this.trades.forEach(trade => {
        const date = new Date(trade.date).toLocaleDateString();
        csvContent += `${date},${trade.symbol},${trade.type},${trade.quantity},${trade.price},${trade.notes}\n`;
      });

      await fs.writeFile('trade-export.csv', csvContent);
      console.log('📊 Data exported to trade-export.csv');
    } catch (error) {
      console.error('❌ Error exporting CSV:', error.message);
    }
  }

  // Display summary
  displaySummary() {
    console.log('\n📊 DATA GENERATION SUMMARY');
    console.log('=====================================');
    
    console.log(`📈 Total Trades: ${this.trades.length}`);
    console.log(`💼 Portfolio Positions: ${this.portfolio.size}`);
    
    console.log('\n📋 Portfolio Details:');
    for (const [symbol, position] of this.portfolio) {
      if (position.totalQuantity > 0) {
        console.log(`   ${symbol}: ${position.totalQuantity} shares @ ₹${position.averagePrice.toFixed(2)}`);
      }
    }
    
    console.log('\n💾 Files Created:');
    console.log('   - trade-data.json (JSON format)');
    console.log('   - trade-export.csv (CSV format)');
    
    console.log('\n🎯 Next Steps:');
    console.log('   1. View data in generated files');
    console.log('   2. Open web interface');
    console.log('   3. Add more trades');
    console.log('   4. Analyze portfolio');
  }
}

// Main function
async function main() {
  console.log('🚀 GENERATING SAMPLE TRADE DATA');
  console.log('=====================================');
  
  const generator = new DataGenerator();
  
  // Generate data
  generator.generateSampleTrades();
  generator.updatePortfolio();
  
  // Save files
  await generator.saveToJSON();
  await generator.exportToCSV();
  
  // Display summary
  generator.displaySummary();
}

// Run the generator
main().catch(console.error);
