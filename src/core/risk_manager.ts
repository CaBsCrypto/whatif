import { Network, TradeSignal } from '../types';

export interface RiskConfig {
  maxDrawdown: number;
  maxPositionSizeUsd: number;
  killSwitchLatencyMs: number;
  coolDownPeriodMs: number;
  tierLimits: {
    [key: number]: {
      maxSizeUsd: number;
      minConfidence: number;
      stopLoss: number;
    }
  };
}

export class RiskManager {
  private lastTradeTime: number = 0;
  private currentDrawdown: number = 0;
  private isLocked: boolean = false;

  constructor(private config: RiskConfig) {}

  /**
   * Validates if a trade signal adheres to the 4-Tier risk management rules
   */
  validateSignal(signal: TradeSignal, currentLatency: number): { valid: boolean; reason?: string } {
    // 1. Kill-Switch Check
    if (currentLatency > this.config.killSwitchLatencyMs) {
      return { valid: false, reason: `LATENCY_EXCEEDED: ${currentLatency}ms > ${this.config.killSwitchLatencyMs}ms` };
    }

    // 2. Lock Check (Anti-Revenge Trading)
    if (this.isLocked) {
      return { valid: false, reason: 'SYSTEM_LOCKED: Risk threshold breached' };
    }

    // 3. Cool-Down Check
    const timeSinceLastTrade = Date.now() - this.lastTradeTime;
    if (timeSinceLastTrade < this.config.coolDownPeriodMs) {
      return { valid: false, reason: `COOL_DOWN: Only ${Math.floor(timeSinceLastTrade/1000)}s since last trade` };
    }

    // 4. Tier-Specific Rules
    const tierLimit = this.config.tierLimits[signal.tier];
    if (tierLimit) {
      if (signal.confidence < tierLimit.minConfidence) {
        return { valid: false, reason: `LOW_CONFIDENCE_TIER_${signal.tier}: ${signal.confidence} < ${tierLimit.minConfidence}` };
      }
      // In a real scenario, we would also check position size here
    }

    return { valid: true };
  }

  recordTrade(success: boolean, pnl: number) {
    this.lastTradeTime = Date.now();
    
    if (!success) {
      this.currentDrawdown += Math.abs(pnl);
      if (this.currentDrawdown > this.config.maxDrawdown) {
        this.isLocked = true;
        console.error('!!! BLACK SWAN DETECTED: SYSTEM LOCKED !!!');
      }
    } else {
      // Reset drawdown on win (simplified)
      this.currentDrawdown = Math.max(0, this.currentDrawdown - pnl);
    }
  }

  unlock() {
    this.isLocked = false;
    this.currentDrawdown = 0;
  }

  getStatus() {
    return {
      isLocked: this.isLocked,
      currentDrawdown: this.currentDrawdown,
      lastTradeTime: this.lastTradeTime
    };
  }
}
