// src/storage/snapshot.ts
// Pre-migration snapshot + rollback for the dual-DB architecture.
// Creates paired snapshots of system.db + user.db before any data migration,
// and restores from snapshot on failure. Reuses WAL checkpoint and SchemaMeta
// patterns from scripts/backup-db.ts.

import { existsSync, copyFileSync, mkdirSync, writeFileSync, readFileSync, statSync, readdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { config } from '../config.js'
import { getLogger } from '../lib/logger.js'

const log = getLogger('snapshot')

const SNAPSHOTS_DIR = join(resolve(import.meta.dir, '..', '..'), 'snapshots')

// ── Helpers (reused from scripts/backup-db.ts) ──────────────────────────

function walCheckpoint(dbPath: string): void {
  try {
    execSync(`sqlite3 "${dbPath}" "PRAGMA wal_checkpoint(TRUNCATE);"`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch { /* non-fatal — DB may be locked */ }
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

function integrityCheck(dbPath: string): boolean {
  try {
    const result = execSync(
      `sqlite3 "${dbPath}" "PRAGMA integrity_check;"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return result.trim() === 'ok'
  } catch {
    return false
  }
}

// ── Snapshot Metadata ───────────────────────────────────────────────────

export interface SnapshotMetadata {
  timestamp: string
  app_version: string
  system_schema_version: string
  user_schema_version: string
}

// ── Create Pre-Migration Snapshot ───────────────────────────────────────

/**
 * Create a paired snapshot of system.db + user.db before a data migration.
 * Runs PRAGMA optimize → WAL checkpoint → copies both DBs + metadata JSON.
 * Returns the snapshot directory path.
 */
export function createPreMigrationSnapshot(): string {
  const systemDb = config.systemDbPath
  const userDb = config.userDbPath

  // Validate both DBs exist and are non-trivial
  for (const db of [systemDb, userDb]) {
    if (!existsSync(db)) {
      throw new Error(`Snapshot failed — missing DB: ${db}`)
    }
    const size = statSync(db).size
    if (size < 1024) {
      throw new Error(`Snapshot failed — DB too small (${size} bytes): ${db}`)
    }
  }

  // PRAGMA optimize before checkpoint for better integrity
  for (const db of [systemDb, userDb]) {
    try {
      execSync(`sqlite3 "${db}" "PRAGMA optimize;"`, {
        encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch { /* non-fatal */ }
  }

  // WAL checkpoint to flush pending writes
  walCheckpoint(systemDb)
  walCheckpoint(userDb)

  // Create snapshot directory
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const snapDir = join(SNAPSHOTS_DIR, `pre-migration-${ts}`)
  mkdirSync(snapDir, { recursive: true })

  // Copy DBs
  copyFileSync(systemDb, join(snapDir, 'system.db'))
  copyFileSync(userDb, join(snapDir, 'user.db'))

  // Read and persist metadata
  const systemMeta = readSchemaMeta(systemDb)
  const userMeta = readSchemaMeta(userDb)
  const metadata: SnapshotMetadata = {
    timestamp: new Date().toISOString(),
    app_version: '1.0.0',
    system_schema_version: systemMeta.schema_version ?? 'unknown',
    user_schema_version: userMeta.schema_version ?? 'unknown',
  }

  writeFileSync(join(snapDir, 'system-meta.json'), JSON.stringify(systemMeta, null, 2))
  writeFileSync(join(snapDir, 'user-meta.json'), JSON.stringify(userMeta, null, 2))
  writeFileSync(join(snapDir, 'snapshot.json'), JSON.stringify(metadata, null, 2))

  log.info({ snapDir, systemSchema: metadata.system_schema_version, userSchema: metadata.user_schema_version }, 'Pre-migration snapshot created')
  return snapDir
}

// ── Restore From Snapshot ───────────────────────────────────────────────

/**
 * Restore both DBs from a snapshot directory. Closes Prisma clients,
 * copies DBs back, reopens, applies configurePrisma(), and verifies integrity.
 *
 * @param snapshotDir  Path to the snapshot directory (e.g. snapshots/pre-migration-2026-08-14T12-00-00)
 * @param opts.skipVersionCheck  If true, skip schema version compatibility check
 */
export async function restoreFromSnapshot(
  snapshotDir: string,
  opts?: { skipVersionCheck?: boolean },
): Promise<void> {
  const systemDb = config.systemDbPath
  const userDb = config.userDbPath
  const snapshotJson = join(snapshotDir, 'snapshot.json')

  // Validate snapshot exists
  if (!existsSync(snapshotJson)) {
    throw new Error(`Snapshot metadata not found: ${snapshotJson}`)
  }
  if (!existsSync(join(snapshotDir, 'system.db')) || !existsSync(join(snapshotDir, 'user.db'))) {
    throw new Error(`Snapshot DBs missing in: ${snapshotDir}`)
  }

  // Schema version compatibility check
  if (!opts?.skipVersionCheck) {
    try {
      const raw = readFileSync(snapshotJson, 'utf-8')
      const snapshot: SnapshotMetadata = JSON.parse(raw)
      const currentVersion = '1.0.0'
      if (snapshot.app_version && snapshot.app_version !== currentVersion) {
        log.warn(
          { snapshotVersion: snapshot.app_version, currentVersion },
          'Schema version mismatch — skipping restore (snapshot may be incompatible)',
        )
        return
      }
    } catch (err) {
      log.warn({ err }, 'Could not read snapshot metadata — proceeding with restore')
    }
  }

  // Close Prisma clients before copying
  const { closePrisma } = await import('./prisma.js')
  await closePrisma()
  log.info('Prisma clients closed for restore')

  // Copy DBs back
  try {
    copyFileSync(join(snapshotDir, 'system.db'), systemDb)
    copyFileSync(join(snapshotDir, 'user.db'), userDb)
    log.info({ snapshotDir }, 'DBs restored from snapshot')
  } catch (err) {
    log.error({ err }, 'Failed to copy DBs from snapshot')
    throw err
  }

  // Reopen Prisma and apply PRAGMAs
  const { getDb } = await import('./db.js')
  const { configurePrisma } = await import('./db.js')
  const db = getDb()
  await configurePrisma(db)
  log.info('Prisma clients reopened and PRAGMAs configured')

  // Verify integrity after restore
  const systemOk = integrityCheck(systemDb)
  const userOk = integrityCheck(userDb)

  if (!systemOk || !userOk) {
    log.error({ systemOk, userOk }, 'Integrity check failed after restore')
    throw new Error(`Integrity check failed after restore (system=${systemOk}, user=${userOk})`)
  }

  log.info('Integrity check passed after restore')
}

// ── List Pre-Migration Snapshots ────────────────────────────────────────

/**
 * List all pre-migration snapshots, sorted newest first.
 * Returns an array of { dirName, path, timestamp } objects.
 */
export function listPreMigrationSnapshots(): Array<{
  dirName: string
  path: string
  timestamp: string
}> {
  if (!existsSync(SNAPSHOTS_DIR)) return []

  const entries = readdirSync(SNAPSHOTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('pre-migration-'))
    .map((e) => {
      const dirPath = join(SNAPSHOTS_DIR, e.name)
      let timestamp = ''
      try {
        const raw = readFileSync(join(dirPath, 'snapshot.json'), 'utf-8')
        const snap: SnapshotMetadata = JSON.parse(raw)
        timestamp = snap.timestamp
      } catch { /* empty */ }
      return { dirName: e.name, path: dirPath, timestamp }
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return entries
}

// ── Cleanup Old Snapshots ───────────────────────────────────────────────

/**
 * Retain only the N most recent pre-migration snapshots, deleting older ones.
 * @param keepCount  Number of snapshots to keep (default 5)
 */
export function cleanupOldSnapshots(keepCount = 5): number {
  const snapshots = listPreMigrationSnapshots()
  if (snapshots.length <= keepCount) return 0

  const toDelete = snapshots.slice(keepCount)
  let deleted = 0

  for (const snap of toDelete) {
    try {
      rmSync(snap.path, { recursive: true, force: true })
      deleted++
      log.debug({ dir: snap.dirName }, 'Deleted old pre-migration snapshot')
    } catch (err) {
      log.warn({ err, dir: snap.dirName }, 'Failed to delete old snapshot')
    }
  }

  if (deleted > 0) {
    log.info({ deleted, kept: keepCount }, 'Cleaned up old pre-migration snapshots')
  }
  return deleted
}
