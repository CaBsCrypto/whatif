import { Network, TradeSignal } from '../types';

// SAFETY FLAG: If PAPER_GHOST is not 'true', GHOST will not emit any signals.
// In production, connect to Arkham Intelligence or Birdeye API and remove this flag.
const PAPER_GHOST = process.env.PAPER_GHOST === 'true';

export interface InsiderWallet {
  address: string;
  label: string;
  winRate: number;
  lastTrade?: number;
}

export class GhostAgent {
  private static watchlist: InsiderWallet[] = [
    { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', label: 'Smart Whale 1', winRate: 0.85 },
    { address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', label: 'Alpha Insider', winRate: 0.92 },
  ];

  /**
   * Tracks activity for a specific wallet.
   * In production, this would use a specialized API like Arkham or Birdeye.
   */
  static async trackWallet(address: string): Promise<TradeSignal | null> {
    // SAFETY: Only emit signals in paper mode until Arkham/Birdeye is connected
    if (!PAPER_GHOST) {
      // Production mode: requires real API integration
      // TODO: Replace with Arkham Intelligence API call:
      // GET https://api.arkhamintelligence.com/transfers?address=${address}&limit=10
      console.log(`[GHOST] [LIVE MODE - REAL API REQUIRED] Skipping simulated signal for: ${address}`);
      return null;
    }

    console.log(`[GHOST] [PAPER] Scanning activity for insider: ${address}...`);
    
    // Simulated detection — only active in paper mode
    const isActive = Math.random() > 0.95; // ~5% trigger rate per check
    
    if (isActive) {
      console.log(`[GHOST] 🎯 [PAPER] Insider ${address} detected buying!`);
      return {
        network: 'base',
        tokenAddress: '0x' + Math.random().toString(16).slice(2, 10),
        action: 'BUY',
        amount: '0.5',
        tier: 4, // Moonshots/Insiders
        confidence: 0.95,
        reason: `GHOST [PAPER]: Simulated copy-trade from high-winrate insider ${address}`
      };
    }

    return null;
  }

  static getWatchlist(): InsiderWallet[] {
    return this.watchlist;
  }

  static addWallet(wallet: InsiderWallet) {
    this.watchlist.push(wallet);
  }
}
