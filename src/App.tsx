import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Shield, 
  Zap, 
  Target, 
  Ghost, 
  Cpu, 
  BarChart3, 
  Terminal,
  AlertCircle,
  RefreshCw,
  Search,
  BrainCircuit,
  Settings,
  Radar,
  AlertTriangle,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { io, Socket } from 'socket.io-client';
import { AgentStatus, TradeSignal, WalletInfo } from './types';
import { analyzeMarketSentiment, getNarrativeRadar, type SentimentResult, type NarrativeRadarResult } from './services/geminiService';
import { MatrixEngine } from './core/matrix_engine';

// Initialize Brain
// QuantumBrain.init(); // Moved to server

const mockChartData = Array.from({ length: 20 }, (_, i) => ({
  time: i,
  value: 100 + Math.random() * 50 + (i * 2),
  volume: Math.random() * 1000
}));

export interface TradeRecordLocal {
  id: string;
  timestamp: number;
  network: string;
  tokenAddress: string;
  action: 'BUY' | 'SELL';
  amount: string;
  price?: number;
  txHash?: string;
  status: 'SUCCESS' | 'FAILED';
  tier: number;
  isPaperTrade?: boolean;
}

export default function App() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [logs, setLogs] = useState<{type: string, msg: string}[]>([]);
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [radar, setRadar] = useState<NarrativeRadarResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRadarLoading, setIsRadarLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [vortexEvents, setVortexEvents] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [marketStyle, setMarketStyle] = useState<'TRENDING' | 'RANGING' | 'VOLATILE'>('RANGING');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [trades, setTrades] = useState<TradeRecordLocal[]>([]);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [riskParams, setRiskParams] = useState({
    maxSlippage: 0.5,
    maxDrawdown: 5.0,
    minConfidence: 0.8,
    gasMultiplier: 1.1,
    tierLimits: {
      1: { maxSizeUsd: 1000, minConfidence: 0.6, stopLoss: 2.0 },
      2: { maxSizeUsd: 500, minConfidence: 0.75, stopLoss: 3.0 },
      3: { maxSizeUsd: 200, minConfidence: 0.9, stopLoss: 5.0 },
      4: { maxSizeUsd: 50, minConfidence: 0.95, stopLoss: 10.0 }
    }
  });
  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Socket Connection — uses VITE_API_URL in production (Google Cloud), same-origin in dev
    const backendUrl = import.meta.env.VITE_API_URL || '';
    socketRef.current = io(backendUrl);
    
    const fetchTrades = async () => {
      try {
        const res = await fetch('/api/trades');
        if (res.ok) {
          const data = await res.json();
          setTrades(data);
        }
      } catch (err) {
        console.error('Failed to fetch trades:', err);
      }
    };

    socketRef.current.on('log', (newLog) => {
      setLogs(prev => [...prev.slice(-50), newLog]);
      if (newLog.msg.includes('VORTEX: New Pair') || newLog.msg.includes('RAYDIUM LP INITIALIZATION DETECTED')) {
        setVortexEvents(prev => [{
          id: Date.now(),
          msg: newLog.msg,
          time: new Date().toLocaleTimeString()
        }, ...prev.slice(0, 4)]);
      }
    });

    socketRef.current.on('trade_update', () => {
      fetchTrades();
    });

    fetchTrades();

    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents', {
          headers: {
            'Accept': 'application/json'
          }
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Server error: ${res.status} ${res.statusText}. Response: ${text.substring(0, 100)}`);
        }
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
        }
        const data = await res.json();
        setAgents(data);
        setFetchError(null);
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        setFetchError(err instanceof Error ? err.message : 'Unknown connection error');
      }
    };

    const fetchWallets = async () => {
      try {
        const res = await fetch('/api/wallets');
        if (res.ok) {
          const data = await res.json();
          setWallets(data);
        }
      } catch (err) {
        console.error('Failed to fetch wallets:', err);
      }
    };

    fetchAgents();
    fetchWallets();
    const interval = setInterval(() => {
      fetchAgents();
      fetchWallets();
    }, 5000);

    // Initial market analysis
    const prices = mockChartData.map(d => d.value);
    const style = MatrixEngine.detectMarketStyle(prices);
    setMarketStyle(style);
    setRecommendations(MatrixEngine.recommendPairs(style));

    return () => {
      clearInterval(interval);
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleRunSentiment = async () => {
    setIsAnalyzing(true);
    // Mock social data for analysis
    const mockSocial = "Bitcoin is breaking resistance at 70k. Sentiment is high. Everyone is talking about Base L2 and Solana moonshots. Fear of missing out is kicking in.";
    
    try {
      const result = await analyzeMarketSentiment(mockSocial);
      setSentiment(result);
      
      setLogs(prev => [...prev, { 
        type: 'info', 
        msg: `[${new Date().toLocaleTimeString()}] PSYCHE: Analysis Complete. Label: ${result.label} (Score: ${result.score})` 
      }]);
    } catch (error) {
      console.error("Failed to analyze sentiment:", error);
      setLogs(prev => [...prev, { type: 'error', msg: `[${new Date().toLocaleTimeString()}] PSYCHE: Analysis Failed.` }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunRadar = async () => {
    setIsRadarLoading(true);
    const mockMarket = "Solana ecosystem is booming with memecoin volume. Base L2 is seeing massive inflows into Aerodrome. BTC is consolidating. AI agents are the new meta.";
    
    try {
      const result = await getNarrativeRadar(mockMarket);
      setRadar(result);
      setLogs(prev => [...prev, { 
        type: 'success', 
        msg: `[${new Date().toLocaleTimeString()}] PSYCHE: Narrative Radar Updated. Top Pick: ${result.topAssets[0]?.symbol}` 
      }]);
    } catch (error) {
      console.error("Failed to run radar:", error);
      setLogs(prev => [...prev, { type: 'error', msg: `[${new Date().toLocaleTimeString()}] PSYCHE: Radar Scan Failed.` }]);
    } finally {
      setIsRadarLoading(false);
    }
  };

  const handleSimulateEvent = async () => {
    setIsSimulating(true);
    try {
      await fetch('/api/simulate', { method: 'POST' });
    } catch (err) {
      console.error('Simulation failed:', err);
    }
    setTimeout(() => setIsSimulating(false), 1000);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--line)] p-4 flex justify-between items-center bg-[#0D0D0E]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-sm flex items-center justify-center">
            <Zap className="text-black w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tighter uppercase">QuantumAlpha <span className="text-[var(--accent)]">v9.0</span></h1>
            <p className="text-[10px] opacity-50 font-mono uppercase tracking-widest">Hyper-Alpha Edition // Autonomous Quant Swarm</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-3 py-1 bg-white/5 border border-white/10 rounded-sm">
            <span className="text-[9px] font-mono opacity-50 uppercase">System Status:</span>
            <div className="flex gap-1 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold text-green-400 font-mono">READY</span>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-[var(--line)]" />
          <div className="flex items-center gap-3 px-3 py-1 bg-white/5 border border-white/10 rounded-sm">
            <span className="text-[9px] font-mono opacity-50 uppercase">Execution Mode:</span>
            <div className="flex gap-1">
              <button onClick={() => setIsLiveMode(false)} className={`px-2 py-0.5 text-[9px] font-bold rounded-sm border transition-all ${!isLiveMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'opacity-20 translate-y-0.5 border-transparent text-white'}`}>PAPER</button>
              <button onClick={() => setIsLiveMode(true)} className={`px-2 py-0.5 text-[9px] font-bold rounded-sm border transition-all ${isLiveMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'opacity-20 translate-y-0.5 border-transparent text-white'}`}>LIVE</button>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-[var(--line)]" />
          <div className="text-right">
            <p className="text-[10px] opacity-50 uppercase font-mono">P/L (Est.)</p>
            <p className="text-sm font-mono text-[var(--accent)]">+---</p>
          </div>
          <div className="h-8 w-[1px] bg-[var(--line)]" />
          <button 
            onClick={handleSimulateEvent}
            disabled={isSimulating}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-sm hover:bg-blue-500/20 transition-all text-[10px] font-bold uppercase tracking-wider text-blue-400 disabled:opacity-50"
          >
            <Zap className={`w-3 h-3 ${isSimulating ? 'animate-pulse' : ''}`} />
            Simulate Event
          </button>
          <div className="h-8 w-[1px] bg-[var(--line)]" />
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-sm border transition-all ${showSettings ? 'bg-[var(--accent)] border-[var(--accent)] text-black' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
          >
            <Shield className="w-4 h-4" />
          </button>
          <div className="h-8 w-[1px] bg-[var(--line)]" />
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-mono">LIVE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-0 relative overflow-hidden">
        {/* Risk Settings Overlay */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-[#0D0D0E] border-l border-[var(--line)] z-50 p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--accent)]" />
                  AEGIS Parameters
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-[10px] opacity-40 hover:opacity-100 font-mono">CLOSE [X]</button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[9px] opacity-40 uppercase font-mono block mb-2">Max Slippage (%)</label>
                  <input 
                    type="range" min="0.1" max="5.0" step="0.1" 
                    value={riskParams.maxSlippage}
                    onChange={(e) => setRiskParams({...riskParams, maxSlippage: parseFloat(e.target.value)})}
                    className="w-full accent-[var(--accent)]" 
                  />
                  <div className="flex justify-between mt-1 font-mono text-[10px]">
                    <span>0.1%</span>
                    <span className="text-[var(--accent)]">{riskParams.maxSlippage}%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] opacity-40 uppercase font-mono block mb-2">Max Drawdown (Global %)</label>
                  <input 
                    type="range" min="1.0" max="20.0" step="0.5" 
                    value={riskParams.maxDrawdown}
                    onChange={(e) => setRiskParams({...riskParams, maxDrawdown: parseFloat(e.target.value)})}
                    className="w-full accent-red-500" 
                  />
                  <div className="flex justify-between mt-1 font-mono text-[10px]">
                    <span>1.0%</span>
                    <span className="text-red-400">{riskParams.maxDrawdown}%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] opacity-40 uppercase font-mono block mb-2">Min AI Confidence</label>
                  <input 
                    type="range" min="0.5" max="0.99" step="0.01" 
                    value={riskParams.minConfidence}
                    onChange={(e) => setRiskParams({...riskParams, minConfidence: parseFloat(e.target.value)})}
                    className="w-full accent-purple-500" 
                  />
                  <div className="flex justify-between mt-1 font-mono text-[10px]">
                    <span>0.50</span>
                    <span className="text-purple-400">{riskParams.minConfidence}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <button className="w-full py-3 bg-[var(--accent)] text-black text-[10px] font-bold uppercase tracking-widest rounded-sm hover:brightness-110 transition-all">
                    Apply Global Lock
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Sidebar: Agent Swarm */}
        <aside className="col-span-3 border-r border-[var(--line)] flex flex-col">
          <div className="p-4 border-b border-[var(--line)] flex justify-between items-center">
            <h2 className="col-header">Enjambre Quant</h2>
            <RefreshCw className="w-3 h-3 opacity-30 cursor-pointer hover:opacity-100 transition-opacity" />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence>
              {agents.map((agent) => (
                <motion.div 
                  key={agent.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 border-b border-[var(--line)] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {getAgentIcon(agent.name)}
                      <span className="font-mono text-xs font-bold">{agent.name}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                      agent.status === 'SCANNING' ? 'bg-blue-500/20 text-blue-400' :
                      agent.status === 'EXECUTING' ? 'bg-green-500/20 text-green-400' :
                      agent.status === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                  
                  {agent.metrics && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {Object.entries(agent.metrics).map(([key, val]) => (
                        <div key={key}>
                          <p className="text-[8px] opacity-40 uppercase">{key}</p>
                          <p className="text-[10px] font-mono">{val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="p-4 border-t border-[var(--line)] bg-white/[0.01]">
            <h2 className="col-header mb-4 flex items-center gap-2">
              <Wallet className="w-3 h-3" />
              Wallets Operativas
            </h2>
            <div className="space-y-4">
              {wallets.map((wallet) => (
                <div key={wallet.network} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-white/60">{wallet.network}</span>
                    <span className="text-[9px] font-mono opacity-30">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                  </div>
                  {wallet.balances.map((bal) => (
                    <div key={bal.symbol} className="flex justify-between items-end">
                      <span className="text-xs font-mono font-bold text-[var(--accent)]">{bal.balance} {bal.symbol}</span>
                      <span className="text-[9px] opacity-40 font-mono">${bal.valueUsd.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ))}
              {wallets.length === 0 && (
                <p className="text-[9px] opacity-30 italic">No hay wallets configuradas. Revise el archivo .env</p>
              )}
            </div>
          </div>

          <div className="p-4 bg-black/40 border-t border-[var(--line)]">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Kill-Switch Active</span>
            </div>
            <p className="text-[9px] opacity-40 leading-relaxed">
              Latency threshold: 2000ms. System will abort all operations if RPC delay exceeds limit.
            </p>
          </div>
        </aside>

        {/* Main Content: Charts & Execution */}
        <section className="col-span-9 flex flex-col bg-[#080809]">
          {/* Top Stats Bar */}
          <div className="grid grid-cols-4 border-b border-[var(--line)]">
            <div className="p-4 border-r border-[var(--line)]">
              <p className="col-header mb-1">24h PnL</p>
              <p className="text-xl font-mono text-[var(--accent)]">+$12,402.10</p>
              <p className="text-[10px] text-[var(--accent)] opacity-60">+1.24%</p>
            </div>
            <div className="p-4 border-r border-[var(--line)]">
              <p className="col-header mb-1">Win Rate</p>
              <p className="text-xl font-mono">68.4%</p>
              <p className="text-[10px] opacity-40">Last 500 trades</p>
            </div>
            <div className="p-4 border-r border-[var(--line)]">
              <p className="col-header mb-1">Gas Spent (24h)</p>
              <p className="text-xl font-mono">$42.15</p>
              <p className="text-[10px] opacity-40">Base: $2.10 | Solana: $40.05</p>
            </div>
            <div className="p-4">
              <p className="col-header mb-1">Active Tiers</p>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4].map(t => (
                  <div key={t} className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-sm ${t === 4 ? 'bg-purple-500/20 text-purple-400' : 'bg-[var(--accent)]/20 text-[var(--accent)]'}`}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Section: Chart & AI Insights */}
          <div className="flex-1 grid grid-cols-3">
            <div className="col-span-2 p-6 border-r border-[var(--line)] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-tight">Performance Matrix</h3>
                  <p className="text-[10px] opacity-40 font-mono">PnL Curve (Estimated value from buys over time)</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[10px] font-mono rounded-sm text-[var(--accent)]">ALL VORTEX EVENTS</button>
                </div>
              </div>

              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trades.length > 0 ? trades.map((t, i) => ({ time: i, value: 100 + i * 2, volume: Math.random() * 500 })) : mockChartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F1F22" vertical={false} />
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0D0D0E', border: '1px solid #1F1F22', borderRadius: '4px' }}
                      itemStyle={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--accent)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                    <Area type="monotone" dataKey="volume" stroke="#8884d8" fillOpacity={0.1} fill="#8884d8" strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* Recent Trades Panel under the chart */}
              <div className="mt-4 border-t border-[var(--line)] pt-4 max-h-[150px] overflow-y-auto">
                <h4 className="text-[10px] font-bold uppercase mb-2 opacity-50">Recent System Missions</h4>
                <div className="space-y-1">
                  {trades.filter(t => isLiveMode ? t.isPaperTrade !== true : true).slice(0, 5).map((t, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/5 p-2 rounded-sm border border-white/10 text-[9px] font-mono">
                      <div className="flex items-center gap-4">
                        <span className={t.action === 'BUY' ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{t.action}</span>
                        <span className="opacity-80 truncate max-w-[100px]">{t.tokenAddress}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="opacity-60">{t.amount} {t.network === 'solana' ? 'SOL' : 'ETH'}</span>
                        <span className={t.isPaperTrade ? 'text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded-sm' : 'text-orange-400 bg-orange-500/10 px-1 py-0.5'}>
                          {t.isPaperTrade ? 'PAPER' : 'LIVE'}
                        </span>
                        <span className={t.status === 'SUCCESS' ? 'text-green-500' : 'text-red-500'}>[{t.status}]</span>
                      </div>
                    </div>
                  ))}
                  {trades.length === 0 && <p className="text-[10px] opacity-30 text-center py-2 italic font-mono">- No transactions logged in database -</p>}
                </div>
              </div>
            </div>

            {/* Market Intelligence */}
            <div className="p-6 border-t border-[var(--line)] bg-white/[0.01]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Market Intelligence
                </h3>
                <div className={`px-2 py-0.5 rounded-sm text-[9px] font-bold border ${
                  marketStyle === 'TRENDING' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                  marketStyle === 'VOLATILE' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  'bg-blue-500/10 border-blue-500/30 text-blue-400'
                }`}>
                  {marketStyle}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {recommendations.map((pair, idx) => (
                  <div key={idx} className="p-3 bg-white/5 border border-white/10 rounded-sm flex flex-col gap-1">
                    <span className="text-[8px] opacity-40 uppercase">Recommended Pair</span>
                    <span className="text-xs font-bold font-mono text-[var(--accent)]">{pair}</span>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1 h-1 rounded-full bg-green-500" />
                      <span className="text-[8px] opacity-60">Optimum Liquidity</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Narrative Radar Section */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                    <Radar className="w-4 h-4 text-orange-400" />
                    Narrative Radar
                  </h3>
                  <button 
                    onClick={handleRunRadar}
                    disabled={isRadarLoading}
                    className="text-[10px] font-bold text-orange-400 hover:underline disabled:opacity-50"
                  >
                    {isRadarLoading ? 'SCANNING...' : 'RUN SCAN'}
                  </button>
                </div>

                {radar ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-sm">
                      <p className="text-[10px] text-orange-400 font-bold uppercase mb-1">Current Narrative</p>
                      <p className="text-xs opacity-80">{radar.marketNarrative}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {radar.topAssets.map((asset, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white/5 border border-white/10 rounded-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-[10px] font-bold">
                              {asset.symbol[0]}
                            </div>
                            <div>
                              <p className="text-xs font-bold">{asset.symbol}</p>
                              <p className="text-[9px] opacity-40">Tier {asset.tier} • {asset.potential} Potential</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] opacity-60 max-w-[150px] truncate">{asset.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 border border-dashed border-white/10 rounded-sm text-center">
                    <p className="text-[10px] opacity-40">No radar data. Run scan to identify high-potential assets.</p>
                  </div>
                )}
              </div>

              {/* AEGIS Risk Control Panel */}
              <div className="mt-8 pt-8 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    AEGIS Risk Control
                  </h3>
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] opacity-40 uppercase font-mono">Shield Active</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] opacity-60">Max Drawdown</span>
                      <span className="text-[10px] font-mono text-red-400">{riskParams.maxDrawdown}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" max="20" step="0.5"
                      value={riskParams.maxDrawdown}
                      onChange={(e) => setRiskParams(prev => ({ ...prev, maxDrawdown: parseFloat(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] opacity-60">Max Slippage</span>
                      <span className="text-[10px] font-mono text-[var(--accent)]">{riskParams.maxSlippage}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" max="5" step="0.1"
                      value={riskParams.maxSlippage}
                      onChange={(e) => setRiskParams(prev => ({ ...prev, maxSlippage: parseFloat(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                    />
                  </div>

                  <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-sm">
                    <p className="text-[9px] text-red-400 font-bold uppercase mb-2">Tier Exposure</p>
                    <div className="space-y-2">
                      {Object.entries(riskParams.tierLimits).map(([tier, limit]: [string, any]) => (
                        <div key={tier} className="flex justify-between items-center text-[9px]">
                          <span className="opacity-40">Tier {tier}</span>
                          <span className="font-mono">${limit.maxSizeUsd} Max</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights & Vortex Feed */}
            <div className="p-0 flex flex-col bg-white/[0.01]">
              {/* AI Insights */}
              <div className="p-6 border-b border-[var(--line)]">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-purple-400" />
                    PSYCHE Insights
                  </h3>
                  <button 
                    onClick={handleRunSentiment}
                    disabled={isAnalyzing}
                    className="p-1.5 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    <Search className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {sentiment ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="p-3 bg-white/5 border border-white/10 rounded-sm">
                      <p className="text-[8px] opacity-40 uppercase mb-1">Market Sentiment</p>
                      <div className="flex justify-between items-end">
                        <span className={`text-lg font-bold ${sentiment.label === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>
                          {sentiment.label}
                        </span>
                        <span className="text-xs font-mono opacity-60">Score: {sentiment.score}</span>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-[8px] opacity-40 uppercase mb-1">Current Narrative</p>
                      <p className="text-[11px] leading-relaxed opacity-80 italic">
                        "{sentiment.narrative}"
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center opacity-20 py-4">
                    <BrainCircuit className="w-8 h-8 mb-2" />
                    <p className="text-[9px] uppercase font-mono">No analysis</p>
                  </div>
                )}
              </div>

              {/* Vortex Feed */}
              <div className="flex-1 p-6 flex flex-col overflow-hidden">
                <h3 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-blue-400" />
                  VORTEX Live Feed
                </h3>
                <div className="flex-1 space-y-3 overflow-y-auto">
                  <AnimatePresence>
                    {vortexEvents.length > 0 ? vortexEvents.map((event) => (
                      <motion.div 
                        key={event.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-2 bg-blue-500/5 border border-blue-500/10 rounded-sm"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[8px] font-mono text-blue-400">NEW_PAIR</span>
                          <span className="text-[8px] opacity-30">{event.time}</span>
                        </div>
                        <p className="text-[10px] font-mono truncate opacity-80">{event.msg.split(': ')[2]}</p>
                      </motion.div>
                    )) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20">
                        <Activity className="w-8 h-8 mb-2" />
                        <p className="text-[9px] uppercase font-mono">Scanning Blocks...</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Terminal / Logs */}
          <div className="h-48 border-t border-[var(--line)] bg-black/60 p-4 font-mono text-[10px] overflow-y-auto">
            <div className="flex items-center gap-2 mb-2 opacity-50 sticky top-0 bg-black/60 py-1">
              <Terminal className="w-3 h-3" />
              <span className="uppercase">System Logs</span>
            </div>
            <div className="space-y-1">
              {logs.map((log, i) => (
                <p key={i} className={
                  log.type === 'success' ? 'text-green-400' : 
                  log.type === 'warn' ? 'text-yellow-400' : 
                  log.type === 'error' ? 'text-red-400' : 
                  'text-blue-400'
                }>
                  {log.msg}
                </p>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] p-2 px-4 flex justify-between items-center bg-[#0D0D0E] text-[9px] font-mono opacity-50 uppercase tracking-widest">
        <div className="flex gap-4">
          <span>Base RPC: OK (12ms)</span>
          <span>Solana RPC: OK (45ms)</span>
        </div>
        <div className="flex gap-4">
          <span>Memory: 124MB / 512MB</span>
          <span>CPU: 12%</span>
          <span>Uptime: 24h 12m 05s</span>
        </div>
      </footer>
    </div>
  );
}

function getAgentIcon(name: string) {
  const props = { className: "w-4 h-4 opacity-70" };
  switch (name) {
    case 'VORTEX': return <Activity {...props} />;
    case 'MATRIX': return <Cpu {...props} />;
    case 'PSYCHE': return <BrainCircuit {...props} />;
    case 'GHOST': return <Ghost {...props} />;
    case 'VENOM': return <Target {...props} />;
    case 'AEGIS': return <Shield {...props} />;
    case 'CIPHER': return <Terminal {...props} />;
    default: return <Activity {...props} />;
  }
}

