// src/storage/db-health.ts
// DB health telemetry for the dual-DB architecture.
// Runs PRAGMA integrity_check, file size monitoring, WAL checkpoint lag,
// and PRAGMA verification on boot and periodically.

import { statSync } from 'node:fs'
import { config } from '../config.js'
import { getLogger } from '../lib/logger.js'
import { getSystemPrisma, getUserPrisma } from './prisma.js'

const log = getLogger('db-health')

// ── Health Types ────────────────────────────────────────────────────────

export interface DbHealthSnapshot {
  integrityCheck: 'ok' | 'error' | 'unknown'
  fileSizeBytes: number
  walCheckpointLag: number
  pragmaValues: Record<string, unknown>
  schemaVersion: string
  timestamp: string
}

export interface DualDbHealth {
  system: DbHealthSnapshot
  user: DbHealthSnapshot
}

// ── Health Check Functions ──────────────────────────────────────────────

/**
 * Run PRAGMA integrity_check on a DB file.
 * Uses sqlite3 CLI for reliability (avoids Prisma client overhead for a single check).
 */
function runIntegrityCheck(dbPath: string): 'ok' | 'error' | 'unknown' {
  try {
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    const result = execSync(`sqlite3 "${dbPath}" "PRAGMA integrity_check;"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return result.trim() === 'ok' ? 'ok' : 'error'
  } catch {
    return 'unknown'
  }
}

/**
 * Get WAL checkpoint lag (pages not yet checkpointed).
 */
async function getWalCheckpointLag(client: {
  $queryRawUnsafe: <T = unknown>(sql: string) => Promise<T>
}): Promise<number> {
  try {
    const result = await client.$queryRawUnsafe<{ wal_checkpoint: number }>(
      'PRAGMA wal_checkpoint(PASSIVE)',
    )
    // wal_checkpoint returns [busy, log, checkpointed] — log - checkpointed = lag
    const row = Array.isArray(result) ? result[0] : result
    if (row && typeof row === 'object' && 'wal_checkpoint' in row) {
      return Number(row.wal_checkpoint) || 0
    }
    return 0
  } catch {
    return 0
  }
}

/**
 * Get current PRAGMA values for a client.
 */
async function getPragmaValues(client: {
  $queryRawUnsafe: <T = unknown>(sql: string) => Promise<T>
}): Promise<Record<string, unknown>> {
  const pragmas: Record<string, unknown> = {}
  const keys = [
    'journal_mode',
    'synchronous',
    'cache_size',
    'busy_timeout',
    'foreign_keys',
    'wal_autocheckpoint',
  ]

  for (const key of keys) {
    try {
      const result = await client.$queryRawUnsafe<Record<string, unknown>>(
        `PRAGMA ${key}`
      )
      const row = Array.isArray(result) ? result[0] : result
      if (row) {
        pragmas[key] = row[key] ?? row[Object.keys(row)[0] ?? '']
      }
    } catch {
      pragmas[key] = 'error'
    }
  }

  return pragmas
}

/**
 * Get schema version from SchemaMeta.
 */
function getSchemaVersion(dbPath: string): string {
  try {
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    const result = execSync(
      `sqlite3 "${dbPath}" "SELECT value FROM SchemaMeta WHERE key = 'schema_version';"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const parsed = JSON.parse(result.trim())
    return parsed?.version?.toString() ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Get health snapshot for a single DB.
 */
async function getSingleDbHealth(
  dbPath: string,
  client: { $queryRawUnsafe: (sql: string) => Promise<unknown> },
): Promise<DbHealthSnapshot> {
  // Use type assertion since Prisma client $queryRawUnsafe has broader signature
  const safeClient = client as {
    $queryRawUnsafe: <T = unknown>(sql: string) => Promise<T>
  }
  const [integrityCheck, fileSizeBytes, walCheckpointLag, pragmaValues] = await Promise.all([
    Promise.resolve(runIntegrityCheck(dbPath)),
    Promise.resolve(statSync(dbPath).size),
    getWalCheckpointLag(safeClient),
    getPragmaValues(safeClient),
  ])

  const schemaVersion = getSchemaVersion(dbPath)

  return {
    integrityCheck,
    fileSizeBytes,
    walCheckpointLag,
    pragmaValues,
    schemaVersion,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Get health snapshot for both system and user DBs.
 */
export async function getDbHealth(): Promise<DualDbHealth> {
  const systemClient = getSystemPrisma()
  const userClient = getUserPrisma()

  const [system, user] = await Promise.all([
    getSingleDbHealth(config.systemDbPath, systemClient),
    getSingleDbHealth(config.userDbPath, userClient),
  ])

  return { system, user }
}

/**
 * Quick integrity check for both DBs (used during boot).
 * Returns true if both pass, false if either fails.
 */
export async function checkIntegrityOnBoot(): Promise<boolean> {
  const systemOk = runIntegrityCheck(config.systemDbPath)
  const userOk = runIntegrityCheck(config.userDbPath)

  if (systemOk !== 'ok' || userOk !== 'ok') {
    log.error({ systemOk, userOk }, 'DB integrity check failed on boot')
    return false
  }

  log.debug('DB integrity check passed on boot')
  return true
}
