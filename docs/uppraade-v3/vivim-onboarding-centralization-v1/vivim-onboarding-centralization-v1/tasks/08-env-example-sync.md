# Task 08 — Sync `.env.example` + README install docs

**Phase**: C (Make install work)
**Depends on**: nothing
**Effort**: 30 min
**Files touched**:
- `.env.example` (root)
- `README.md` (root)

## Context

Two doc/code mismatches block first-run:

1. **`.env.example`** exposes `CAP_STORE_*` vars but **omits** `DATABASE_URL`, `FRONTEND_DIR`, and all API key vars that the code reads.
2. **README** documents `DATABASE_URL`, `OPENAI_API_KEY`, etc. (which `.env.example` doesn't have), and the install steps are missing `prisma db push` and `cd frontend && bun install`. README also says to open `http://localhost:9420` — wrong, the frontend is on `:3000`.

## Goal

1. Rewrite `.env.example` to list every env var `src/config.ts` reads, with sensible defaults and comments.
2. Rewrite README install section to match what actually works.

## Spec

### Part 1: `.env.example`

Use `templates/env.example.template`. The new file must list every env var read by `src/config.ts` (audit them by reading the file). At minimum:

```bash
# === Server ===
CAP_STORE_HOST=127.0.0.1
CAP_STORE_PORT=9420
CAP_STORE_AUTH_TOKEN=
CAP_STORE_CORS_ORIGIN=http://localhost:3000,http://localhost:5175

# === Storage ===
CAP_STORE_DATA_DIR=
CAP_STORE_DB_PATH=
DATABASE_URL=                          # If set, overrides CAP_STORE_DB_PATH for Prisma
CAP_STORE_ENCRYPT_DB=false

# === Chrome / Fleet ===
CAP_STORE_CHROME_PATH=
CAP_STORE_PROFILE_DIR=
CAP_STORE_AUTO_START_FLEET=false
CAP_STORE_FLEET_PORT_START=9222
CAP_STORE_FLEET_PORT_END=9250
CAP_STORE_HEALTH_PROBE_MS=30000

# === Circuit Breaker ===
CAP_STORE_CIRCUIT_THRESHOLD=5
CAP_STORE_CIRCUIT_RESET_MS=30000
CAP_STORE_HPE_RETENTION_DAYS=30

# === Frontend ===
FRONTEND_DIR=                          # If set, backend serves static files from this dir (production)
NEXT_PUBLIC_API_URL=http://localhost:9420

# === Logging ===
CAP_STORE_LOG_LEVEL=info

# === Provider API Keys (optional — only needed if using API providers, not Chrome-login providers) ===
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
GOOGLE_API_KEY=

# === OpenTelemetry (optional) ===
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_SERVICE_NAME=vivim-final

# === OpenCode Server (optional) ===
OPENCODE_SERVE_ENABLED=0
OPENCODE_SERVE_PORT=0
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=

# === MCP Server (optional) ===
MCP_PORT=0

# === Dev-only ===
CAP_STORE_ENSURE_ACCOUNTS=false        # When true, runs ensure-accounts.ts on boot (currently no-op)
FORCE_SEED=                            # When set, forces re-seed even if DB has providers
DEBUG=false
```

### Part 2: `README.md` install section

Replace the existing "Manual Installation" section with:

```markdown
### Manual Installation

```bash
# Clone the repository
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final

# Install root dependencies
bun install

# Install frontend dependencies
cd frontend
bun install
cd ..

# Copy env example and configure if needed (defaults work for dev)
cp .env.example .env

# Generate Prisma client
bun run prisma:generate

# Apply schema to the database (REQUIRED — creates tables)
bun x prisma db push

# Seed the database (boots server once, runs all seeds)
bun run seed

# Start development server
bun run dev
```

This starts:
- **Backend** at `http://localhost:9420` (REST API + WebSocket)
- **Frontend** at `http://localhost:3000` (Next.js dev server)

Open `http://localhost:3000` in your browser. The Next.js frontend proxies `/api/*` requests to the backend on `:9420`.

### Environment Variables

See `.env.example` for the full list. Key vars for development:

| Var | Default | Purpose |
|-----|---------|---------|
| `CAP_STORE_PORT` | `9420` | Backend server port |
| `CAP_STORE_DB_PATH` | `~/.local/share/vivim/cap-store/cap-store.sqlite` (Linux) / `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` (Win) | SQLite database path |
| `CAP_STORE_PROFILE_DIR` | `<dataDir>/chrome-profiles` | Chrome slave profile root |
| `CAP_STORE_CHROME_PATH` | (auto-detect) | Chrome binary path override |

For production / desktop packaging, also set `FRONTEND_DIR` to the directory containing the built frontend (`frontend/out/` after `next build`).
```

Also update any other place in README that references the wrong port (search for `9420` and `3000`).

## Acceptance criteria

- [ ] `.env.example` lists every env var `src/config.ts` reads (cross-check by `grep -oE 'process\.env\.[A-Z_]+' src/config.ts | sort -u`).
- [ ] `.env.example` includes `DATABASE_URL`, `FRONTEND_DIR`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY` (all the vars README mentioned but were missing).
- [ ] `.env.example` includes comments explaining each var.
- [ ] README install section includes `cd frontend && bun install` step.
- [ ] README install section includes `bun x prisma db push` step between `prisma:generate` and `seed`.
- [ ] README says to open `http://localhost:3000`, not `:9420`.
- [ ] README env var table matches `.env.example`.
- [ ] No env var documented in README is missing from `.env.example`, and vice versa.

## Verification

```bash
cd /home/z/my-project/vivim-final

# 1. Cross-check .env.example against code
grep -oE 'process\.env\.[A-Z_]+' src/config.ts | sort -u > /tmp/code-vars.txt
grep -oE '^[A-Z_]+=' .env.example | sed 's/=//' | sort -u > /tmp/env-vars.txt
diff /tmp/code-vars.txt /tmp/env-vars.txt
# Any var in code-vars but not env-vars is a gap

# 2. Fresh-clone walkthrough (on a clean checkout)
git clone https://github.com/owenservera/vivim-final.git /tmp/vivim-test
cd /tmp/vivim-test
bun install
cd frontend && bun install && cd ..
cp .env.example .env
bun run prisma:generate
bun x prisma db push   # ← the step that was missing
bun run seed
bun run dev
# Open http://localhost:3000 — should see Vivim app, no 404
```

## Notes

- Don't add comments to `.env.example` that explain what each var does in depth — keep them to one line. Detailed docs belong in `docs/CONFIGURATION.md` (if it exists) or a new `docs/ENV.md`.
- If `docs/CONFIGURATION.md` exists, update it too. The audit didn't read it, but if it has env var docs, they're probably also stale.
- The `CORS_ORIGIN` default includes `http://localhost:5175` (Vite) which is dead — the frontend runs on 3000 (Next.js). Keep 5175 in the default for backward compat but make sure 3000 is also in the list. The template handles this.
