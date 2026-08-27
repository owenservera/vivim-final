// src/engines/backup-scheduler.ts
// BackupScheduler — scheduled, encrypted, rotating local backups (Unit 36.3)
//
// Produces an encrypted archive of sovereign data (via the DB-envelope path),
// stores it under a local backup dir, rotates old backups beyond the retention
// count, and can restore a snapshot. Fully local-first (no cloud).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EngineError } from '../errors.js'
import { ulid } from '../ids.js'
import { safeJsonParse } from '../lib/safe-json.js'
import { DbEncryptionEngine } from './db-encryption.js'

export type BackupCadence = 'daily' | 'weekly'

export interface BackupScheduleConfig {
  cadence: BackupCadence
  retention: number // keep the N most recent backups
  backupDir: string
  passphrase: string
}

export interface BackupEntry {
  id: string
  createdAt: number
  path: string
  size: number
}

const META_SUFFIX = '.meta.json'

export class BackupScheduler {
  private readonly config: BackupScheduleConfig
  private readonly crypto: DbEncryptionEngine
  private readonly now: () => number

  constructor(config: BackupScheduleConfig, opts: { now?: () => number } = {}) {
    if (config.retention < 1) {
      throw new EngineError('BackupScheduler: retention must be >= 1')
    }
    this.config = config
    this.crypto = new DbEncryptionEngine(config.passphrase)
    this.now = opts.now ?? (() => Date.now())
  }

  private ensureDir(): void {
    if (!existsSync(this.config.backupDir)) {
      mkdirSync(this.config.backupDir, { recursive: true })
    }
  }

  // Snapshot `sourcePath` (the live DB / data file) into an encrypted backup.
  async runOnce(sourcePath: string): Promise<BackupEntry> {
    this.ensureDir()
    const plain = new Uint8Array(readFileSync(sourcePath))
    const blob = this.crypto.encryptBytes(plain)
    const ts = this.now()
    const id = ulid()
    const encPath = join(this.config.backupDir, `${ts}-${id}.enc`)
    const metaPath = `${encPath}${META_SUFFIX}`
    writeFileSync(encPath, JSON.stringify(blob))
    const entry: BackupEntry = { id, createdAt: ts, path: encPath, size: plain.length }
    writeFileSync(metaPath, JSON.stringify({ id, createdAt: ts, source: sourcePath }))
    this.rotate()
    return entry
  }

  list(): BackupEntry[] {
    if (!existsSync(this.config.backupDir)) return []
    return readdirSync(this.config.backupDir)
      .filter((f) => f.endsWith('.enc'))
      .map((f) => {
        const p = join(this.config.backupDir, f)
        const meta = this.readMeta(p)
        return { id: meta?.id ?? f, createdAt: meta?.createdAt ?? 0, path: p, size: 0 }
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  // Prune backups beyond the retention count (keeps the most recent N).
  rotate(): void {
    const entries = this.list()
    if (entries.length <= this.config.retention) return
    for (const stale of entries.slice(this.config.retention)) {
      rmSync(stale.path, { force: true })
      rmSync(`${stale.path}${META_SUFFIX}`, { force: true })
    }
  }

  // Restore a snapshot (by id or path) into `destPath`.
  restore(snapshotId: string, destPath: string): void {
    const match = this.list().find((e) => e.id === snapshotId || e.path === snapshotId)
    if (!match) throw new EngineError(`Backup snapshot not found: ${snapshotId}`)
    const blob = safeJsonParse<Parameters<DbEncryptionEngine['decryptBytes']>[0]>(
      readFileSync(match.path, 'utf8'),
      {} as Parameters<DbEncryptionEngine['decryptBytes']>[0],
    )
    const plain = this.crypto.decryptBytes(blob)
    writeFileSync(destPath, Buffer.from(plain))
  }

  private readMeta(encPath: string): { id: string; createdAt: number; source: string } | null {
    try {
      return JSON.parse(readFileSync(`${encPath}${META_SUFFIX}`, 'utf8'))
    } catch {
      return null
    }
  }
}
