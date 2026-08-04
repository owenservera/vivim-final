# Task 05 — Embed `seed-snapshot.db` in sidecar; copy on first boot

**Phase**: C (Make install work)
**Depends on**: nothing
**Effort**: 1–2 hr
**Files touched**:
- `scripts/tauri/compile-sidecar.ts`
- `src/desktop/sidecar-entry.ts`

## Context

`compile-sidecar.ts` copies `prisma/cap-store.db` to `src-tauri/data/app.db` *if it exists* — but the repo doesn't ship `prisma/cap-store.db`. The sidecar exe doesn't embed Prisma migrations. So on a fresh NSIS install, the sidecar creates an empty SQLite DB at `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` and then crashes on the same `count()` P2021 error as dev.

The repo *does* ship `seeds/seed-snapshot.db` (4.3 MB) — a golden template DB with all providers, parsers, taxonomy, harness commands, and automation roles already seeded.

## Goal

1. `compile-sidecar.ts` copies `seeds/seed-snapshot.db` into the sidecar's bundled data (so it's embedded in the compiled exe).
2. `sidecar-entry.ts` checks: if the DB file at `config.dbPath` doesn't exist OR is smaller than 100 KB (i.e. empty or near-empty), copy the embedded snapshot to `config.dbPath` before opening Prisma.

## Spec

### Change 1: `scripts/tauri/compile-sidecar.ts`

In the "Step 0 — Copy data" section, add the snapshot copy. Find the existing block that copies `prisma/cap-store.db` (which is a no-op because the file doesn't exist) and replace/extend it:

```ts
// Existing (broken — source file doesn't exist):
// await fs.copyFile('prisma/cap-store.db', 'src-tauri/data/app.db');

// New:
const snapshotSrc = path.resolve('seeds/seed-snapshot.db');
const snapshotDest = path.resolve('src-tauri/data/seed-snapshot.db');
if (await fs.exists(snapshotSrc)) {
  await fs.mkdir(path.dirname(snapshotDest), { recursive: true });
  await fs.copyFile(snapshotSrc, snapshotDest);
  console.log(`✓ Copied seed snapshot to ${snapshotDest}`);
} else {
  console.warn(`⚠ seeds/seed-snapshot.db not found — sidecar will not be able to bootstrap DB on first boot`);
  // Fail hard in CI/release builds; warn in dev
  if (process.env.CI === 'true') process.exit(1);
}
```

**Important**: also confirm the existing seed copies (providers JSON, harvested parsers TS) still work. They should — this is an addition, not a replacement.

### Change 2: `src/desktop/sidecar-entry.ts`

Add a `bootstrapDb()` function that runs *before* `createServerWithEngines()`. The function:

```ts
import { existsSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from '../config';

function bootstrapDb(): void {
  const dbPath = config.dbPath;
  const dbDir = dirname(dbPath);

  // Ensure the directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Check if DB exists and is non-trivially sized
  const dbExists = existsSync(dbPath);
  const dbSize = dbExists ? statSync(dbPath).size : 0;

  if (dbExists && dbSize > 100_000) {
    // DB already exists and has content — leave it alone
    return;
  }

  // DB is missing or empty — try to restore from embedded snapshot
  // The snapshot is bundled at <exe-dir>/data/seed-snapshot.db (compile-sidecar.ts puts it at src-tauri/data/)
  // When running as a compiled Bun exe, process.execPath is the sidecar exe location.
  // The data/ dir is sibling to the exe in the install layout: %INSTDIR%\vivim-server.exe + %INSTDIR%\data\
  // — but compile-sidecar.ts puts it at src-tauri/data/, which becomes <install>/data/ after NSIS install
  // — actually NSIS doesn't copy the data/ dir! Need to also update installer.nsi to include it.
  // For now, check multiple candidate locations:
  const candidates = [
    join(dirname(process.execPath), 'data', 'seed-snapshot.db'),
    join(dirname(process.execPath), 'seed-snapshot.db'),
    join(process.cwd(), 'seeds', 'seed-snapshot.db'),
    join(process.cwd(), 'seed-snapshot.db'),
  ];

  const snapshotPath = candidates.find(p => existsSync(p));
  if (!snapshotPath) {
    console.warn('⚠ No seed snapshot found — DB will be empty. First-run will fail.');
    console.warn('  Looked in:', candidates);
    return;
  }

  try {
    if (dbExists) {
      // Back up the empty/corrupt DB before overwriting
      const backupPath = `${dbPath}.pre-bootstrap-${Date.now()}`;
      copyFileSync(dbPath, backupPath);
      console.log(`  Backed up existing DB to ${backupPath}`);
    }
    copyFileSync(snapshotPath, dbPath);
    console.log(`✓ Bootstrapped DB from snapshot: ${snapshotPath} → ${dbPath}`);
  } catch (err) {
    console.error(`✗ Failed to bootstrap DB from snapshot:`, err);
    // Don't rethrow — let the server try to boot anyway (it may fail with P2021, which is the next fix)
  }
}
```

Call `bootstrapDb()` at the top of the sidecar's `main()`, before `findAvailablePort()` and `createServerWithEngines()`.

### Change 3: `scripts/tauri/installer.nsi`

In the "Install section" that writes files, add a line to copy the `data/` directory into the install dir. Find the existing `File` lines and add:

```nsis
File /r "${BIN_DIR}\data\*.*"  ; Copy seed-snapshot.db and other data files
```

Or, more explicitly:

```nsis
CreateDirectory "$INSTDIR\data"
File /oname=$INSTDIR\data\seed-snapshot.db "${BIN_DIR}\data\seed-snapshot.db"
```

The `${BIN_DIR}` should point to `src-tauri/data/` (where `compile-sidecar.ts` wrote the snapshot). Check the existing `File` commands in `installer.nsi` to see how `${BIN_DIR}` or equivalent is defined.

**If `installer.nsi` doesn't have a `${BIN_DIR}` variable**, hardcode the path: `File /oname=$INSTDIR\data\seed-snapshot.db "src-tauri\data\seed-snapshot.db"` (relative to the makensis working dir, which is the repo root when `build-installer.ps1` runs).

## Acceptance criteria

- [ ] `scripts/tauri/compile-sidecar.ts` copies `seeds/seed-snapshot.db` to `src-tauri/data/seed-snapshot.db` during the build.
- [ ] `src/desktop/sidecar-entry.ts` has a `bootstrapDb()` function that runs before `createServerWithEngines()`.
- [ ] `bootstrapDb()` checks if DB at `config.dbPath` is missing or < 100 KB; if so, copies from the embedded snapshot.
- [ ] `installer.nsi` includes the `data/seed-snapshot.db` file in the install output.
- [ ] On a fresh Windows VM, after install + first launch, `vivim-server.exe` boots without P2021 error.
- [ ] After first boot, `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` is ~4 MB (matches snapshot size).

## Verification

This requires a Windows build environment. Without one, verify by inspection:

```bash
cd /home/z/my-project/vivim-final

# 1. Verify compile-sidecar.ts has the snapshot copy
grep -n "seed-snapshot" scripts/tauri/compile-sidecar.ts

# 2. Verify sidecar-entry.ts has bootstrapDb
grep -n "bootstrapDb" src/desktop/sidecar-entry.ts

# 3. Verify installer.nsi includes the data file
grep -n "seed-snapshot" scripts/tauri/installer.nsi

# 4. Verify the snapshot file exists in the repo
ls -lh seeds/seed-snapshot.db
```

On Windows, end-to-end:
```powershell
# Build the installer
pwsh scripts/tauri/build-installer.ps1

# Verify seed-snapshot.db was copied to src-tauri/data/
Test-Path src-tauri\data\seed-snapshot.db  # should be True

# Run installer on a clean Windows VM
# Double-click desktop icon
# Check log output — should see "✓ Bootstrapped DB from snapshot"
# Check %LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite is ~4 MB
# Browser should show the Vivim app
```

## Notes

- This task pairs with Task 06 (fix the snapshot-restore path in `src/server/index.ts`). Even with the sidecar copying the snapshot correctly, the server boot still has the `count()`-throws-before-restore bug. Do both.
- The `candidates` array in `bootstrapDb()` checks multiple locations because the install layout may vary. If you can confirm the exact install layout (`%INSTDIR%\data\seed-snapshot.db`), you can simplify to one path.
- Don't try to run Prisma migrations programmatically as part of this task — that's a separate approach (Alternative A in Decision 6). The snapshot copy is simpler and faster.
- If `seeds/seed-snapshot.db` is stale (schema drift since last snapshot), the sidecar will boot but Prisma may throw on first query. Mitigation: re-run `bun run seed:snapshot` before building the installer. Document in release runbook.
