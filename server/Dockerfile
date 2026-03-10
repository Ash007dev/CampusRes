# =============================================================================
# Campus Resource Engine - Server Dockerfile (Production)
# =============================================================================
# Build context: repo root (.)
# Uses pnpm deploy to correctly resolve workspace symlinks for production
# =============================================================================

FROM node:20-alpine AS build

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy workspace manifest files (lockfile lives at repo root)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY server/package.json ./server/

# Install all dependencies (devDeps needed to compile TypeScript)
RUN pnpm install --frozen-lockfile

# Copy server source code
COPY server ./server

# Compile TypeScript → outputs to server/dist/
RUN cd server && pnpm run build

# Create a standalone production bundle with properly resolved node_modules
# (pnpm deploy eliminates symlinks so the runner stage is fully self-contained)
RUN pnpm deploy --filter @campus/server --prod /deploy

# pnpm deploy copies source files but not the compiled dist — copy it manually
RUN cp -r server/dist /deploy/dist

# =============================================================================
# Production runner
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy the self-contained deployment bundle
COPY --from=build --chown=expressjs:nodejs /deploy ./

USER expressjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
