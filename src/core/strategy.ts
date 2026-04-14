import { MatrixEngine } from './matrix_engine';
import { AuditResult } from './venom_auditor';
import { SentimentResult } from '../services/geminiService';

export interface StrategySignal {
  shouldTrade: boolean;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
}

export class QuantumStrategy {
  /**
   * The "Barbell Strategy" logic.
   * Combines Quant, Security, and Sentiment.
   */
  static evaluate(
    prices: number[], 
    audit: AuditResult, 
    sentiment: SentimentResult | null
  ): StrategySignal {
    const rsi = MatrixEngine.calculateRSI(prices);
    const ema = MatrixEngine.calculateEMA(prices, 10);
    const currentPrice = prices[prices.length - 1];
    const { prediction, confidence: predConfidence } = MatrixEngine.predictNextPrice(prices);

    let score = 0;
    let reasons: string[] = [];

    // 1. Security Filter (Non-negotiable)
    if (!audit.isSafe || audit.score < 85) {
      return { shouldTrade: false, action: 'HOLD', confidence: 0, reason: 'Security Audit Failed' };
    }
    score += 30; // Security weight adjusted

    // 2. Quant Analysis (MATRIX)
    if (rsi < 35) {
      score += 20;
      reasons.push('Oversold (RSI)');
    } else if (rsi > 70) {
      return { shouldTrade: false, action: 'HOLD', confidence: 0, reason: 'Overbought (RSI)' };
    }

    if (currentPrice > ema) {
      score += 10;
      reasons.push('Above EMA');
    }

    // 3. Predictive Analysis
    if (prediction > currentPrice && predConfidence > 0.6) {
      score += 20;
      reasons.push(`Predictive Uptrend (${(predConfidence * 100).toFixed(0)}% conf)`);
    }

    // 4. Sentiment Analysis (PSYCHE)
    if (sentiment) {
      if (sentiment.label === 'BULLISH') {
        score += 20;
        reasons.push('Bullish Sentiment');
      } else if (sentiment.label === 'BEARISH') {
        score -= 20;
        reasons.push('Bearish Sentiment');
      }
    }

    const confidence = score / 100;
    const shouldTrade = confidence >= 0.75;

    return {
      shouldTrade,
      action: shouldTrade ? 'BUY' : 'HOLD',
      confidence,
      reason: reasons.join(' + ') || 'Neutral conditions'
    };
  }
}
