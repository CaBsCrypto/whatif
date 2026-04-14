export type Network = 'base' | 'solana';

export interface RPCConfig {
  primary: string;
  secondary: string;
  timeoutMs: number;
}

export interface TradeSignal {
  network: Network;
  tokenAddress: string;
  action: 'BUY' | 'SELL';
  amount: string;
  tier: 1 | 2 | 3 | 4;
  confidence: number;
  reason: string;
}

export interface AgentStatus {
  name: string;
  status: 'IDLE' | 'SCANNING' | 'EXECUTING' | 'ERROR';
  lastUpdate: number;
  metrics?: Record<string, any>;
}

export interface WalletBalance {
  network: Network;
  symbol: string;
  balance: string;
  valueUsd: number;
}

export interface WalletInfo {
  address: string;
  network: Network;
  balances: WalletBalance[];
}
