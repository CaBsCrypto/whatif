import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "http";

console.log("DEBUG: server.ts is starting...");

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { WalletService } from "./src/services/walletService";
import { Logger } from "./src/services/logger";
import { QuantumBrain } from "./src/core/quantum_brain";

// Allowed origins: localhost for dev, Vercel URL for production
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL || "", // e.g. https://quantumalpha.vercel.app
].filter(Boolean);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ["GET", "POST"],
    },
  });
  const PORT = 3000;

  // Initialize Core Services
  Logger.init(io);
  QuantumBrain.init(io);

  app.use(express.json());

  // Global Request Logger
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url} - Accept: ${req.headers.accept}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    console.log("[API] Health check hit");
    res.json({ status: "QuantumAlpha Core Online", timestamp: Date.now() });
  });

  app.get("/api/wallets", async (req, res) => {
    try {
      const wallets = await WalletService.getWallets();
      res.json(wallets);
    } catch (error) {
      console.error("Error fetching wallets:", error);
      res.status(500).json({ error: "Failed to fetch wallets" });
    }
  });

  app.get("/api/trades", async (req, res) => {
    try {
      // Lazy load to avoid circular dependencies locally 
      const { SupabaseService } = await import("./src/services/supabaseService");
      const history = await SupabaseService.getTradeHistory();
      res.json(history || []);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  app.post("/api/simulate", async (req, res) => {
    try {
      await QuantumBrain.triggerSimulation();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Simulation failed" });
    }
  });

  const agents = [
    { name: "VORTEX", status: "SCANNING", lastUpdate: Date.now(), metrics: { latency: "45ms", tps: 120 } },
    { name: "MATRIX", status: "IDLE", lastUpdate: Date.now(), metrics: { alpha: 0.12 } },
    { name: "PSYCHE", status: "SCANNING", lastUpdate: Date.now(), metrics: { sentiment: "Bullish" } },
    { name: "GHOST", status: "SCANNING", lastUpdate: Date.now(), metrics: { tracked_wallets: 500 } },
    { name: "VENOM", status: "IDLE", lastUpdate: Date.now() },
    { name: "AEGIS", status: "IDLE", lastUpdate: Date.now(), metrics: { risk_level: "Low" } },
    { name: "CIPHER", status: "IDLE", lastUpdate: Date.now() },
  ];

  app.get("/api/agents", (req, res) => {
    console.log("[API] Serving /api/agents request");
    res.json(agents);
  });

  app.get("/test-api", (req, res) => {
    res.json({ message: "API is working" });
  });

  // Socket.io for real-time updates
  io.on("connection", (socket) => {
    console.log("📡 Command Center Connected");
    
    socket.on("disconnect", () => {
      console.log("📡 Command Center Disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 QuantumAlpha Server running on http://localhost:${PORT}`);
  });
}

startServer();
