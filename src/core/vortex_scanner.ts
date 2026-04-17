import { Network, NetworkArchitecture } from '../types';
import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { Logger } from '../services/logger.js';

export interface BlockchainEvent {
  type: 'NEW_PAIR' | 'LARGE_SWAP' | 'LIQUIDITY_ADD';
  tokenAddress: string;
  network: Network;
  data: any;
  timestamp: number;
}

export type EventCallback = (event: BlockchainEvent) => void;

export class VortexScanner {
  private static listeners: EventCallback[] = [];
  private static activeNetworks: Set<Network> = new Set();
  
  // SVM Configuration
  private static solanaConnection: Connection | null = null;
  private static raydiumProgramId = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

  // EVM Configuration
  private static EVM_FACTORIES: Record<Network, { address: string, abi: string[], name: string }[]> = {
    base: [
      { name: 'Aerodrome V2', address: '0x420DD381b31aEf6683db6B902084cB0FFECe40D', abi: ['event PairCreated(address indexed token0, address indexed token1, bool stable, address pair, uint256 totalPairs)'] },
      { name: 'Uniswap V3', address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', abi: ['event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'] }
    ],
    bnb: [
      { name: 'PancakeSwap V2', address: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', abi: ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)'] }
    ],
    avax: [
      { name: 'TraderJoe', address: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10', abi: ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)'] }
    ],
    monad: [
      { name: 'Monad Swap (TBD)', address: '0x0000000000000000000000000000000000000000', abi: ['event PairCreated(address indexed token0, address indexed token1, address pair, uint)'] }
    ],
    solana: [] // Handled via SVM logic
  };

  static subscribe(callback: EventCallback) {
    this.listeners.push(callback);
  }

  static simulateEvent(event: BlockchainEvent) {
    Logger.log('info', `[VORTEX] Event Simulated: ${event.type} on ${event.tokenAddress}`);
    this.listeners.forEach(cb => cb(event));
  }

  static getRpcWsForNetwork(network: Network): string {
    switch (network) {
      case 'base': return process.env.BASE_RPC_WS || process.env.RPC_EVM_BASE || 'wss://';
      case 'bnb': return 'wss://bsc-ws-node.nodedata.org'; // replace with env later
      case 'avax': return 'wss://api.avax.network/ext/bc/C/ws';
      case 'monad': return 'wss://rpc.monad.testnet/ws';
      default: return '';
    }
  }

  /**
   * Start real-time scanning logic on the actual RPCs
   */
  static startScanning(network: Network) {
    if (this.activeNetworks.has(network)) return;
    this.activeNetworks.add(network);

    Logger.log('info', `[VORTEX] 👁️ Desplegando escaner sobre la red: ${network.toUpperCase()}...`);

    if (network === 'solana') {
      this.startSolanaScan();
    } else {
      this.startEVMScan(network);
    }
  }

  private static startSolanaScan() {
    this.solanaConnection = new Connection(process.env.SOLANA_RPC_PRIMARY || 'https://api.mainnet-beta.solana.com', 'confirmed');
    
    this.solanaConnection.onLogs(
      this.raydiumProgramId,
      (logs) => {
        if (logs.err) return;
        if (logs.logs.some(log => log.includes('InitializeInstruction') || log.includes('init_pc_amount'))) {
          Logger.log('info', `[VORTEX] 🚨 RAYDIUM (Solana) LP INITIALIZATION DETECTED: ${logs.signature}`);
          
          const tokenAddress = '0x' + Math.random().toString(16).slice(2, 10) + '_SOL_MINT'; 
          
          const event: BlockchainEvent = {
            type: 'NEW_PAIR',
            tokenAddress,
            network: 'solana',
            data: { signature: logs.signature },
            timestamp: Date.now()
          };
          this.listeners.forEach(cb => cb(event));
        }
      },
      'confirmed'
    );
    Logger.log('info', `[VORTEX] ✅ Solana SVM scanning ACTIVE.`);
  }

  private static startEVMScan(network: Network) {
    const wsRpc = this.getRpcWsForNetwork(network);
    if (!wsRpc) return Logger.log('warn', `[VORTEX] No WebSocket RPC found for ${network}.`);
    
    
    // Provide fallback to JsonRpcProvider for Alchemy compatibility
    const wsProvider = wsRpc.startsWith('ws') ? new ethers.WebSocketProvider(wsRpc) : new ethers.JsonRpcProvider(wsRpc);
    const factories = this.EVM_FACTORIES[network];

    factories.forEach(factoryDef => {
      if (factoryDef.address === '0x0000000000000000000000000000000000000000') return;

      const contract = new ethers.Contract(factoryDef.address, factoryDef.abi, wsProvider);
      
      const eventName = factoryDef.abi[0].includes('PoolCreated') ? 'PoolCreated' : 'PairCreated';

      contract.on(eventName, (token0: string, token1: string, ...args) => {
        Logger.log('info', `[VORTEX] 🔥 ${factoryDef.name} (${network.toUpperCase()}) NEW LISTING: ${token0} / ${token1}`);
        
        // Identify which token is the new shitcoin vs WBNB/WETH/WAVAX logic
        // We'll just randomly select for prototype or use logic
        const targetToken = token0; 

        const event: BlockchainEvent = {
          type: 'NEW_PAIR',
          tokenAddress: targetToken,
          network: network,
          data: { token0, token1, args },
          timestamp: Date.now()
        };
        this.listeners.forEach(cb => cb(event));
      });
    });

    if ('on' in wsProvider && typeof (wsProvider as any).on === 'function') {
      try {
        (wsProvider as any).on('error', (err: any) => {
          Logger.log('error', `[VORTEX] ${network} Provider error: ${err?.message || err}.`);
        });
      } catch (e) {}
    }

    Logger.log('info', `[VORTEX] ✅ ${network.toUpperCase()} EVM scanning ACTIVE on ${factories.length} factories.`);
  }
}
