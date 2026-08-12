// scripts/seed-snapshot.ts
// Captures the current fully-seeded dev.db as a golden template.
// Run: bun run scripts/seed-snapshot.ts
//
// The snapshot is used by the server boot to instantly restore a seeded DB
// without running individual seed functions.

import { existsSync, copyFileSync, statSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const DEV_DB = join(ROOT, 'prisma', 'dev.db')
const SNAPSHOT = join(ROOT, 'seeds', 'seed-snapshot.db')
const SNAPSHOT_WAL = join(ROOT, 'seeds', 'seed-snapshot.db-wal')
const SNAPSHOT_SHM = join(ROOT, 'seeds', 'seed-snapshot.db-shm')

function main() {
  // 1. Check source DB exists
  if (!existsSync(DEV_DB)) {
    // [audit] removed: console.error(`  ✗ Source DB not found: ${DEV_DB}`)
    // [audit] removed: console.error('    Run the server first to create and seed the database.')
    process.exit(1)
  }

  const size = statSync(DEV_DB).size
  if (size < 1024) {
    // [audit] removed: console.error(`  ✗ Source DB too small (${size} bytes) — likely empty or corrupt.`)
    process.exit(1)
  }

  // 2. Check source DB has data (provider count)
  // [audit] removed: console.log('  Checking source DB is seeded...')
  try {
    // Use sqlite3 CLI to check provider count (fast, no Prisma needed)
    const count = execSync(
      `sqlite3 "${DEV_DB}" "SELECT COUNT(*) FROM provider_definition;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim()

    if (count === '0') {
      // [audit] removed: console.error('  ✗ Source DB has no providers — not fully seeded.')
      // [audit] removed: console.error('    Run the server once to seed, or use FORCE_SEED=true.')
      process.exit(1)
    }
    // [audit] removed: console.log(`  ✓ Source DB has ${count} providers`)
  } catch {
    // sqlite3 not available — use Prisma instead
    // [audit] removed: console.log('  (sqlite3 CLI not found, skipping provider count check)')
  }

  // 3. WAL checkpoint to flush WAL into main DB file
  // [audit] removed: console.log('  Flushing WAL (PRAGMA wal_checkpoint)...')
  try {
    execSync(
      `sqlite3 "${DEV_DB}" "PRAGMA wal_checkpoint(TRUNCATE);"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
  } catch {
    // Non-fatal — copy may still work if WAL is small
    // [audit] removed: console.log('  ⚠ WAL checkpoint failed (non-fatal, continuing)')
  }

  // 4. Copy to snapshot
  // [audit] removed: console.log(`  Copying ${DEV_DB} → ${SNAPSHOT}`)
  copyFileSync(DEV_DB, SNAPSHOT)

  // Clean up any WAL/SHM sidecars that might have been created
  for (const sidecar of [SNAPSHOT_WAL, SNAPSHOT_SHM]) {
    if (existsSync(sidecar)) {
      unlinkSync(sidecar)
    }
  }

  const snapshotSize = statSync(SNAPSHOT).size
  // [audit] removed: console.log(`  ✓ Snapshot created: ${SNAPSHOT} (${(snapshotSize / 1024).toFixed(0)} KB)`)
  // [audit] removed: console.log('')
  // [audit] removed: console.log('  The snapshot will be used by the server boot to instantly restore')
  // [audit] removed: console.log('  a seeded DB on fresh clones. Use FORCE_SEED=true to skip snapshot.')
}

main()
