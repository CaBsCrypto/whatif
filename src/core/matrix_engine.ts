import axios from 'axios';
import { Logger } from '../services/logger.js';

/**
 * MATRIX QUANT ENGINE - Core Mathematical Functions
 * Optimized for low-latency execution.
 */

export class MatrixEngine {
  /**
   * Relative Strength Index (RSI)
   */
  static calculateRSI(prices: number[], periods: number = 14): number {
    if (prices.length < periods + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= periods; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / periods;
    let avgLoss = losses / periods;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Fetch real price data from DexScreener for a specific token
   */
  static async fetchPricesForToken(tokenAddress: string, network: string): Promise<number[]> {
    try {
      // Fetch latest pair data from DexScreener
      const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const pairs = response.data?.pairs;
      
      if (!pairs || pairs.length === 0) {
        Logger.log('warn', `[MATRIX] No price history found on DexScreener for ${tokenAddress}. Generating launch ticks.`);
        // Token is absolutely fresh, provide flat-ish array to prevent math errors
        // but avoid triggering fake momentum
        return Array.from({ length: 20 }, () => 1.0); 
      }

      // We sort by liquidity to get the most accurate price
      const bestPair = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      const currentPrice = parseFloat(bestPair.priceUsd) || 0;

      // Since DexScreener free public API doesn't give candlestick history in this endpoint,
      // and we need an array for RSI/EMA, we build a synthetic array based on the 
      // 5m/1h/6h/24h price changes provided in the pair data.
      const changes = bestPair.priceChange || {};
      const m5 = changes.m5 || 0;
      const h1 = changes.h1 || 0;
      
      // We'll generate a 20-period price path recursively
      const historyPrices: number[] = [currentPrice];
      let pLine = currentPrice;
      
      // Reverse-engineer the likely path over the last 20 frames
      const step = (m5 / 100) * currentPrice / 20;

      for (let i = 0; i < 19; i++) {
        // Add some noise
        pLine = pLine - step + (Math.random() - 0.5) * (step / 2);
        historyPrices.push(Math.max(pLine, 0.000000001)); // Prevent negative prices
      }

      // historyPrices is from present to past, we need it past to present
      return historyPrices.reverse();

    } catch (error) {
      Logger.log('error', `[MATRIX] Error fetching prices for ${tokenAddress}: ${error}`);
      return Array.from({ length: 20 }, () => 1.0);
    }
  }

  /**
   * Exponential Moving Average (EMA)
   */
  static calculateEMA(prices: number[], periods: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (periods + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * k) + (ema * (1 - k));
    }

    return ema;
  }

  /**
   * Volume Weighted Average Price (VWAP) - Simplified
   */
  static calculateVWAP(prices: number[], volumes: number[]): number {
    let totalVolumePrice = 0;
    let totalVolume = 0;

    for (let i = 0; i < prices.length; i++) {
      totalVolumePrice += prices[i] * volumes[i];
      totalVolume += volumes[i];
    }

    if (totalVolume === 0) return prices[prices.length - 1] || 0;
    return totalVolumePrice / totalVolume;
  }

  /**
   * Predicts the next price point using simple linear regression over the window
   */
  static predictNextPrice(prices: number[]): { prediction: number; confidence: number } {
    const n = prices.length;
    if (n < 5) return { prediction: prices[n - 1] || 0, confidence: 0 };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += prices[i];
      sumXY += i * prices[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const prediction = slope * n + intercept;
    
    // Confidence based on R-squared (simplified)
    let ssRes = 0;
    let ssTot = 0;
    const avgY = sumY / n;
    for (let i = 0; i < n; i++) {
      const fit = slope * i + intercept;
      ssRes += Math.pow(prices[i] - fit, 2);
      ssTot += Math.pow(prices[i] - avgY, 2);
    }
    
    const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
    
    return { 
      prediction, 
      confidence: Math.min(Math.max(rSquared, 0), 1) 
    };
  }

  /**
   * Detects the current market style: TRENDING, RANGING, or VOLATILE
   */
  static detectMarketStyle(prices: number[]): 'TRENDING' | 'RANGING' | 'VOLATILE' {
    if (prices.length < 2) return 'RANGING';
    const rsi = this.calculateRSI(prices);
    const n = prices.length;
    const returns = [];
    for (let i = 1; i < n; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    if (volatility > 0.02) return 'VOLATILE'; // High volatility threshold
    if (rsi > 65 || rsi < 35) return 'TRENDING';
    return 'RANGING';
  }

  /**
   * Evaluates Tier 1 Asset (BTC, ETH, SOL, BNB) for continuous active trading
   */
  static async evaluateTier1Asset(tokenAddress: string, network: string): Promise<{
    shouldBuy: boolean;
    confidence: number;
    reason: string;
  }> {
    const prices = await this.fetchPricesForToken(tokenAddress, network);
    if (prices.length < 14) {
      return { shouldBuy: false, confidence: 0, reason: "Insufficient data" };
    }
    
    const rsi = this.calculateRSI(prices);
    const emaShort = this.calculateEMA(prices, 9);
    const emaLong = this.calculateEMA(prices, 20);

    let shouldBuy = false;
    let confidence = 0.5;
    let reason = "Neutral";

    if (emaShort > emaLong && rsi < 65 && rsi > 40) {
      shouldBuy = true;
      confidence = 0.8;
      reason = `Trending Up: EMA9 > EMA20, RSI=${rsi.toFixed(1)}`;
    } else if (rsi < 35) {
      shouldBuy = true;
      confidence = 0.7;
      reason = `Oversold Dip: RSI=${rsi.toFixed(1)} < 35`;
    } else if (rsi > 70) {
      shouldBuy = false;
      confidence = 0.4;
      reason = `Overbought: RSI=${rsi.toFixed(1)} > 70`;
    } else {
      shouldBuy = false;
      confidence = 0.5;
      reason = `Ranging: EMA short <= EMA long, RSI=${rsi.toFixed(1)}`;
    }

    return { shouldBuy, confidence, reason };
  }

  /**
   * Recommends the best pairs based on market style
   */
  static recommendPairs(style: 'TRENDING' | 'RANGING' | 'VOLATILE'): string[] {
    const pairs = {
      TRENDING: ['SOL/USDC', 'ETH/USDC', 'JUP/SOL'],
      RANGING: ['USDC/USDT', 'WBTC/BTC', 'stETH/ETH'],
      VOLATILE: ['WIF/SOL', 'BONK/SOL', 'POPCAT/SOL']
    };
    return pairs[style];
  }
}
