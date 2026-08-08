# Deploy Runbook — vivim-final Production Deployment

> Session 2 (2026-08-07): created alongside the Dockerfile + docker-compose.

This runbook covers the supported deployment paths for vivim-final: Docker
(single host), docker-compose (single host with persistence), and a
bare-metal/Bun process deployment for environments without Docker.

---

## Quick start (docker-compose)

```bash
# 1. Clone + create env file
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final
cp .env.example .env
# Edit .env — at minimum set CAP_STORE_AUTH_TOKEN for production

# 2. Build + start
docker compose up -d --build

# 3. Verify
curl http://localhost:9420/health        # backend liveness
curl http://localhost:9420/readyz         # backend readiness
curl http://localhost:3000/api/health     # frontend aggregated health
open http://localhost:3000                # the app
```

The SQLite DB is persisted to a named Docker volume (`vivim-data`) at
`/app/data/vivim.db` inside the container. To back it up:

```bash
docker compose exec vivim bun run scripts/backup-db.ts
# → writes to /app/data/vivim-backup-<timestamp>.db
docker cp vivim-final:/app/data/vivim-backup-<timestamp>.db ./backup.db
```

---

## Docker (single container, no compose)

```bash
docker build -t vivim-final:latest .

docker run -d \
  --name vivim-final \
  -p 9420:9420 \
  -p 3000:3000 \
  -v vivim-data:/app/data \
  -e CAP_STORE_AUTH_TOKEN=your-secret \
  -e OPENAI_API_KEY=sk-... \
  vivim-final:latest

# Tail logs
docker logs -f vivim-final

# Stop + remove
docker stop vivim-final && docker rm vivim-final
```

---

## Bare metal (Bun process)

For environments without Docker, or for development:

```bash
# 1. Install Bun 1.3+
curl -fsSL https://bun.sh/install | bash

# 2. Clone + install
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final
bun install
cd frontend && bun install && cd ..

# 3. Generate Prisma client + apply schema
bun x prisma generate
bun x prisma db push --skip-generate --accept-data-loss   # DDL only — no _prisma_migrations
# Drift check (target: zero drift):
bun x prisma migrate diff --from-url "file:./prisma/dev.db" --to-schema-datamodel prisma/schema.prisma

# 4. Build
bun run build                   # backend → dist/index.js
cd frontend && bun run build && cd ..   # frontend → .next/standalone/

# 5. Run (two processes)
bun run src/cli/index.ts serve &              # backend on :9420
cd frontend/.next/standalone && PORT=3000 HOSTNAME=0.0.0.0 bun server.js &  # frontend on :3000
```

For production, run both under a process supervisor (systemd, pm2, supervisord)
so they restart on crash.

---

## Environment variables (production-critical)

See `.env.example` for the full list. The ones you MUST set for production:

| Var | Why |
|-----|-----|
| `CAP_STORE_AUTH_TOKEN` | Bearer token for backend API. Empty = localhost-only (dev mode). |
| `DATABASE_URL` | SQLite path. Default `file:./dev.db`; in Docker, `file:/app/data/vivim.db`. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / etc. | Provider API keys (only if using API providers, not Chrome-login). |
| `CAP_STORE_CHROME_PATH` | Path to Chrome binary (only if using Chrome-login providers). |
| `NODE_ENV` | Set to `production` for pino structured logging + no pretty-print. |

---

## Health endpoints

| Endpoint | Returns | Use |
|----------|---------|-----|
| `GET /health` | `200 {status:'ok', version}` | Load balancer liveness probe. |
| `GET /readyz` | `200 {status:'ready', uptime}` or `503 {status:'not_ready'}` | Kubernetes readinessProbe. |
| `GET /api/health` | `200 {status:'ok', db:'ok'}` or `503 {status:'degraded', db:'unreachable'}` | Cross-tier health (frontend calls this). |
| `GET /api/health/providers` | `200 {providers: [...]}` | Provider-specific health (per Chrome instance / API key). |

The Docker container's `HEALTHCHECK` hits `GET /health` every 30s.

---

## Backups

```bash
# Hot backup (uses Prisma's backup pragma)
bun run db:backup

# Restore
bun run db:restore
```

In Docker, the DB lives at `/app/data/vivim.db` (or wherever `DATABASE_URL`
points). Back up the file directly if the script is unavailable:

```bash
docker compose exec vivim cp /app/data/vivim.db /app/data/vivim-backup-$(date +%Y%m%d).db
docker cp vivim-final:/app/data/vivim-backup-20260807.db ./backup.db
```

---

## Upgrading

```bash
# Pull the new version
git pull origin main

# Rebuild + restart (zero downtime if behind a load balancer)
docker compose up -d --build

# Apply schema (DDL only — the entrypoint does this automatically)
docker compose exec vivim bun x prisma db push --skip-generate --accept-data-loss
```

---

## Troubleshooting

### "Cannot find module '.prisma/client'"
The Prisma client wasn't generated. Run `bun x prisma generate` (or rebuild the
Docker image — the build stage generates it).

### "Database is locked"
SQLite doesn't handle concurrent writes well. Vivim-final is single-process, so
this should only happen if you're running two instances against the same DB file.
Use one container per DB.

### Frontend can't reach backend
Check that `BACKEND_URL` (defaults to `http://localhost:9420`) is reachable from
the frontend process. In Docker, both run in the same container so `localhost`
works. If splitting them across containers, set `BACKEND_URL=http://vivim-backend:9420`
and use a Docker network.

### Health check failing
```bash
docker compose exec vivim curl -sf http://localhost:9420/health
# If this fails, check backend logs:
docker compose logs vivim | tail -50
```

---

## See also

- [DEV.md](./DEV.md) — local development loop
- [PROVIDERS.md](./PROVIDERS.md) — provider setup (Chrome-login + API keys)
- [DESKTOP.md](./DESKTOP.md) — Tauri desktop build (downstream shell repo)
- [Architecture overview](../architecture/OVERVIEW.md)
- [API reference](../api/v11-universal-api.yaml)
