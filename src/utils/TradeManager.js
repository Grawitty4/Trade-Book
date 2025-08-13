import { EquityData } from '../types/equity.js';

/**
 * Trade Manager Utility
 * Handles trade operations, portfolio tracking, and P&L calculations
 */
export class TradeManager {
  constructor() {
    this.trades = [];
    this.portfolio = new Map();
  }

  /**
   * Add a new trade
   * @param {Object} trade - Trade object
   * @param {string} trade.symbol - Stock symbol
   * @param {string} trade.type - 'BUY' or 'SELL'
   * @param {number} trade.quantity - Number of shares
   * @param {number} trade.price - Price per share
   * @param {Date} trade.date - Trade date
   * @param {string} trade.notes - Additional notes
   */
  addTrade(trade) {
    const tradeRecord = {
      id: this.generateTradeId(),
      symbol: trade.symbol.toUpperCase(),
      type: trade.type.toUpperCase(),
      quantity: trade.quantity,
      price: trade.price,
      date: trade.date || new Date(),
      notes: trade.notes || '',
      timestamp: new Date()
    };

    this.trades.push(tradeRecord);
    this.updatePortfolio(tradeRecord);
    
    return tradeRecord;
  }

  /**
   * Update portfolio based on trade
   * @param {Object} trade - Trade record
   */
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

  /**
   * Calculate current portfolio value
   * @param {Map} currentPrices - Current prices for symbols
   * @returns {Object} Portfolio summary
   */
  calculatePortfolioValue(currentPrices) {
    let totalValue = 0;
    let totalInvested = 0;
    let totalPnL = 0;
    const positions = [];

    for (const [symbol, position] of this.portfolio) {
      if (position.totalQuantity > 0) {
        const currentPrice = currentPrices.get(symbol) || 0;
        const currentValue = position.totalQuantity * currentPrice;
        const pnl = currentValue - position.totalInvested;
        const pnlPercent = position.totalInvested > 0 ? (pnl / position.totalInvested) * 100 : 0;

        positions.push({
          symbol: position.symbol,
          quantity: position.totalQuantity,
          averagePrice: position.averagePrice,
          currentPrice,
          currentValue,
          totalInvested: position.totalInvested,
          pnl,
          pnlPercent
        });

        totalValue += currentValue;
        totalInvested += position.totalInvested;
        totalPnL += pnl;
      }
    }

    return {
      totalValue,
      totalInvested,
      totalPnL,
      totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
      positions
    };
  }

  /**
   * Get trade history for a symbol
   * @param {string} symbol - Stock symbol
   * @returns {Array} Array of trades for the symbol
   */
  getTradeHistory(symbol) {
    return this.trades.filter(trade => 
      trade.symbol.toUpperCase() === symbol.toUpperCase()
    ).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Get all trades
   * @param {Object} filters - Optional filters
   * @returns {Array} Filtered trades
   */
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

  /**
   * Calculate P&L for a specific symbol
   * @param {string} symbol - Stock symbol
   * @param {number} currentPrice - Current market price
   * @returns {Object} P&L calculation
   */
  calculateSymbolPnL(symbol, currentPrice) {
    const position = this.portfolio.get(symbol.toUpperCase());
    
    if (!position || position.totalQuantity <= 0) {
      return {
        symbol: symbol.toUpperCase(),
        quantity: 0,
        averagePrice: 0,
        currentPrice: 0,
        currentValue: 0,
        totalInvested: 0,
        pnl: 0,
        pnlPercent: 0
      };
    }

    const currentValue = position.totalQuantity * currentPrice;
    const pnl = currentValue - position.totalInvested;
    const pnlPercent = position.totalInvested > 0 ? (pnl / position.totalInvested) * 100 : 0;

    return {
      symbol: position.symbol,
      quantity: position.totalQuantity,
      averagePrice: position.averagePrice,
      currentPrice,
      currentValue,
      totalInvested: position.totalInvested,
      pnl,
      pnlPercent
    };
  }

  /**
   * Export portfolio data
   * @returns {Object} Portfolio data for export
   */
  exportPortfolio() {
    return {
      portfolio: Object.fromEntries(this.portfolio),
      trades: this.trades,
      exportDate: new Date()
    };
  }

  /**
   * Import portfolio data
   * @param {Object} data - Portfolio data to import
   */
  importPortfolio(data) {
    if (data.portfolio) {
      this.portfolio = new Map(Object.entries(data.portfolio));
    }
    if (data.trades) {
      this.trades = data.trades;
    }
  }

  /**
   * Generate unique trade ID
   * @returns {string} Unique trade ID
   */
  generateTradeId() {
    return `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get portfolio summary
   * @returns {Object} Portfolio summary
   */
  getPortfolioSummary() {
    const summary = {
      totalSymbols: this.portfolio.size,
      totalTrades: this.trades.length,
      activePositions: 0,
      totalQuantity: 0
    };

    for (const position of this.portfolio.values()) {
      if (position.totalQuantity > 0) {
        summary.activePositions++;
        summary.totalQuantity += position.totalQuantity;
      }
    }

    return summary;
  }
}
