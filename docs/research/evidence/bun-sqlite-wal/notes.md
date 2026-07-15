# Bun + SQLite WAL Patterns — Evidence Notes

## Key Findings

### WAL Mode Performance
- WAL (Write-Ahead Logging) allows concurrent reads during writes in SQLite
- `synchronous=NORMAL` is safe with WAL and 2-3x faster than FULL
- For power-loss-intolerant scenarios, use `synchronous=FULL`

### Pragmas Configuration
```
PRAGMA journal_mode = WAL;      -- Enable WAL (persistent across connections)
PRAGMA synchronous = NORMAL;  -- Balance of safety/speed with WAL
PRAGMA foreign_keys = ON;       -- Must be set per connection
PRAGMA busy_timeout = 5000;    -- Wait on locks instead of failing
PRAGMA cache_size = -64000;    -- 64MB cache (negative means KB)
PRAGMA temp_store = MEMORY;    -- Memory for temp tables
```

### Windows WAL Issue
- SQLite file remains locked on Windows after `db.close()` in WAL mode
- `.db-wal` and `.db-shm` can be deleted but `.db` remains locked
- Workaround: process exit or 3.5s delay before file deletion
- Not an issue on macOS/Linux (per Bun issue #25964)

### Batch Operations
- Prepared statements + single transaction = 10-100x performance boost
- Use `db.transaction()` for multi-step operations
- For 1000+ inserts, prepare once, run in single transaction

## Sources
1. Bun SQLite docs — WAL mode for concurrent access
2. prisma-adapter-bun-sqlite — Production WAL configuration
3. LLM Best Practices — SQLite 3.53 recommendations
4. OneUpTime — Bun SQLite performance guide
5. Bun issue #25964 — Windows WAL file locking