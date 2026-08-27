# Runbook — Local Development

> How to run Vivim locally, port assignments, and common gotchas.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Bun** | 1.3.14+ | [bun.sh](https://bun.sh) |
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org) |
| **Git** | latest | [git-scm.com](https://git-scm.com) |

---

## Quick Start

```bash
# Clone
git clone https://github.com/owenservera/vivim-final.git
cd vivim-final

# Install
bun install

# Database
bun run prisma:generate
bun run seed

# Run
bun run dev
```

This starts:
- **Backend** at `http://localhost:9420` (REST API + WebSocket)
- **Frontend** at `http://localhost:3000` (Next.js dev server)

Open `http://localhost:3000` in your browser.

---

## Port Assignments

| Port | Service | Notes |
|------|---------|-------|
| 9420 | Backend API | REST + WebSocket |
| 3000 | Frontend | Next.js dev server |
| 9252-9280 | Chrome slaves | Per-provider CDP connections |

---

## Available Scripts

| Command | What It Does |
|---------|--------------|
| `bun run dev` | Start backend + frontend (blocking) |
| `bun run dev:backend` | Backend only |
| `bun run dev:frontend` | Frontend only |
| `bun run stop` | Kill orphaned processes on 9420/3000 |
| `bun run build` | Production build |
| `bun run test` | Run all tests |
| `bun run test:fast` | Unit + arch tests only |
| `bun run typecheck` | TypeScript type check |
| `bun run lint` | Biome lint |
| `bun run format` | Biome format |
| `bun run seed` | Re-seed database |
| `bun run prisma:studio` | Open Prisma Studio |

---

## Environment Variables

Create `.env` in the project root:

```bash
# Database
DATABASE_URL="file:./data/vivim.db"

# Server
PORT=9420

# API Keys (configure as needed)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Desktop App
FRONTEND_DIR=./frontend/out
```

Defaults work for local development — API keys are only needed for live provider connections.

---

## Database

### Schema Changes

```bash
# Development (creates migration)
bun run prisma:migrate dev

# Production (applies pending)
bun run prisma:migrate prod

# Quick push (no migration file)
bun run prisma:push
```

### Rebuild Test Fixture

After any schema change:

```bash
DATABASE_URL="file:C:/0-BlackBoxProject-0/vivim-final/tests/fixtures/node-store-test.db" \
  bunx prisma db push --skip-generate --accept-data-loss
```

**Use an absolute path.** Relative paths resolve against `prisma/schema.prisma` and create duplicates.

### Backup & Restore

```bash
bun run db:backup
bun run db:restore
```

---

## Common Gotchas

### 1. Port Already in Use

```bash
# Kill processes on the port
bun run stop

# Or manually (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 9420).OwningProcess | Stop-Process
```

### 2. Prisma Client Not Generated

```bash
bun run prisma:generate
```

### 3. Database Not Seeded

```bash
bun run seed
```

### 4. Frontend Can't Reach Backend

Ensure the backend is running on port 9420. The frontend proxies `/api/*` to `:9420`.

### 5. Chrome Slave Won't Connect

Chrome slaves need a valid profile directory. Check `chrome-profiles/<provider>/<account>/` for cookie files.

---

## DevOps Toolkit

```bash
# Full desktop build + test cycle
bun run devops desktop-loop run --version <x.y.z>

# Individual actions
bun run devops desktop-loop status
bun run devops desktop-loop build --version <x.y.z>
bun run devops desktop-loop install --version <x.y.z>
bun run devops desktop-loop launch --version <x.y.z>
bun run devops desktop-loop test smoke
bun run devops desktop-loop logs --tail 100
```

---

## Provider Testing

```bash
# Full preflight (all providers)
bun run devops runtime-test preflight

# Single provider
bun run devops runtime-test status --provider=gemini

# 8-phase onboarding
bun run devops runtime-test onboard --provider=gemini

# Protocol discovery
bun run devops discover-protocol https://gemini.google.com/app --hint=gemini
```

See [PROVIDERS.md](PROVIDERS.md) for detailed provider setup.

---

See [OVERVIEW.md](../architecture/OVERVIEW.md) for the high-level mental model.
