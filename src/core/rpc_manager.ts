import { ethers } from 'ethers';
import { Connection } from '@solana/web3.js';
import { RPCConfig, Network } from '../types';

export class RPCManager {
  private baseProvider: ethers.JsonRpcProvider | null = null;
  private solanaConnection: Connection | null = null;
  private currentBaseUrl: string;
  private currentSolanaUrl: string;

  constructor(
    private baseConfig: RPCConfig,
    private solanaConfig: RPCConfig
  ) {
    this.currentBaseUrl = baseConfig.primary;
    this.currentSolanaUrl = solanaConfig.primary;
  }

  /**
   * Initializes providers and tests latency
   */
  async initialize() {
    await Promise.all([
      this.initBase(),
      this.initSolana()
    ]);
  }

  private async initBase() {
    try {
      const provider = new ethers.JsonRpcProvider(this.currentBaseUrl);
      const start = Date.now();
      await provider.getBlockNumber();
      const latency = Date.now() - start;

      if (latency > this.baseConfig.timeoutMs) {
        console.warn(`[RPC] Base Primary latency high: ${latency}ms. Switching to Secondary.`);
        this.currentBaseUrl = this.baseConfig.secondary;
        this.baseProvider = new ethers.JsonRpcProvider(this.currentBaseUrl);
      } else {
        this.baseProvider = provider;
        console.log(`[RPC] Base Primary connected: ${latency}ms`);
      }
    } catch (error) {
      console.error(`[RPC] Base Primary failed. Switching to Secondary.`, error);
      this.currentBaseUrl = this.baseConfig.secondary;
      this.baseProvider = new ethers.JsonRpcProvider(this.currentBaseUrl);
    }
  }

  private async initSolana() {
    try {
      const connection = new Connection(this.currentSolanaUrl, 'confirmed');
      const start = Date.now();
      await connection.getSlot();
      const latency = Date.now() - start;

      if (latency > this.solanaConfig.timeoutMs) {
        console.warn(`[RPC] Solana Primary latency high: ${latency}ms. Switching to Secondary.`);
        this.currentSolanaUrl = this.solanaConfig.secondary;
        this.solanaConnection = new Connection(this.currentSolanaUrl, 'confirmed');
      } else {
        this.solanaConnection = connection;
        console.log(`[RPC] Solana Primary connected: ${latency}ms`);
      }
    } catch (error) {
      console.error(`[RPC] Solana Primary failed. Switching to Secondary.`, error);
      this.currentSolanaUrl = this.solanaConfig.secondary;
      this.solanaConnection = new Connection(this.currentSolanaUrl, 'confirmed');
    }
  }

  getBaseProvider(): ethers.JsonRpcProvider {
    if (!this.baseProvider) throw new Error('Base provider not initialized');
    return this.baseProvider;
  }

  getSolanaConnection(): Connection {
    if (!this.solanaConnection) throw new Error('Solana connection not initialized');
    return this.solanaConnection;
  }

  async checkHealth(): Promise<Record<Network, { latency: number; url: string }>> {
    const results: any = {};

    // Check Base
    const baseStart = Date.now();
    await this.baseProvider?.getBlockNumber();
    results.base = { latency: Date.now() - baseStart, url: this.currentBaseUrl };

    // Check Solana
    const solanaStart = Date.now();
    await this.solanaConnection?.getSlot();
    results.solana = { latency: Date.now() - solanaStart, url: this.currentSolanaUrl };

    return results;
  }
}
