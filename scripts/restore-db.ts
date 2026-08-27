// scripts/restore-db.ts
// Restores system.db + user.db from the latest paired snapshot.
// Run: bun run db:restore [--from <snapshot-dir>]

import { existsSync, copyFileSync, readdirSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const DATA_DIR = join(ROOT, 'prisma', 'data')
const SYSTEM_DB = join(DATA_DIR, 'system.db')
const USER_DB = join(DATA_DIR, 'user.db')
const SNAPSHOTS_DIR = join(ROOT, 'snapshots')

function findLatestSnapshot(): string | null {
  if (!existsSync(SNAPSHOTS_DIR)) return null
  const dirs = readdirSync(SNAPSHOTS_DIR)
    .filter(d => existsSync(join(SNAPSHOTS_DIR, d, 'snapshot.json')))
    .sort()
    .reverse()
  return dirs.length > 0 ? join(SNAPSHOTS_DIR, dirs[0]!) : null
}

function main() {
  const args = process.argv.slice(2)
  const fromIdx = args.indexOf('--from')
  const snapDir = fromIdx >= 0
    ? join(SNAPSHOTS_DIR, args[fromIdx + 1]!)
    : findLatestSnapshot()

  if (!snapDir || !existsSync(snapDir)) {
    console.error('No snapshot found. Create one first with: bun run db:backup')
    process.exit(1)
  }

  const sysSrc = join(snapDir, 'system.db')
  const usrSrc = join(snapDir, 'user.db')

  if (!existsSync(sysSrc) || !existsSync(usrSrc)) {
    console.error(`Invalid snapshot: missing DB files in ${snapDir}`)
    process.exit(1)
  }

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  copyFileSync(sysSrc, SYSTEM_DB)
  copyFileSync(usrSrc, USER_DB)

  console.log(`Restored from snapshot: ${snapDir}`)
}

main()
