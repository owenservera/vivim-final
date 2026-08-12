// scripts/backup-db.ts
// Creates a timestamped backup of the current dev.db.
// Run: bun run scripts/backup-db.ts
//
// Backups are stored as prisma/dev.db.bak-{ISO-timestamp} and can be
// restored with `bun run db:restore`.

import { existsSync, copyFileSync, statSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const DEV_DB = join(ROOT, 'prisma', 'dev.db')

function main() {
  // 1. Check source DB exists
  if (!existsSync(DEV_DB)) {
    // [audit] removed: console.error(`  ✗ Source DB not found: ${DEV_DB}`)
    process.exit(1)
  }

  const size = statSync(DEV_DB).size
  if (size < 1024) {
    // [audit] removed: console.error(`  ✗ Source DB too small (${size} bytes) — likely empty or corrupt.`)
    process.exit(1)
  }

  // 2. WAL checkpoint to flush WAL into main DB file
  // [audit] removed: console.log('  Flushing WAL...')
  try {
    execSync(
      `sqlite3 "${DEV_DB}" "PRAGMA wal_checkpoint(TRUNCATE);"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
  } catch {
    // [audit] removed: console.log('  ⚠ WAL checkpoint failed (non-fatal, continuing)')
  }

  // 3. Create timestamped backup
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = join(ROOT, 'prisma', `dev.db.bak-${ts}`)

  // [audit] removed: console.log(`  Copying ${DEV_DB} → ${backupPath}`)
  copyFileSync(DEV_DB, backupPath)

  const backupSize = statSync(backupPath).size
  // [audit] removed: console.log(`  ✓ Backup created: ${backupPath} (${(backupSize / 1024).toFixed(0)} KB)`)

  // 4. Show existing backups
  const prismaDir = join(ROOT, 'prisma')
  const backups = readdirSync(prismaDir)
    .filter((f) => f.startsWith('dev.db.bak-'))
    .sort()
    .reverse()

  if (backups.length > 0) {
    // [audit] removed: console.log(`\n  Existing backups (${backups.length}):`)
    for (const b of backups.slice(0, 10)) {
      const bSize = statSync(join(prismaDir, b)).size
      // [audit] removed: console.log(`    ${b} (${(bSize / 1024).toFixed(0)} KB)`)
    }
    if (backups.length > 10) {
      // [audit] removed: console.log(`    ... and ${backups.length - 10} more`)
    }
  }
}

main()
