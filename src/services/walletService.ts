import { ethers } from 'ethers';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { Network, WalletInfo } from '../types';

export class WalletService {
  private static baseProvider = new ethers.JsonRpcProvider(process.env.BASE_RPC_PRIMARY || 'https://mainnet.base.org');
  private static solanaConnection = new Connection(process.env.SOLANA_RPC_PRIMARY || 'https://api.mainnet-beta.solana.com');

  static async getWallets(): Promise<WalletInfo[]> {
    const wallets: WalletInfo[] = [];
    
    const baseWallet = await this.getBaseWallet();
    if (baseWallet) wallets.push(baseWallet);
    
    const solanaWallet = await this.getSolanaWallet();
    if (solanaWallet) wallets.push(solanaWallet);
    
    return wallets;
  }

  private static async getBaseWallet(): Promise<WalletInfo | null> {
    const key = process.env.BASE_PRIVATE_KEY;
    if (!key) return null;
    try {
      const wallet = new ethers.Wallet(key, this.baseProvider);
      const balance = await this.baseProvider.getBalance(wallet.address);
      return {
        address: wallet.address,
        network: 'base' as Network,
        balances: [{
          network: 'base' as Network,
          symbol: 'ETH',
          balance: ethers.formatEther(balance),
          valueUsd: 0 
        }]
      };
    } catch (e) {
      console.error('Error loading Base wallet:', e);
      return null;
    }
  }

  private static async getSolanaWallet(): Promise<WalletInfo | null> {
    const key = process.env.SOLANA_PRIVATE_KEY;
    if (!key) return null;
    try {
      const secretKey = bs58.decode(key);
      const keypair = Keypair.fromSecretKey(secretKey);
      const balance = await this.solanaConnection.getBalance(keypair.publicKey);
      return {
        address: keypair.publicKey.toBase58(),
        network: 'solana' as Network,
        balances: [{
          network: 'solana' as Network,
          symbol: 'SOL',
          balance: (balance / LAMPORTS_PER_SOL).toString(),
          valueUsd: 0
        }]
      };
    } catch (e) {
      console.error('Error loading Solana wallet:', e);
      return null;
    }
  }
}
