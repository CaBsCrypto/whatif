# QuantumAlpha v9.0 - Project Instructions & Philosophy

## 1. Vision & Role
QuantumAlpha is a 100% autonomous multi-chain HFT (High-Frequency Trading) hedge fund. It operates as a swarm of AI agents specialized in the "Barbell Strategy" and asymmetric warfare on Base L2 and Solana.

## 2. The Agent Swarm
- **VORTEX:** Real-time data ingestion and block scanning (`vortex_scanner.ts`).
- **MATRIX:** Quantitative engine (RSI, EMA, VWAP, Order Flow) (`matrix_engine.ts`).
- **PSYCHE:** AI Sentiment Agent (Gemini 3 Flash) analyzing social narratives (`geminiService.ts`).
- **GHOST:** Insider tracking and copy-trading of "Smart Money" wallets.
- **VENOM:** Cyber-intelligence and contract auditor (Rugpull/Honeypot detection) (`venom_auditor.ts`).
- **AEGIS:** Risk Management (The 4 Tiers, Kill-Switch, Drawdown control) (`risk_manager.ts`).
- **CIPHER:** Execution engine and transaction signer (`cipher_engine.ts`).
- **BRAIN:** Orchestration layer that coordinates all agents (`quantum_brain.ts`).
- **STRATEGY:** Decision logic based on the Barbell Strategy (`strategy.ts`).

## 3. Core Rules (The 4 Tiers)
- **Tier 1 (Core):** Low risk, high liquidity, long-term positions.
- **Tier 2 (Alpha):** Mid-cap tokens with strong momentum.
- **Tier 3 (Degens):** High-risk micro-caps, insider tracking.
- **Tier 4 (Moonshots):** Extreme risk, asymmetric bets.

## 4. Technical Constraints
- **Latency:** Sub-millisecond target for internal processing.
- **Safety:** No trade execution without VENOM audit (Score > 85).
- **Profitability:** PROFIT_GUARD must validate net profit after gas and API costs.
- **MEV:** Always use slippage protection and simulation before broadcasting.

## 5. Persistence & Stack
- **Frontend:** React + Vite + Tailwind + Framer Motion + Recharts.
- **Backend:** Node.js + Express + Socket.io.
- **Database:** Supabase (PostgreSQL) for trades and logs.
- **AI:** Google Gemini 3 Flash for market sentiment.
