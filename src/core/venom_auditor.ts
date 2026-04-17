import axios from 'axios';
import { Network } from '../types';
import { Logger } from '../services/logger.js';

/**
 * VENOM CYBER-INTELLIGENCE - Contract Auditor
 * Analyzes smart contracts for malicious patterns and rug-pull risks.
 */

export interface AuditResult {
  isSafe: boolean;
  score: number; // 0-100
  warnings: string[];
  details: {
    isHoneypot: boolean;
    isMintable: boolean;
    isRenounced: boolean;
    liquidityLocked: boolean;
    sellTax: number;
    buyTax: number;
  };
}

export class VenomAuditor {
  /**
   * Performs a comprehensive audit on a contract address using GoPlus Security API
   */
  static async auditContract(address: string, network: Network): Promise<AuditResult> {
    Logger.log('info', `[VENOM] Auditing contract: ${address} on ${network}...`);
    
    try {
      let apiUrl = '';
      if (network === 'solana') {
        apiUrl = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`;
      } else {
        let chainId = '8453'; // Base fallback
        if (network === 'bnb') chainId = '56';
        if (network === 'avax') chainId = '43114';
        if (network === 'monad') chainId = '1'; // Monad not universally supported on GoPlus API, defaulting to ETH mainnet 1 or skipping.
        apiUrl = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`;
      }

      const response = await axios.get(apiUrl);
      const data = response.data;
      
      // If GoPlus doesn't know the token yet or returns error, we assume risk
      if (!data || data.code !== 1 || !data.result || !data.result[address.toLowerCase()]) {
        // Solana addresses are case-sensitive, so we need to fallback safely
        const key = Object.keys(data?.result || {})[0];
        if (!key) {
          throw new Error('No security data found for token');
        }
        address = key;
      }
      
      const tokenInfo = data.result[address.toLowerCase()] || data.result[address];
      
      let score = 100;
      let warnings: string[] = [];
      
      const isHoneypot = tokenInfo.is_honeypot === "1";
      const isMintable = tokenInfo.is_mintable === "1";
      // We parse taxes (GoPlus returns strings like "0.01" for 1%)
      const sellTax = parseFloat(tokenInfo.sell_tax || "0") * 100;
      const buyTax = parseFloat(tokenInfo.buy_tax || "0") * 100;
      
      if (isHoneypot) {
        score -= 100;
        warnings.push('HONEYPOT_DETECTED');
      }
      if (isMintable) {
        score -= 20;
        warnings.push('CONTRACT_IS_MINTABLE');
      }
      if (sellTax > 10) {
        score -= 30;
        warnings.push(`HIGH_SELL_TAX_${sellTax}%`);
      }
      if (tokenInfo.is_open_source === "0") {
        score -= 25;
        warnings.push('NOT_OPEN_SOURCE');
      }

      const isSafe = score >= 85 && !isHoneypot;

      return {
        isSafe,
        score: Math.max(0, score),
        warnings,
        details: {
          isHoneypot,
          isMintable,
          isRenounced: tokenInfo.owner_address === '' || tokenInfo.owner_change_balance === "0",
          liquidityLocked: tokenInfo.lp_holders && tokenInfo.lp_holders.some((h: any) => h.is_locked == 1),
          sellTax,
          buyTax
        }
      };

    } catch (error) {
      Logger.log('warn', `[VENOM] Audit failed for ${address}, returning SAFE=false. Error: ${error}`);
      return {
        isSafe: false,
        score: 0,
        warnings: ['AUDIT_API_FAILED', 'ASSUMING_MAXIMUM_RISK'],
        details: {
          isHoneypot: true,
          isMintable: true,
          isRenounced: false,
          liquidityLocked: false,
          sellTax: 99,
          buyTax: 99
        }
      };
    }
  }

  /**
   * Quick check for "Blacklisted" addresses
   */
  static isBlacklisted(address: string): boolean {
    const blacklist = ['0xdead...', '0xbad...'];
    return blacklist.includes(address.toLowerCase());
  }
}
