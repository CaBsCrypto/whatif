import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  // Use process.env for server-side compatibility
  const supabaseUrl = process.env.VITE_SUPABASE_URL || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined);
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined);

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
};

export interface TradeRecord {
  id?: string;
  timestamp: number;
  network: string;
  tokenAddress: string;
  action: 'BUY' | 'SELL';
  amount: string;
  price?: number;
  txHash?: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  tier: number;
  reason: string;
}

export class SupabaseService {
  static async saveTrade(record: TradeRecord) {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('[SUPABASE] Missing credentials. Trade not saved to DB.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('trades')
        .insert([record]);

      if (error) throw error;
      console.log('[SUPABASE] Trade record persisted successfully.');
      return data;
    } catch (error) {
      console.error('[SUPABASE] Error saving trade:', error);
    }
  }

  static async getTradeHistory() {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn('[SUPABASE] Missing credentials. Cannot fetch history.');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[SUPABASE] Error fetching history:', error);
      return [];
    }
  }
}
