# QuantumAlpha v9.0 — Google Cloud Run Dockerfile
# Multi-stage build: compile TypeScript → run lightweight Node image

# ── Stage 1: Builder ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Build the React frontend
RUN npm run build

# ── Stage 2: Production Runner ────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Only copy what we need to run
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Cloud Run injects PORT automatically
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Run with tsx (TypeScript executor — no compile step needed)
CMD ["node_modules/.bin/tsx", "server.ts"]
