# Bun + SQLite WAL Patterns Brief

**Source:** Quick research (internal knowledge + web findings)
**Confidence:** High | **Sources:** 5 | **Date:** 2026-07-12

## TL;DR

Bun's native `bun:sqlite` with WAL mode provides optimal performance for single-writer workloads. Key patterns: enable WAL + synchronous=NORMAL for concurrency, use prepared statements + transactions for batch writes, and set busy_timeout to handle lock contention gracefully. Windows has a known WAL file-locking issue during cleanup.

## Key Decisions

1. **Use `bun:sqlite` directly** — No external dependencies, built into Bun runtime, 2-3x faster than better-sqlite3 alternatives
2. **Enable WAL mode at connection** — `PRAGMA journal_mode = WAL` allows concurrent reads during writes
3. **Set synchronous=NORMAL** — Safe with WAL and 2-3x faster than FULL; use FULL only for power-loss intolerant scenarios
4. **Wrap batch operations in transactions** — Expect 10-100x performance improvement over auto-commit
5. **Use prepared statements for repeated queries** — Compile once, reuse; dramatically faster for hot paths

## Evidence Summary

- **Bun docs:** WAL mode dramatically improves performance for concurrent readers + single writer (source: bun.com/docs/runtime/sqlite)
- **Prisma adapter:** `prisma-adapter-bun-sqlite` provides production-ready WAL configuration with `synchronous=NORMAL` (source: mmvsk/prisma-adapter-bun-sqlite)
- **SQLite best practices:** WAL persists across connections, must set `foreign_keys=ON` per connection (source: llmbestpractices.com/backend/sqlite)
- **Oneuptime.com:** `PRAGMA cache_size = -64000` (64MB cache), `temp_store = MEMORY` for performance (source: oneuptime.com)
- **Windows WAL issue:** `database.close()` doesn't immediately release file locks on `.db` file in WAL mode; workaround: process exit or 3.5s delay (source: oven-sh/bun#25964)

## Implementation Notes

```typescript
// Recommended pragmas for Bun + SQLite
const db = new Database("cap-store.db");
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL");
db.run("PRAGMA foreign_keys = ON");  // Must be per-connection
db.run("PRAGMA busy_timeout = 5000");
db.run("PRAGMA cache_size = -64000");
db.run("PRAGMA temp_store = MEMORY");
```

## Used In

- All SQLite database connections (src/storage/prisma.ts, src/storage/db.ts)
- Migration system (prisma/migrations)
- Batch operations (parser seeds, harness modules, telemetry aggregation)