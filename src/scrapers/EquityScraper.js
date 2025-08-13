import axios from 'axios';
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { EquityData, EQUITY_SOURCES } from '../types/equity.js';

/**
 * Equity Data Scraper
 * Supports multiple sources for Indian equity data
 */
export class EquityScraper {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.timeout = 30000;
  }

  /**
   * Get equity data from multiple sources
   * @param {string} symbol - Stock symbol (e.g., 'JIOFIN')
   * @param {string} source - Data source (optional, will try all if not specified)
   * @returns {Promise<EquityData>}
   */
  async getEquityData(symbol, source = null) {
    try {
      if (source) {
        return await this.scrapeFromSource(symbol, source);
      }

      // Try multiple sources in order of reliability
      const sources = [EQUITY_SOURCES.MONEYCONTROL, EQUITY_SOURCES.YAHOO_FINANCE, EQUITY_SOURCES.SCREENER];
      
      for (const src of sources) {
        try {
          const data = await this.scrapeFromSource(symbol, src);
          if (data && data.price > 0) {
            return data;
          }
        } catch (error) {
          console.warn(`Failed to scrape from ${src}:`, error.message);
          continue;
        }
      }
      
      throw new Error(`Failed to get data for ${symbol} from all sources`);
    } catch (error) {
      console.error(`Error getting equity data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Scrape equity data from a specific source
   * @param {string} symbol - Stock symbol
   * @param {string} source - Data source
   * @returns {Promise<EquityData>}
   */
  async scrapeFromSource(symbol, source) {
    switch (source) {
      case EQUITY_SOURCES.MONEYCONTROL:
        return await this.scrapeMoneyControl(symbol);
      case EQUITY_SOURCES.YAHOO_FINANCE:
        return await this.scrapeYahooFinance(symbol);
      case EQUITY_SOURCES.SCREENER:
        return await this.scrapeScreener(symbol);
      case EQUITY_SOURCES.NSE:
        return await this.scrapeNSE(symbol);
      default:
        throw new Error(`Unsupported source: ${source}`);
    }
  }

  /**
   * Scrape from MoneyControl (Most reliable for Indian stocks)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<EquityData>}
   */
  async scrapeMoneyControl(symbol) {
    try {
      const url = `https://www.moneycontrol.com/india/stockpricequote/${symbol.toLowerCase()}`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: this.timeout
      });

      const $ = cheerio.load(response.data);
      
      const price = parseFloat($('.pcnsb div:nth-child(1) .last_price').text().replace(/[^\d.]/g, '')) || 0;
      const change = parseFloat($('.pcnsb div:nth-child(2) .change').text().replace(/[^\d.-]/g, '')) || 0;
      const changePercent = parseFloat($('.pcnsb div:nth-child(2) .change_percent').text().replace(/[^\d.-]/g, '')) || 0;
      const volume = parseInt($('.pcnsb div:nth-child(3) .volume').text().replace(/[^\d]/g, '')) || 0;
      const high = parseFloat($('.pcnsb div:nth-child(4) .high').text().replace(/[^\d.]/g, '')) || 0;
      const low = parseFloat($('.pcnsb div:nth-child(5) .low').text().replace(/[^\d.]/g, '')) || 0;
      const open = parseFloat($('.pcnsb div:nth-child(6) .open').text().replace(/[^\d.]/g, '')) || 0;

      return new EquityData({
        symbol: symbol.toUpperCase(),
        price,
        change,
        changePercent,
        volume,
        high,
        low,
        open,
        source: EQUITY_SOURCES.MONEYCONTROL
      });
    } catch (error) {
      throw new Error(`MoneyControl scraping failed: ${error.message}`);
    }
  }

  /**
   * Scrape from Yahoo Finance
   * @param {string} symbol - Stock symbol
   * @returns {Promise<EquityData>}
   */
  async scrapeYahooFinance(symbol) {
    try {
      // For Indian stocks, append .NS (NSE) or .BO (BSE)
      const yahooSymbol = `${symbol}.NS`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: this.timeout
      });

      const data = response.data.chart.result[0];
      const quote = data.indicators.quote[0];
      const meta = data.meta;
      
      const currentPrice = meta.regularMarketPrice;
      const prevClose = meta.previousClose;
      const change = currentPrice - prevClose;
      const changePercent = (change / prevClose) * 100;

      return new EquityData({
        symbol: symbol.toUpperCase(),
        price: currentPrice,
        change,
        changePercent,
        volume: quote.volume[quote.volume.length - 1] || 0,
        high: meta.regularMarketDayHigh || 0,
        low: meta.regularMarketDayLow || 0,
        open: meta.regularMarketOpen || 0,
        prevClose,
        source: EQUITY_SOURCES.YAHOO_FINANCE
      });
    } catch (error) {
      throw new Error(`Yahoo Finance scraping failed: ${error.message}`);
    }
  }

  /**
   * Scrape from Screener.in
   * @param {string} symbol - Stock symbol
   * @returns {Promise<EquityData>}
   */
  async scrapeScreener(symbol) {
    try {
      const url = `https://www.screener.in/company/${symbol}/`;
      
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setUserAgent(this.userAgent);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: this.timeout });

      const data = await page.evaluate(() => {
        const priceElement = document.querySelector('.company-price .price');
        const price = priceElement ? parseFloat(priceElement.textContent.replace(/[^\d.]/g, '')) : 0;
        
        const changeElement = document.querySelector('.company-price .change');
        const change = changeElement ? parseFloat(changeElement.textContent.replace(/[^\d.-]/g, '')) : 0;
        
        const marketCapElement = document.querySelector('[data-testid="market-cap"]');
        const marketCap = marketCapElement ? parseFloat(marketCapElement.textContent.replace(/[^\d.]/g, '')) : 0;
        
        const peElement = document.querySelector('[data-testid="pe-ratio"]');
        const peRatio = peElement ? parseFloat(peElement.textContent.replace(/[^\d.]/g, '')) : 0;

        return { price, change, marketCap, peRatio };
      });

      await browser.close();

      return new EquityData({
        symbol: symbol.toUpperCase(),
        price: data.price,
        change: data.change,
        marketCap: data.marketCap,
        peRatio: data.peRatio,
        source: EQUITY_SOURCES.SCREENER
      });
    } catch (error) {
      throw new Error(`Screener scraping failed: ${error.message}`);
    }
  }

  /**
   * Scrape from NSE (Official source - requires careful handling)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<EquityData>}
   */
  async scrapeNSE(symbol) {
    try {
      // NSE has rate limiting and requires proper headers
      const url = `https://www.nseindia.com/api/quote-equity?symbol=${symbol}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.nseindia.com/',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: this.timeout
      });

      const data = response.data;
      
      return new EquityData({
        symbol: data.info.symbol,
        price: data.priceInfo.lastPrice,
        change: data.priceInfo.change,
        changePercent: data.priceInfo.pChange,
        volume: data.marketDeptOrderBook.totalTradedVolume,
        high: data.priceInfo.dayHigh,
        low: data.priceInfo.dayLow,
        open: data.priceInfo.open,
        prevClose: data.priceInfo.previousClose,
        source: EQUITY_SOURCES.NSE
      });
    } catch (error) {
      throw new Error(`NSE scraping failed: ${error.message}`);
    }
  }

  /**
   * Get historical data for a symbol
   * @param {string} symbol - Stock symbol
   * @param {number} days - Number of days of historical data
   * @returns {Promise<Array>}
   */
  async getHistoricalData(symbol, days = 30) {
    try {
      const yahooSymbol = `${symbol}.NS`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=${days}d`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: this.timeout
      });

      const data = response.data.chart.result[0];
      const timestamps = data.timestamp;
      const quotes = data.indicators.quote[0];
      
      const historicalData = [];
      for (let i = 0; i < timestamps.length; i++) {
        historicalData.push({
          date: new Date(timestamps[i] * 1000),
          open: quotes.open[i] || 0,
          high: quotes.high[i] || 0,
          low: quotes.low[i] || 0,
          close: quotes.close[i] || 0,
          volume: quotes.volume[i] || 0
        });
      }

      return historicalData;
    } catch (error) {
      throw new Error(`Historical data scraping failed: ${error.message}`);
    }
  }
}
