# Task 06 — Fix snapshot-restore in `src/server/index.ts`

**Phase**: C (Make install work)
**Depends on**: Task 05 (sidecar embeds the snapshot — this task fixes the in-server restore path)
**Effort**: 30 min
**Files touched**:
- `src/server/index.ts`

## Context

`src/server/index.ts:577-619` tries to restore `seeds/seed-snapshot.db` when `providerDefinition.count() === 0`. But:

1. On a fresh DB with no tables, `count()` throws P2021 *before* the restore can run.
2. Even if it didn't throw, the restore copies to `prisma/dev.db` (relative to cwd), but Prisma reads from `config.dbPath` (`~/.local/share/vivim/cap-store/cap-store.sqlite` or `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite`) — **path mismatch, silent no-op**.

## Goal

Fix both bugs:
1. Wrap the `count()` in try/catch; treat thrown as "needs seed" (run the restore).
2. Restore to `config.dbPath`, not `prisma/dev.db`.

## Spec

### Find the existing code

Open `src/server/index.ts` and find the snapshot-restore block around lines 577–619. It looks roughly like:

```ts
// Existing (broken):
const providerCount = await db.prisma.providerDefinition.count();
if (providerCount === 0) {
  // Restore from snapshot
  const snapshotPath = path.resolve('seeds/seed-snapshot.db');
  const dbTarget = path.resolve('prisma/dev.db');  // ← WRONG PATH
  if (await fs.exists(snapshotPath)) {
    await fs.copyFile(snapshotPath, dbTarget);
    console.log('Restored DB from snapshot');
    // Re-open Prisma to pick up the new DB
    await db.prisma.$disconnect();
    // ... re-init
  }
}
```

### Replace with

```ts
// New (fixed):
import { config } from '../config';

let needsSeed = false;
try {
  const providerCount = await db.prisma.providerDefinition.count();
  needsSeed = providerCount === 0;
} catch (err: unknown) {
  // P2021 = "no such table" — DB exists but schema wasn't applied
  const code = (err as { code?: string })?.code;
  if (code === 'P2021') {
    console.warn('DB schema not applied (P2021) — will attempt snapshot restore');
    needsSeed = true;
  } else {
    throw err;  // Unexpected error — let it bubble
  }
}

if (needsSeed) {
  const snapshotPath = path.resolve('seeds/seed-snapshot.db');
  const dbTarget = config.dbPath;  // ← FIXED: use config.dbPath, not 'prisma/dev.db'

  if (await fs.exists(snapshotPath)) {
    // Disconnect Prisma before overwriting the DB file
    try {
      await db.prisma.$disconnect();
    } catch {
      // Ignore disconnect errors — DB may not have connected
    }

    // Back up existing DB if it has content (for debugging)
    if (await fs.exists(dbTarget)) {
      const backupPath = `${dbTarget}.pre-restore-${Date.now()}`;
      try {
        await fs.copyFile(dbTarget, backupPath);
        console.log(`Backed up pre-restore DB to ${backupPath}`);
      } catch {
        // Non-fatal
      }
    }

    // Ensure the target directory exists
    await fs.mkdir(path.dirname(dbTarget), { recursive: true });

    // Copy snapshot → DB path
    await fs.copyFile(snapshotPath, dbTarget);
    console.log(`✓ Restored DB from snapshot: ${snapshotPath} → ${dbTarget}`);

    // Re-init Prisma to pick up the new DB
    // This depends on how db.ts manages the singleton — likely need to call setDb() or similar
    // Look at the existing code for how it re-initializes after disconnect
    await db.prisma.$disconnect();
    // Force re-creation on next access — setDb(null) or similar
    // (Check src/storage/db.ts for the exact pattern)
  } else {
    console.warn(`⚠ Snapshot not found at ${snapshotPath} — cannot bootstrap DB.`);
    console.warn('  Run `bun run seed:snapshot` to create it, or `bun x prisma db push` to apply schema manually.');
    // Don't throw — let the server boot. Subsequent queries will throw P2021,
    // which is more informative than a boot crash.
  }
}
```

### Re-initializing Prisma after copy

The tricky part: after `copyFile`, Prisma still holds a connection to the old (empty) DB. You need to force it to reconnect. Options:

1. **If `db.ts` has a `resetDb()` or `setDb(null)` function**: call it. The next `getDb()` will create a new `PrismaClient` pointing at the new DB file.
2. **If not**: add one. In `src/storage/db.ts`:
   ```ts
   export async function resetDb(): Promise<void> {
     if (currentDb) {
       await currentDb.prisma.$disconnect();
       currentDb = null;
     }
   }
   ```
   Then in `index.ts` after the copy: `await resetDb();` and the next `getDb()` call will re-create.

3. **Nuclear option**: `process.exit(0)` after the copy, with a comment "DB restored — restart to pick up". The process manager (launch.bat or Tauri supervisor) will restart the sidecar, which will boot fresh against the restored DB. This is ugly but reliable.

Pick option 1 or 2 if possible. Option 3 is a fallback if Prisma's connection caching proves intractable.

## Acceptance criteria

- [ ] `src/server/index.ts` wraps the `count()` call in try/catch.
- [ ] P2021 errors are treated as "needs seed" (trigger the restore).
- [ ] Restore target is `config.dbPath`, not `prisma/dev.db`.
- [ ] After restore, Prisma is re-initialized (either via `resetDb()` or process restart).
- [ ] On a fresh DB (delete `~/.local/share/vivim/cap-store/cap-store.sqlite` first), `bun run dev` boots successfully and the DB is populated from the snapshot.
- [ ] Server logs show `✓ Restored DB from snapshot: ... → ...` on first boot.

## Verification

```bash
cd /home/z/my-project/vivim-final

# 1. Delete the DB to simulate fresh install
rm -f ~/.local/share/vivim/cap-store/cap-store.sqlite*
# (On Windows: del "%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite*")

# 2. Verify the snapshot exists
ls -lh seeds/seed-snapshot.db

# 3. Boot the server
bun run dev

# 4. Check the logs for "Restored DB from snapshot"
# 5. Verify the DB is now ~4 MB
ls -lh ~/.local/share/vivim/cap-store/cap-store.sqlite

# 6. Hit an API that queries the DB
curl -s http://localhost:3000/api/setup/profiles | jq
# Should return { ok: true, profiles: [] } — not a 500 error

# 7. Verify providers are seeded
curl -s http://localhost:3000/api/providers | jq
# Should return a list of 12+ providers
```

## Notes

- This task is the in-server counterpart to Task 05 (sidecar bootstrap). Task 05 handles the *first* boot when no DB file exists at all. This task handles the case where the DB file exists but is empty (e.g. Prisma created the file but no schema was applied, OR the snapshot restore in Task 05 failed and the server is retrying).
- The `try/catch` around `count()` is defensive — even with Task 05 working, there are edge cases where the DB file exists but tables don't (e.g. schema drift after a Prisma upgrade).
- Don't add a `FORCE_SEED` env check here — that's a separate concern. The existing `FORCE_SEED` env var (if any) should bypass the count check entirely and always restore. Check if it's already implemented; if not, leave it for a future task.
