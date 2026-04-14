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
   * Exponential Moving Average (EMA)
   */
  static calculateEMA(prices: number[], periods: number): number {
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

    return totalVolumePrice / totalVolume;
  }

  /**
   * Predicts the next price point using simple linear regression over the window
   */
  static predictNextPrice(prices: number[]): { prediction: number; confidence: number } {
    const n = prices.length;
    if (n < 5) return { prediction: prices[n - 1], confidence: 0 };

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
