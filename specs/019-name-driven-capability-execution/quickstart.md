# Quickstart: Validate DB-Driven Capability Execution

**Feature**: 019-name-driven-capability-execution
**Date**: 2026-07-18

End-to-end validation that the DB is the source of truth for parser logic + capabilities,
and that execution is by-need / sandboxed / snapshot-driven.

## Prerequisites

- Bun + PowerShell 7+ from repo root `C:\0-BlackBoxProject-0\vivim-final`.
- Prisma client generated (`bunx prisma generate`).
- `dev.db` seeded via `bun run db:setup` (or `bun run seed`).

## Scenario A — Snapshot loads ported capabilities at boot (no DB hit at runtime)

1. Start backend: `pwsh scripts/start-backend.ps1`
2. Wait for boot log: `[boot] Capability snapshot: loaded=<N> for <M> providers`
   (N should be > 0; expected ~104 active bindings across registered providers).
3. Query debug surface:
   `curl http://localhost:9421/api/sandbox/debug` → providers list includes the
   registered providers; the snapshot is internal (verify via a test endpoint or log).

**Expected**: ported (non-`cap:cdp:`) capabilities are present in the in-memory snapshot,
not just the 96 static CDP commands.

## Scenario B — Non-CDP capability executes via snapshot

1. Via API: `POST /api/conversations/:id/capabilities/:slug/execute` with a ported slug
   (e.g. a web-UI action like `open-sidebar` from the OG port).
2. **Expected**: resolves from `snapshot.getBySlug(slug, providerId)`, runs best program
   via `HarnessExecutor`, returns `{ ok: true, result }`.
3. Before this fix, the same call threw `Not a CDP capability`. That error must be gone.

## Scenario C — Parser runs inside a sandbox in the server path

1. Boot the server (Scenario A). `StreamParserEngine` is constructed with a `SandboxRunner`.
2. `POST /api/conversations/:id/send` with a provider that has an inline parser.
3. **Expected**: response parsed via `SandboxRunner.run(logicCode)`; no host `new Function`
   path taken. Confirm by temporarily asserting `sandbox` is present in `stream-parser.ts`.

## Scenario D — fallbackParserId graph is populated

1. Inspect DB: `bunx prisma studio` → `provider_parser` for a provider whose manifest
   declares `fallback` (e.g. a provider → `generic`).
2. **Expected**: `fallback_parser_id` is a real row id (not null), and
   `StreamParserEngine.parse()` walks provider → fallback → … on parse failure.

## Scenario E — Test isolation

1. Recreate test DB:
   `DATABASE_URL="file:./prisma/test.db" bunx prisma db push --skip-generate --accept-data-loss`
2. Seed it via the same port/seed script against `test.db`.
3. Run unit tests (mocked store, no DB) + integration (test.db):
   `bun test tests/unit/engines/capability-snapshot.test.ts`
   `bun test tests/integration/capability-snapshot.test.ts`
4. **Expected**: green; prod `dev.db` untouched.

## Exit criteria

- A, B, C, D, E all pass → DB is source of truth; execution is snapshot-driven + sandboxed.
- `bun run devops invariants check --category B` → 0 block violations.
- `bun run devops verify-cross-surface` → ported caps resolve across CLI/API/MCP/UI.
