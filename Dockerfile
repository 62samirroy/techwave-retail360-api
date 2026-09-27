# ==============================================================================
# TechWave Retail360 - Production Backend API Dockerfile
# Multi-stage build with non-root security and minimal runtime footprint
# ==============================================================================

# ---- Stage 1: Build Dependencies & Compile TypeScript ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy TypeScript source code and config
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma Client and compile TypeScript to /dist
RUN npx prisma generate
RUN npm run build

# Prune devDependencies to keep runtime node_modules lean
RUN npm prune --production

# ---- Stage 2: Production Lightweight Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

# Ensure security with latest patches and OpenSSL
RUN apk add --no-cache openssl dumb-init curl

# Create dedicated non-root application user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

ENV NODE_ENV=production
ENV PORT=5000

# Copy necessary production artifacts from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Create and grant permissions for uploads directory
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

# Docker healthcheck pinging the API status endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Use dumb-init as PID 1 to ensure proper signal forwarding (SIGTERM / SIGINT)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "dist/server.js"]
