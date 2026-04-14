import { TradeSignal } from '../types';

export interface ProfitMetrics {
  gasCostUsd: number;
  apiCostUsd: number;
  minProfitMarginUsd: number;
}

export class ProfitGuard {
  constructor(private metrics: ProfitMetrics) {}

  /**
   * Calculates if a trade is mathematically sound after all operational costs
   */
  isProfitable(signal: TradeSignal, expectedGainUsd: number): { profitable: boolean; netProfit: number; reason?: string } {
    const totalCosts = this.metrics.gasCostUsd + this.metrics.apiCostUsd;
    const netProfit = expectedGainUsd - totalCosts;

    if (netProfit < this.metrics.minProfitMarginUsd) {
      return { 
        profitable: false, 
        netProfit, 
        reason: `INSUFFICIENT_MARGIN: Net $${netProfit.toFixed(4)} < Min $${this.metrics.minProfitMarginUsd}` 
      };
    }

    return { profitable: true, netProfit };
  }

  updateGasPrice(newGasCost: number) {
    this.metrics.gasCostUsd = newGasCost;
  }
}
