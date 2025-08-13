/**
 * Equity Data Types and Interfaces
 */

export const EQUITY_SOURCES = {
  NSE: 'nse',
  MONEYCONTROL: 'moneycontrol',
  YAHOO_FINANCE: 'yahoo_finance',
  SCREENER: 'screener'
};

export const EQUITY_DATA_FIELDS = {
  SYMBOL: 'symbol',
  PRICE: 'price',
  CHANGE: 'change',
  CHANGE_PERCENT: 'changePercent',
  VOLUME: 'volume',
  HIGH: 'high',
  LOW: 'low',
  OPEN: 'open',
  PREV_CLOSE: 'prevClose',
  MARKET_CAP: 'marketCap',
  PE_RATIO: 'peRatio',
  DIVIDEND_YIELD: 'dividendYield',
  TIMESTAMP: 'timestamp'
};

/**
 * Equity Data Structure
 */
export class EquityData {
  constructor(data = {}) {
    this.symbol = data.symbol || '';
    this.price = data.price || 0;
    this.change = data.change || 0;
    this.changePercent = data.changePercent || 0;
    this.volume = data.volume || 0;
    this.high = data.high || 0;
    this.low = data.low || 0;
    this.open = data.open || 0;
    this.prevClose = data.prevClose || 0;
    this.marketCap = data.marketCap || 0;
    this.peRatio = data.peRatio || 0;
    this.dividendYield = data.dividendYield || 0;
    this.timestamp = data.timestamp || new Date();
    this.source = data.source || '';
  }

  toJSON() {
    return {
      symbol: this.symbol,
      price: this.price,
      change: this.change,
      changePercent: this.changePercent,
      volume: this.volume,
      high: this.high,
      low: this.low,
      open: this.open,
      prevClose: this.prevClose,
      marketCap: this.marketCap,
      peRatio: this.peRatio,
      dividendYield: this.dividendYield,
      timestamp: this.timestamp,
      source: this.source
    };
  }

  static fromJSON(json) {
    return new EquityData(json);
  }
}
