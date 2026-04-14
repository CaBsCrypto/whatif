import { VortexScanner, BlockchainEvent } from './vortex_scanner';
import { VenomAuditor } from './venom_auditor';
import { MatrixEngine } from './matrix_engine';
import { RiskManager } from './risk_manager';
import { CipherEngine } from './cipher_engine';
import { QuantumStrategy } from './strategy';
import { GhostAgent } from './ghost_agent';
import { SupabaseService } from '../services/supabaseService';
import { TradeSignal } from '../types';

import { Logger } from '../services/logger';

export class QuantumBrain {
  private static isRunning = false;
  private static riskManager = new RiskManager({
    maxDrawdown: 500,
    maxPositionSizeUsd: 1000,
    killSwitchLatencyMs: 2000,
    coolDownPeriodMs: 5000,
    tierLimits: {
      1: { maxSizeUsd: 1000, minConfidence: 0.6, stopLoss: 2.0 },
      2: { maxSizeUsd: 500, minConfidence: 0.75, stopLoss: 3.0 },
      3: { maxSizeUsd: 200, minConfidence: 0.9, stopLoss: 5.0 },
      4: { maxSizeUsd: 50, minConfidence: 0.95, stopLoss: 10.0 }
    }
  });

  static init() {
    if (this.isRunning) return;
    this.isRunning = true;

    Logger.log('info', 'QuantumAlpha Brain Initialized. Listening for opportunities...');

    VortexScanner.subscribe(async (event: BlockchainEvent) => {
      await this.processEvent(event);
    });

    // Start Ghost Insider Tracking Loop
    setInterval(async () => {
      const watchlist = GhostAgent.getWatchlist();
      for (const wallet of watchlist) {
        const signal = await GhostAgent.trackWallet(wallet.address);
        if (signal) {
          await this.executeSignal(signal);
        }
      }
    }, 30000); // Check every 30s
  }

  /**
   * Manually trigger a simulated event for testing
   */
  static async triggerSimulation() {
    Logger.log('info', '🛠️ Manual Simulation Triggered');
    const mockEvent: BlockchainEvent = {
      type: 'NEW_PAIR',
      tokenAddress: '0x' + Math.random().toString(16).slice(2, 10),
      network: 'base',
      data: {},
      timestamp: Date.now()
    };
    await this.processEvent(mockEvent);
  }

  private static async processEvent(event: BlockchainEvent) {
    Logger.log('info', `Processing event: ${event.type} for ${event.tokenAddress}`);

    const audit = await VenomAuditor.auditContract(event.tokenAddress, event.network);
    const mockPrices = Array.from({ length: 20 }, () => 100 + Math.random() * 10);
    const strategy = QuantumStrategy.evaluate(mockPrices, audit, null);

    if (!strategy.shouldTrade) {
      Logger.log('warn', `Strategy HOLD: ${strategy.reason}`);
      return;
    }

    const signal: TradeSignal = {
      network: event.network,
      tokenAddress: event.tokenAddress,
      action: 'BUY',
      amount: '0.001', // Small amount for safety
      tier: 3, 
      confidence: strategy.confidence,
      reason: strategy.reason
    };

    await this.executeSignal(signal);
  }

  private static async executeSignal(signal: TradeSignal) {
    const riskCheck = this.riskManager.validateSignal(signal, 50);
    if (!riskCheck.valid) {
      Logger.log('warn', `AEGIS blocked trade: ${riskCheck.reason}`);
      return;
    }

    Logger.log('info', `ALL SYSTEMS GO. Dispatching CIPHER for ${signal.tokenAddress}`);
    const result = await CipherEngine.executeTrade(signal, signal.network);

    // Persist to Supabase
    try {
      await SupabaseService.saveTrade({
        timestamp: Date.now(),
        network: signal.network,
        tokenAddress: signal.tokenAddress,
        action: signal.action as 'BUY' | 'SELL',
        amount: signal.amount,
        txHash: result.txHash,
        status: result.success ? 'SUCCESS' : 'FAILED',
        error: result.error,
        tier: signal.tier,
        reason: signal.reason
      });
    } catch (e) {
      Logger.log('error', `Failed to save trade to Supabase: ${e}`);
    }

    if (result.success) {
      Logger.log('success', `TRADE EXECUTED SUCCESSFULLY. Tx: ${result.txHash}`);
      this.riskManager.recordTrade(true, 50);
    } else {
      Logger.log('error', `EXECUTION FAILED: ${result.error}`);
      this.riskManager.recordTrade(false, 10);
    }
  }
}
