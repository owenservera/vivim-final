# AGENT-QUICKSTART.md

**Audience:** AI agents with full server sandbox capabilities.
**Goal:** Get productive in <2 minutes.

---

## 1. What This Is

**vivim-final** — local-first AI conversation platform. Bun + Prisma + TypeScript + Next.js.

- Backend: `src/` (733 files, 13-engine architecture)
- Frontend: `frontend/src/` (494 files, Next.js 16 + React 19)
- Shared types: `shared/` (API types, canvas types, UI slots)
- Database: SQLite via Prisma (`prisma/schema.prisma`, 54 tables)
- Seeds: `seeds/` (provider manifests, parsers, capabilities)

## 2. Setup (run these, nothing else)

```bash
# Root
bun install
bun run prisma:generate
bun x prisma db push
bun run seed

# Frontend
cd frontend && bun install && cd ..
```

## 3. Run

```bash
bun run dev
# Backend: http://localhost:9420
# Frontend: http://localhost:3000
```

## 4. Verify Your Changes

```bash
bun run typecheck          # Must pass (zero errors in src/ and frontend/src/)
bun run lint               # Biome lint (warns OK, errors must fix)
bun test                   # All tests pass
```

## 5. Ship

```bash
git add -A
git commit -m "feat(scope): description"
```

Commit format: `feat|fix|refactor|test|docs|chore(scope): description`

## 6. Key Conventions

- **No `any`** — use `unknown` + type narrowing
- **`.js` extension in imports** — Bun ESM requirement
- **`import type` for type-only imports**
- **Store Contracts** — engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`
- **IDs are ULIDs** — `src/ids.ts`
- **Errors** — custom classes from `src/errors.ts`
- **DB-only parser logic** — parsers live in DB rows, not engine code
- **One entry point** — everything is a `UnifiedCapability`, routed via `POST /api/interpret`

## 7. Architecture Quick Reference

```
src/
  engines/          # 13 engines (one file per engine)
  storage/
    contracts/      # Engine interfaces (depend on these)
    impl/           # Prisma implementations
  server/           # HTTP server + API routes
  cli/              # CLI entry points
  schema/           # Zod validation schemas
  errors.ts         # Custom error classes
  ids.ts            # ULID generation
  config.ts         # Configuration

frontend/
  src/
    app/            # Next.js App Router
    components/     # React components
    engines/        # Frontend engines
    ui/             # Slot system
    storage/        # Storage contracts

shared/             # Shared types (backend + frontend import here)
seeds/              # Provider manifests, parsers, capabilities
prisma/             # Schema + migrations
```

## 8. Common Tasks

| Task | Command |
|------|---------|
| Add a provider | Create `seeds/providers/<slug>.json`, run `bun run seed` |
| Add a capability | Register in `src/engines/*caps.ts`, add NL pattern in `src/engines/nlcl/catalog.ts` |
| Change DB schema | Edit `prisma/schema.prisma`, run `bunx prisma migrate dev --name <name>` |
| Run specific test | `bun test tests/unit/engines/<engine>.test.ts` |
| Typecheck one file | `bunx tsc --noEmit` (full) or check IDE |

## 9. Gotchas

- **Bun ESM:** Always `.js` extension in imports, even for `.ts` files
- **Prisma:** Run `bun run prisma:generate` after schema changes
- **Seeds:** `bun run seed` boots server briefly to run seeds — this is normal
- **Frontend port:** 3000 (proxies `/api/*` to backend 9420)
- **Tests:** `bun test` uses bun's built-in runner, not Jest
