import { ethers } from 'ethers';
import { Connection, Keypair, VersionedTransaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, Transaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import axios from 'axios';
import { TradeSignal, Network, NetworkArchitecture } from '../types';
import { Logger } from '../services/logger.js';

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: number;
  executionTimeMs: number;
}

export class CipherEngine {
  
  // Helpers para identificar arquitectura y nodos RPC
  private static getArchitecture(network: Network): NetworkArchitecture {
    if (network === 'solana') return 'SVM';
    return 'EVM';
  }

  private static getRpcForNetwork(network: Network): string {
    switch (network) {
      case 'base': return process.env.RPC_EVM_BASE || 'https://mainnet.base.org';
      case 'bnb': return process.env.RPC_EVM_BNB || 'https://bsc-dataseed.binance.org';
      case 'avax': return process.env.RPC_EVM_AVAX || 'https://api.avax.network/ext/bc/C/rpc';
      case 'monad': return process.env.RPC_EVM_MONAD || 'https://rpc.monad.testnet';
      case 'solana': return process.env.SOLANA_RPC_PRIMARY || 'https://api.mainnet-beta.solana.com';
      default: throw new Error(`UNKNOWN_NETWORK: ${network}`);
    }
  }

  /**
   * Enrutador Principal: Dirige la orden al adaptador correcto.
   */
  static async executeTrade(signal: TradeSignal, network: Network): Promise<ExecutionResult> {
    const start = Date.now();
    const architecture = this.getArchitecture(network);
    const key = architecture === 'EVM' ? process.env.EVM_PRIVATE_KEY : process.env.SOLANA_PRIVATE_KEY;
    
    // Fallback a Paper Trading si no hay llave real
    if (!key) {
      Logger.log('info', `[CIPHER] 📝 PAPER TRADING: Initiating simulated execution on ${network} for ${signal.tokenAddress}...`);
      await new Promise(resolve => setTimeout(resolve, 300)); // Latency Simulation
      return {
        success: true,
        txHash: `PAPER_${network}_${Math.random().toString(16).slice(2, 10)}`,
        executionTimeMs: Date.now() - start,
        gasUsed: architecture === 'EVM' ? 21000 : 0
      };
    }

    Logger.log('info', `[CIPHER] ⚡ REAL EXECUTION [${architecture}]: Initiating on ${network} para ${signal.tokenAddress}...`);

    try {
      if (architecture === 'EVM') {
        return await this.executeEvmTrade(signal, network, start);
      } else {
        return await this.executeSolanaTrade(signal, start);
      }
    } catch (error) {
      Logger.log('error', `[CIPHER] Execution Error en ${network}: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'UNKNOWN_EXECUTION_ERROR',
        executionTimeMs: Date.now() - start
      };
    }
  }

  /**
   * Adaptador EVM Universal (Base, BNB, AVAX, Monad)
   */
  private static async executeEvmTrade(signal: TradeSignal, network: Network, start: number): Promise<ExecutionResult> {
    const key = process.env.EVM_PRIVATE_KEY;
    if (!key) throw new Error('EVM_PRIVATE_KEY_MISSING');

    const provider = new ethers.JsonRpcProvider(this.getRpcForNetwork(network));
    const wallet = new ethers.Wallet(key, provider);
    const amountWei = ethers.parseEther(signal.amount).toString();

    // Integración multi-cadena (Odos / 0x / Native) - Abstracción de lógica
    Logger.log('info', `[CIPHER] Solicitando enrutamiento de liquidez en ${network}...`);
    
    // Aquí (en producción) iría la llamada a ODOS API o 0x usando el network. 
    // Mantenemos la lógica de la transacción agnóstica a la red usando el provider dinámico.
    
    // 👇 Simulando la cuota del agregador para mantener compatibilidad 
    // Reemplazar la URL y parámetros según Odos u otro agregador multi-cadena
    const targetRouter = '0x0000000000000000000000000000000000000000'; // Placeholder
    const mockCalldata = '0x';

    const txResponse = await wallet.sendTransaction({
      to: targetRouter,
      data: mockCalldata,
      value: BigInt('0') // BigInt(amountWei) si compramos con gas token (ETH/BNB/AVAX)
    });

    Logger.log('info', `[CIPHER] Transacción ${network} al aire: ${txResponse.hash}`);
    const receipt = await txResponse.wait();

    // Check Profit Preservation (The Vault Logic) post-trade
    await this.checkAndSecureWealth(wallet, network, 'EVM');

    return {
      success: true,
      txHash: receipt?.hash || txResponse.hash,
      executionTimeMs: Date.now() - start,
      gasUsed: Number(receipt?.gasUsed || 0)
    };
  }

  /**
   * Adaptador Solana (Mantiene arquitectura nativa usando Jupiter)
   */
  private static async executeSolanaTrade(signal: TradeSignal, start: number): Promise<ExecutionResult> {
    const key = process.env.SOLANA_PRIVATE_KEY;
    if (!key) throw new Error('SOLANA_PRIVATE_KEY_MISSING');

    const connection = new Connection(this.getRpcForNetwork('solana'));
    const secretKey = bs58.decode(key);
    const keypair = Keypair.fromSecretKey(secretKey);

    const amountLamports = Math.floor(parseFloat(signal.amount) * LAMPORTS_PER_SOL);
    const WSOL = 'So11111111111111111111111111111111111111112';

    const { data: quoteResponse } = await axios.get(
      `https://quote-api.jup.ag/v6/quote?inputMint=${WSOL}&outputMint=${signal.tokenAddress}&amount=${amountLamports}&slippageBps=50`
    );

    const { data: { swapTransaction } } = await axios.post('https://quote-api.jup.ag/v6/swap', {
      quoteResponse,
      userPublicKey: keypair.publicKey.toString(),
      wrapAndUnwrapSol: true,
    });

    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    transaction.sign([keypair]);

    const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
    
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight });

    // Check Profit Preservation
    await this.checkAndSecureWealth(keypair, 'solana', 'SVM', connection);

    return {
      success: true,
      txHash: signature,
      executionTimeMs: Date.now() - start
    };
  }

  /**
   * "The Vault" / Safe Wallet Logic
   * Retira ganancias automáticamente a la billetera fría al sobrepasar el límite.
   */
  private static async checkAndSecureWealth(account: any, network: Network, architecture: NetworkArchitecture, extraConn?: Connection) {
    const safeAddress = process.env.SAFE_WALLET_ADDRESS;
    const thresholdUsd = Number(process.env.PROFIT_TRANSFER_THRESHOLD_USD || 500);
    
    if (!safeAddress) return;

    try {
      if (architecture === 'EVM') {
        const wallet = account as ethers.Wallet;
        const balanceWei = await wallet.provider!.getBalance(wallet.address);
        const balanceFormatted = ethers.formatEther(balanceWei);
        
        // Simulación simple: asumiendo 1 token nativo > thresholdUSD (En la realidad llamaríamos al oráculo de precios)
        if (Number(balanceFormatted) > (thresholdUsd / 3000)) { // Usando 3000 as proxy para precio ETH promedio o similar (ajustar por red)
          Logger.log('warn', `[VAULT] 🔐 Asegurando ganancias on ${network}. Balance sobrepasó el límite.`);
          const tx = await wallet.sendTransaction({
            to: safeAddress,
            value: (balanceWei * 10n) / 100n // Enviar 10% del total a la caja fuerte
          });
          Logger.log('info', `[VAULT] Profit enviado a Safe Wallet: ${tx.hash}`);
        }
      } else if (architecture === 'SVM') {
        const keypair = account as Keypair;
        const balance = await extraConn!.getBalance(keypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;
        
        if (solBalance > (thresholdUsd / 150)) { // Usando 150 as proxy sol price
           Logger.log('warn', `[VAULT] 🔐 Asegurando ganancias on Solana.`);
           const safePubkey = new PublicKey(safeAddress);
           const tx = new Transaction().add(
             SystemProgram.transfer({
               fromPubkey: keypair.publicKey,
               toPubkey: safePubkey,
               lamports: Math.floor(balance * 0.1) // Enviar 10% de ganancia
             })
           );
           await sendAndConfirmTransaction(extraConn!, tx, [keypair]);
           Logger.log('info', `[VAULT] Profit enviado a Safe Wallet en Solana.`);
        }
      }
    } catch (e) {
      Logger.log('error', `[VAULT] Fallo envío a Safe Wallet: ${e}`);
    }
  }
}
