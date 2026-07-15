# PRD: SQLite WAL Hardening

**Status:** READY FOR AGENT
**Date:** 2026-07-13
**Author:** opencode (research review)
**Labels:** `ready-for-agent`, `research-proposal`, `infra`, `storage`
**Source brief:** `docs/research/briefs/bun-sqlite-wal-patterns-brief.md` (High confidence, 5 sources)

---

## Problem Statement

The brief recommends a single, authoritative WAL pragma policy for all SQLite connections. Today
there are **two competing** WAL-configuration code paths, and one omits a key recommendation:

1. `src/storage/prisma.ts` → `initPrismaWal()` runs **fire-and-forget** from `getPrisma()` and sets
   only `journal_mode=WAL`, `busy_timeout=5000`, `cache_size=-65536`, `foreign_keys=ON`.
   **It does NOT set `synchronous=NORMAL`** — the brief's main 2–3× speed recommendation.
2. `src/storage/db.ts` → `configurePrisma()` defines the full `DEFAULT_PRAGMAS`
   (`synchronous: NORMAL`, `temp_store: MEMORY`, `mmap_size`, `wal_autocheckpoint`) and **is**
   invoked at `src/server/index.ts:683`.

Because `initPrismaWal` fires on first `getPrisma()` (potentially before `configurePrisma`), the two
race: whichever runs last wins, and the partial path may leave `synchronous` at the unsafe-slow
`FULL` default or leave `temp_store` unset. Additionally, the brief flags the **Windows WAL
`close()` file-lock bug** (`oven-sh/bun#25964`): `db.close()` may not release `.db` locks
immediately, risking lock contention / apparent corruption on shutdown.

## Solution

### A. Single authoritative policy

- Delete `initPrismaWal` from `src/storage/prisma.ts`; make `configurePrisma` (`src/storage/db.ts`)
  the **only** WAL-config entry point. `getPrisma()` should no longer self-init pragmas.
- Keep `DEFAULT_PRAGMAS` as-is (it already matches the brief: WAL, `synchronous=NORMAL`,
  `cache_size=-64000`, `temp_store=MEMORY`, `mmap_size=268435456`, `busy_timeout=5000`,
  `wal_autocheckpoint=1000`, `foreign_keys=ON`).

### B. Graceful shutdown (Windows lock fix)

- In `closeDb()` / `closePrisma()`, issue `PRAGMA wal_checkpoint(TRUNCATE)` before disconnect to
  flush WAL → main db.
- Add a documented shutdown delay (≈3.5s) or rely on process exit so Windows releases the
  `-wal`/`-shm` files (per `bun#25964`). Guard behind an env flag `VIVIM_WAL_SHUTDOWN_DELAY_MS`.

## Implementation Plan

1. Remove `initPrismaWal` + its fire-and-forget call in `getPrisma()` (`prisma.ts`).
2. Ensure `server/index.ts:683` `configureDbPragmas(db)` is the sole caller; add a startup log line
   confirming `synchronous=NORMAL` was applied (read `PRAGMA synchronous` back).
3. Add `wal_checkpoint(TRUNCATE)` + optional delay to `closeDb()`/`closePrisma()`.
4. Add a smoke check in `src/server/index.ts` boot that asserts `journal_mode=wal` and
   `synchronous=1` (NORMAL) post-config.

## Acceptance Criteria

1. Exactly **one** WAL-config code path exists; grep for `PRAGMA journal_mode` returns a single
   authoritative site (plus the verification read-back).
2. After boot, `PRAGMA synchronous` returns `1` (NORMAL) and `PRAGMA journal_mode` returns `wal`.
3. Clean shutdown on Windows does not leave the DB locked (verified manually / in CI on Windows).

## Tests

- `tests/unit/storage/wal-pragmas.test.ts` — assert `configurePrisma` sets synchronous=NORMAL,
  temp_store=MEMORY, mmap_size, busy_timeout; assert `initPrismaWal` removed.
- `tests/integration/storage/shutdown.test.ts` — after `closeDb()`, reopen succeeds (no lock).

## Dependencies / Risks

- Touches every store (all go through `getPrisma`/`CapStoreDb`); low risk but high blast radius.
- On non-SQLite drivers the pragmas are no-ops (already wrapped in try/catch).

## References

- `docs/research/briefs/bun-sqlite-wal-patterns-brief.md`
- `src/storage/prisma.ts` (`initPrismaWal`), `src/storage/db.ts` (`configurePrisma`, `DEFAULT_PRAGMAS`)
- `src/server/index.ts:683`
- Bug: `oven-sh/bun#25964`
