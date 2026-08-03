// scripts/restore-db.ts
// Restores dev.db from the latest backup or from the seed snapshot.
// Run: bun run scripts/restore-db.ts [--from snapshot|backup]
//
// Default: restores from the most recent backup (dev.db.bak-*).
// Use --from snapshot to restore from seeds/seed-snapshot.db instead.

import { existsSync, copyFileSync, statSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const DEV_DB = join(ROOT, 'prisma', 'dev.db')
const PRISMA_DIR = join(ROOT, 'prisma')
const SNAPSHOT = join(ROOT, 'seeds', 'seed-snapshot.db')

function findLatestBackup(): string | null {
  if (!existsSync(PRISMA_DIR)) return null
  const backups = readdirSync(PRISMA_DIR)
    .filter((f) => f.startsWith('dev.db.bak-'))
    .sort()
    .reverse()
  return backups.length > 0 ? join(PRISMA_DIR, backups[0]) : null
}

function main() {
  const args = process.argv.slice(2)
  const fromIdx = args.indexOf('--from')
  const source = fromIdx >= 0 ? args[fromIdx + 1] : 'backup'

  let restoreFrom: string | null = null
  let sourceLabel: string = ''

  if (source === 'snapshot') {
    restoreFrom = existsSync(SNAPSHOT) ? SNAPSHOT : null
    sourceLabel = 'seed snapshot'
  } else {
    restoreFrom = findLatestBackup()
    sourceLabel = 'latest backup'
  }

  if (!restoreFrom) {
    console.error(`  ✗ No ${sourceLabel} found.`)
    if (source === 'snapshot') {
      console.error(`    Expected: ${SNAPSHOT}`)
      console.error('    Run: bun run seed:snapshot')
    } else {
      console.error('    Expected: prisma/dev.db.bak-*')
      console.error('    Run: bun run db:backup')
    }
    process.exit(1)
  }

  const size = statSync(restoreFrom).size
  console.log(`  Restoring from ${sourceLabel}:`)
  console.log(`    Source: ${restoreFrom} (${(size / 1024).toFixed(0)} KB)`)
  console.log(`    Target: ${DEV_DB}`)

  // Copy restore source → dev.db
  copyFileSync(restoreFrom, DEV_DB)

  const restoredSize = statSync(DEV_DB).size
  console.log(`  ✓ Restored (${(restoredSize / 1024).toFixed(0)} KB)`)
  console.log('  Restart the server to use the restored database.')
}

main()
