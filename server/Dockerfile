# =============================================================================
# Campus Resource Engine - Server Dockerfile (Production)
# =============================================================================
# Multi-stage build for optimized production image
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY server/package.json server/package-lock.json* ./server/

# Install dependencies
RUN cd server && npm ci --only=production

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and node_modules from deps stage
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server ./server

# Install dev dependencies for building
WORKDIR /app/server
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

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

# Copy built application
COPY --from=builder --chown=expressjs:nodejs /app/server/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/server/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/server/package.json ./package.json
COPY --from=builder --chown=expressjs:nodejs /app/server/prisma ./prisma

# Generate Prisma client for production
RUN npx prisma generate

# Switch to non-root user
USER expressjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
