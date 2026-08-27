// scripts/backup-db.ts
// Creates a timestamped paired backup of system.db + user.db.
// Run: bun run db:backup

import { existsSync, copyFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const DATA_DIR = join(ROOT, 'prisma', 'data')
const SYSTEM_DB = join(DATA_DIR, 'system.db')
const USER_DB = join(DATA_DIR, 'user.db')
const SNAPSHOTS_DIR = join(ROOT, 'snapshots')

function walCheckpoint(dbPath: string) {
  try {
    execSync(`sqlite3 "${dbPath}" "PRAGMA wal_checkpoint(TRUNCATE);"`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch { /* non-fatal */ }
}

function readSchemaMeta(dbPath: string): Record<string, string> {
  try {
    const rows = execSync(
      `sqlite3 "${dbPath}" "SELECT key, value FROM SchemaMeta;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const meta: Record<string, string> = {}
    for (const line of rows.trim().split('\n')) {
      const [key, ...rest] = line.split('|')
      if (key) meta[key] = rest.join('|')
    }
    return meta
  } catch {
    return {}
  }
}

function main() {
  for (const db of [SYSTEM_DB, USER_DB]) {
    if (!existsSync(db)) {
      console.error(`Missing: ${db}`)
      process.exit(1)
    }
    const size = statSync(db).size
    if (size < 1024) {
      console.error(`DB too small (${size} bytes): ${db}`)
      process.exit(1)
    }
  }

  walCheckpoint(SYSTEM_DB)
  walCheckpoint(USER_DB)

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const snapDir = join(SNAPSHOTS_DIR, ts)
  mkdirSync(snapDir, { recursive: true })

  copyFileSync(SYSTEM_DB, join(snapDir, 'system.db'))
  copyFileSync(USER_DB, join(snapDir, 'user.db'))

  const systemMeta = readSchemaMeta(SYSTEM_DB)
  const userMeta = readSchemaMeta(USER_DB)
  writeFileSync(join(snapDir, 'system-meta.json'), JSON.stringify(systemMeta, null, 2))
  writeFileSync(join(snapDir, 'user-meta.json'), JSON.stringify(userMeta, null, 2))
  writeFileSync(join(snapDir, 'snapshot.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    app_version: '1.3.14',
    system_schema_version: systemMeta.schema_version ?? 'unknown',
    user_schema_version: userMeta.schema_version ?? 'unknown',
  }, null, 2))

  console.log(`Paired snapshot created: ${snapDir}`)
}

main()
