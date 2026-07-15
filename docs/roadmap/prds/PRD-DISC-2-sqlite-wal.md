# PRD-DISC-2: SQLite WAL / Hot-Restart Hardening

**Status:** Proposed · **Priority:** P0 · **Phase:** 1 (atomic-v12 1.1)
**Owner:** vivim-runtime · **Depends on:** none

## 1. Problem
`bun run serve` emits `prisma:error` / "does not fit in an INT column" on a stale DB and the
live-reload supervisor cannot restart the backend reliably. Two pragma paths exist (`db.ts`
`configurePrisma` + `prisma.ts` `initPrismaWal`) and on shutdown `gracefulShutdown` never closes
the pool, so WAL files leak and hot-restart deadlocks. The runtime-OS supervisor (R1) needs a
single, correct, restart-safe pragma authority and a clean close.

## 2. Current State (research-first)
- `src/storage/prisma.ts:18` `initPrismaWal` uses `$executeRawUnsafe` (returns rows → error in SQLite).
- `src/storage/db.ts` `configurePrisma` runs pragmas via `$queryRawUnsafe` (correct) but on
  `success: false` it re-throws — blocking boot.
- `src/server/index.ts` `gracefulShutdown` calls `stopServices()` + `onShutdown` but NOT `closeDb()`.
- `dev.db` carried INT `created_at` with 13-digit data until `bunx prisma db push --accept-data-loss`
  cast to BigInt (done this session).

## 3. Design
- Make `configurePrisma` the SOLE pragma authority. Have `initPrismaWal` delegate to it (or remove it).
- Pragmas: `journal_mode=wal`, `busy_timeout=5000`, `foreign_keys=on`, `synchronous=NORMAL`,
  `cache_size=-64000`.
- On pragma failure, log + continue (do not block boot) unless `journal_mode` itself fails.
- `gracefulShutdown` MUST await `closeDb()` before process exit (idempotent).

## 4. Implementation Steps
1. Edit `prisma.ts` `initPrismaWal` → call `configurePrisma(prisma)` (no raw execute).
2. Edit `db.ts`: on non-fatal pragma error, `console.warn` + resolve; only throw on journal_mode fail.
3. Edit `server/index.ts` `gracefulShutdown`: add `await closeDb()` (idempotent guard).
4. `bunx prisma generate && bunx tsc --noEmit`.

## 5. Acceptance Criteria
- `bun run serve` shows `[db] pragmas configured — journal_mode=wal` with zero prisma:error.
- Two consecutive `gracefulShutdown` + boot cycles succeed (supervisor hot-restart).
- `bun run typecheck` clean.

## 6. Tests
- `tests/unit/storage/db.test.ts`: configurePrisma idempotent; closeDb idempotent.
- Manual: supervisor restart loop (R1.1) 5x without WAL errors.

## 7. Dependencies
- Hard prereq for R1 (supervisor restart) and R2 (engage).
- Independent of other DISC PRDs.

## 8. Risks
- `db push --accept-data-loss` can drop rows — already applied; future schema changes use migrations.
