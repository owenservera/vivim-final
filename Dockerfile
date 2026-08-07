# ─────────────────────────────────────────────────────────────────────────────
# vivim-final production Dockerfile (multi-stage)
# Session 2 (2026-08-07): added to enable containerized deployment.
#
# Stages:
#   1. deps     — install backend + frontend deps (cached layer)
#   2. build    — generate prisma client, build backend (tsup), build frontend (next standalone)
#   3. runtime  — slim Bun runtime image with only the built artifacts
#
# The runtime image exposes:
#   - 9420  (backend REST + WebSocket)
#   - 3000  (frontend Next.js standalone server)
#
# The frontend's next.config.mjs sets output: 'standalone' so the standalone
# server is produced at frontend/.next/standalone/. We copy that into the
# runtime image and run it with `bun`.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM oven/bun:1.3-debian AS deps
WORKDIR /app

# Copy lockfiles first for better layer caching.
COPY package.json bun.lock* ./
COPY frontend/package.json frontend/bun.lock* ./frontend/

# Install backend + frontend dependencies.
RUN bun install --frozen-lockfile
RUN cd frontend && bun install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM oven/bun:1.3-debian AS build
WORKDIR /app

# Copy deps from the deps stage.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules

# Copy source.
COPY . .

# Generate Prisma client.
RUN bun x prisma generate

# Build backend (tsup → dist/index.js).
RUN bun run build

# Build frontend (next build → frontend/.next/standalone/).
RUN cd frontend && bun run build

# Generate docs (OpenAPI spec + user manual).
RUN bun run docs:openapi
RUN bun run docs:manual

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM oven/bun:1.3-debian AS runtime
WORKDIR /app

# Install only the runtime system deps. No build tools, no dev deps.
# `openssl` is required by Prisma's native query engine.
# `ca-certificates` for HTTPS calls to provider APIs.
# `tini` for proper PID 1 signal handling.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl \
      ca-certificates \
      tini \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for the runtime.
RUN groupadd --system vivim && useradd --system --gid vivim --create-home --home-dir /home/vivim vivim

# Copy built backend.
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/shared ./shared
COPY --from=build /app/seeds ./seeds
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/docs ./docs
COPY --from=build /app/biome.json ./biome.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/tsup.config.ts ./tsup.config.ts
COPY --from=build /app/package.json ./package.json

# Copy Prisma client (generated in build stage).
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Copy built frontend (standalone output).
COPY --from=build /app/frontend/.next/standalone ./frontend/standalone
COPY --from=build /app/frontend/.next/static ./frontend/standalone/.next/static
COPY --from=build /app/frontend/public ./frontend/standalone/public

# Copy only the production runtime deps (no devDependencies).
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/standalone/node_modules

# Create the data directory for SQLite (mounted as a volume in production).
RUN mkdir -p /app/data && chown -R vivim:vivim /app

# Switch to non-root user.
USER vivim

# Environment defaults (overridable at runtime).
ENV NODE_ENV=production
ENV CAP_STORE_HOST=0.0.0.0
ENV CAP_STORE_PORT=9420
ENV DATABASE_URL=file:/app/data/vivim.db
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose backend + frontend ports.
EXPOSE 9420 3000

# Health check — hit the backend /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:9420/health || exit 1

# Use tini as PID 1 for proper signal handling (graceful shutdown).
ENTRYPOINT ["/usr/bin/tini", "--"]

# Run a tiny process supervisor that starts both backend and frontend.
# We use a shell script so each can be restarted independently if needed.
COPY --chown=vivim:vivim scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
