# PRD: Seed Snapshot + Backup System

## Problem Statement

Every fresh clone or wiped database requires a full re-seed (~5s) that runs 5+ independent seed functions (providers, parsers, stream configs, automation, taxonomy, harness commands). There is no way to:
1. Capture a fully-seeded database as a golden template for instant restore
2. Create backups before risky operations (migrations, schema pushes)
3. Auto-restore from a snapshot when the working DB is empty/corrupt

The current seed logic (`src/server/index.ts:512-566`) checks `providerDefinition.count() === 0` to decide if seeding is needed. This works for avoiding re-seeds, but provides no safety net for data loss.

## Solution

A three-tier database management system:
1. **Seed Snapshot** — a golden template DB (`seeds/seed-snapshot.db`) captured after a full seed, used for instant restore on fresh clones
2. **Backup** — timestamped copies (`prisma/dev.db.bak`) created before risky operations
3. **Auto-restore** — server boot detects empty DB and copies snapshot if available, falling back to individual seeds

## User Stories

1. As a developer, I want `bun run dev` to start instantly on a fresh clone without waiting for seeds, so that my dev loop is fast
2. As a developer, I want to create a snapshot of my fully-seeded DB with `bun run seed:snapshot`, so that I can share it with teammates or use it as a restore point
3. As a developer, I want to backup my DB before a migration with `bun run db:backup`, so that I can recover if something goes wrong
4. As a developer, I want to restore from the latest backup with `bun run db:restore`, so that I can undo mistakes quickly
5. As a developer, I want the server to auto-restore from snapshot if my DB is empty, so that I don't need to manually seed
6. As a developer, I want `FORCE_SEED=true` to always run individual seeds (ignoring snapshot), so that I can force a fresh seed when needed
7. As a developer, I want to see which snapshot/backup I'm using in server logs, so that I can debug seed issues
8. As a developer, I want the snapshot to be git-ignored but the seed scripts to be tracked, so that the golden template is reproducible
9. As a developer, I want the backup to include a timestamp in the filename, so that I can have multiple backups without overwriting
10. As a developer, I want the restore command to show me what I'm restoring from, so that I can confirm before proceeding

## Implementation Decisions

### Modules to Build/Modify

| Module | Action | Purpose |
|--------|--------|---------|
| `scripts/seed-snapshot.ts` | **New** | Copies `prisma/dev.db` → `seeds/seed-snapshot.db` with WAL checkpoint |
| `scripts/backup-db.ts` | **New** | Copies `prisma/dev.db` → `prisma/dev.db.bak-{timestamp}` |
| `scripts/restore-db.ts` | **New** | Restores from snapshot or latest backup |
| `src/server/index.ts` | **Modify** | Add snapshot auto-restore path before individual seeds |
| `package.json` | **Modify** | Add 3 new npm scripts |
| `.gitignore` | **Modify** | Add `seeds/seed-snapshot.db` |

### Technical Decisions

1. **SQLite WAL checkpoint before copy**: Use `PRAGMA wal_checkpoint(TRUNCATE)` before copying to ensure the snapshot is a single file without WAL/SHM sidecars. This prevents corruption from partial WAL state.

2. **Snapshot location**: `seeds/seed-snapshot.db` — colocated with seed source files (the "one location" for seed data). The snapshot is NOT the seeds themselves (those are `.ts` files), but a pre-built artifact of running them.

3. **Backup naming**: `prisma/dev.db.bak-{ISO-timestamp}` (e.g., `dev.db.bak-2026-08-03T130100`). The `restore-db.ts` command picks the latest by mtime.

4. **Auto-restore logic**: Server boot checks `providerDefinition.count() === 0`. If empty AND `seeds/seed-snapshot.db` exists, copy snapshot → `prisma/dev.db`, skip individual seeds. If snapshot doesn't exist, fall back to individual seeds.

5. **FORCE_SEED override**: When `FORCE_SEED=true`, always run individual seeds (ignore snapshot). This is useful when seed logic has changed and you need a fresh seed from source.

6. **No schema migration in snapshot**: The snapshot is a data-only artifact. If the schema has changed (new migration), the snapshot may be incompatible. In that case, the server will fail to open it and fall back to individual seeds (which run on a fresh DB after `prisma db push`).

7. **Backup is data-only**: Like snapshot, backups are data artifacts. They don't include schema migrations. Restore assumes the schema is compatible.

### Data Flow

```
First boot (empty DB)
  ├─ seeds/seed-snapshot.db exists? ──YES──→ PRAGMA wal_checkpoint → copy → dev.db (instant)
  │                                          └─ skip individual seeds
  │
  └─ NO ──→ run individual seeds (slower, ~5s)
             └─ auto-create snapshot after seeding (optional, configurable)

Subsequent boots
  └─ dev.db has rows? ──YES──→ skip seeding (current behavior)

Corrupt/wiped DB
  └─ snapshot exists? ──YES──→ auto-restore
  └─ no snapshot? ──→ run individual seeds

Manual backup
  └─ bun run db:backup → dev.db.bak-{timestamp}

Manual restore
  └─ bun run db:restore → copy latest .bak or snapshot → dev.db

Force reseed
  └─ FORCE_SEED=true bun run dev → always run individual seeds
```

## Testing Decisions

1. **Unit test for seed-snapshot.ts**: Verify WAL checkpoint is issued, file copy succeeds, and snapshot file is a valid SQLite DB (open with Prisma, count providers > 0).

2. **Unit test for backup-db.ts**: Verify backup file is created with correct naming pattern, file size matches source.

3. **Unit test for restore-db.ts**: Verify restore picks latest backup, copies correctly, and source DB is unchanged.

4. **Integration test for auto-restore**: Start server with empty DB + snapshot present, verify DB is populated from snapshot (not individual seeds).

5. **Integration test for FORCE_SEED**: Start server with `FORCE_SEED=true` + snapshot present, verify individual seeds run (not snapshot).

6. **Existing tests**: The test fixture at `tests/fixtures/node-store-test.db` is NOT affected by this change. It uses its own `DATABASE_URL` override.

## Out of Scope

1. **Cross-schema migration**: Handling snapshots/backups across schema changes (requires `prisma migrate` first)
2. **Compression**: Gzip/zstd compression of snapshot/backup files (can be added later)
3. **Cloud sync**: Syncing snapshots to remote storage
4. **Incremental backups**: Only backing up changed pages (SQLite-specific optimization)
5. **Auto-snapshot after seed**: The auto-create-snapshot-after-seeding feature is mentioned but not in initial scope

## Further Notes

- The snapshot is a **build artifact**, not source code. It should be regenerated whenever seeds change.
- The backup is a **safety net**, not a versioning system. Use git for code versioning.
- The auto-restore is **transparent** — the server log will show "Restored from seed snapshot" or "Running individual seeds" so developers know what happened.
- The `.gitignore` already excludes `prisma/dev.db*` files, so backups won't be committed. The snapshot (`seeds/seed-snapshot.db`) needs explicit exclusion.
