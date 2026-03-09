# =============================================================================
# Campus Resource Engine - Server Dockerfile (Production)
# =============================================================================
# Multi-stage build for optimized production image
# Build context: repo root (.)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy workspace-level files (lockfile lives at root)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/

# Install server dependencies only
RUN pnpm install --frozen-lockfile --filter @campus/server

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy workspace files and dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy server source
COPY server ./server

# Build TypeScript
WORKDIR /app/server
RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 3: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy only what's needed to run
COPY --from=builder --chown=expressjs:nodejs /app/server/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/server/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/server/package.json ./package.json

# Switch to non-root user
USER expressjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
