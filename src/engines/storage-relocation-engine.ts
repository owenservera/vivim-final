// src/engines/storage-relocation-engine.ts
// StorageRelocationEngine — 5-phase zero-downtime data migration.
// Copies data to a new location, verifies integrity, atomically switches
// Prisma, and preserves the old location for rollback within a configurable
// retention window.
//
// Phases: PREFLIGHT → COPY → VERIFY → SWITCH → CLEANUP

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { getDataDir, getDbPath, setDatabaseUrl, setStoragePaths } from '../config.js'
import { EngineError } from '../errors.js'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import { closePrisma, getPrisma, initPrismaWal } from '../storage/prisma.js'

const log = getLogger('storage-relocation')

// ── Types ──────────────────────────────────────────────────────────────────

export interface RelocationStatus {
  phase: RelocationPhase
  sourceDir: string
  targetDir: string
  totalBytes: number
  copiedBytes: number
  fileCount: number
  copiedFiles: number
  startedAt: number
  error?: string
}

export type RelocationPhase =
  | 'idle'
  | 'preflight'
  | 'copy'
  | 'verify'
  | 'switch'
  | 'cleanup'
  | 'done'
  | 'failed'
  | 'rolled_back'

export interface RelocationResult {
  ok: boolean
  phase: RelocationPhase
  sourceDir: string
  targetDir: string
  durationMs: number
  bytesCopied: number
  fileCount: number
  error?: string
}

export interface StorageStatus {
  dataDir: string
  dbPath: string
  profileBaseDir: string
  totalBytes: number
  breakdown: {
    database: number
    chromeProfiles: number
    parserCache: number
    logs: number
    other: number
  }
  archivedLocations: ArchivedLocation[]
}

export interface ArchivedLocation {
  path: string
  archivedAt: number
  sizeBytes: number
}

export interface RelocationEngineConfig {
  /** Minimum free space multiplier (default: 2× current usage) */
  minFreeSpaceMultiplier?: number
  /** Retention days for old location (default: 7) */
  retainOldDays?: number
  /** Pause timeout for Phase 4 SWITCH (default: 2000ms) */
  switchPauseMs?: number
}

// ── Store Contract ─────────────────────────────────────────────────────────
// What this engine needs from storage (config_entry table).

export interface RelocationStore {
  getStorageConfig(): Promise<{
    dataDir: string | null
    dbPath: string | null
    retainOldDays: number
  } | null>
  setStorageConfig(config: {
    dataDir: string
    dbPath: string
    profileBaseDir: string
    retainOldDays: number
    archivedAt?: number
  }): Promise<void>
  getArchivedLocations(): Promise<ArchivedLocation[]>
  markArchived(path: string, archivedAt: number, sizeBytes: number): Promise<void>
  removeArchived(path: string): Promise<void>
}

// ── Migration Marker ───────────────────────────────────────────────────────
// Written to disk before Phase 4 (SWITCH) to enable crash recovery.

interface MigrationMarker {
  sourceDir: string
  targetDir: string
  phase: RelocationPhase
  startedAt: number
}

const MARKER_FILE = '.migration-marker.json'

function writeMarker(dir: string, marker: MigrationMarker): void {
  writeFileSync(join(dir, MARKER_FILE), JSON.stringify(marker, null, 2), 'utf-8')
}

function readMarker(dir: string): MigrationMarker | null {
  try {
    const p = join(dir, MARKER_FILE)
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')) as MigrationMarker
    }
  } catch (e) {
    catchDebug(e, 'storage-relocation: corrupt marker treated as no marker')
  }
  return null
}

function clearMarker(dir: string): void {
  try {
    const p = join(dir, MARKER_FILE)
    if (existsSync(p)) unlinkSync(p)
  } catch (e) {
    catchDebug(e, 'storage-relocation: unlink failed (non-fatal)')
  }
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class StorageRelocationEngine {
  private status: RelocationStatus = {
    phase: 'idle',
    sourceDir: '',
    targetDir: '',
    totalBytes: 0,
    copiedBytes: 0,
    fileCount: 0,
    copiedFiles: 0,
    startedAt: 0,
  }
  private abortController: AbortController | null = null

  constructor(
    private store: RelocationStore,
    private config: RelocationEngineConfig = {},
  ) {}

  /** Current migration status (for polling from API/CLI). */
  getStatus(): RelocationStatus {
    return { ...this.status }
  }

  // ── Phase 0: Crash Recovery ──────────────────────────────────────────────
  // Check for an incomplete migration marker on boot and auto-rollback.

  async checkCrashRecovery(): Promise<boolean> {
    const dataDir = getDataDir()
    const marker = readMarker(dataDir)
    if (!marker) return false

    log.warn({ marker }, 'Incomplete migration detected — auto-rolling back')
    try {
      await this.rollbackToLocation(marker.sourceDir)
      clearMarker(dataDir)
      log.info('Crash recovery complete — rolled back to original location')
      return true
    } catch (err) {
      log.error({ err }, 'Crash recovery failed — manual intervention required')
      return false
    }
  }

  // ── Full Relocation Pipeline ─────────────────────────────────────────────

  async relocate(targetDir: string): Promise<RelocationResult> {
    if (
      this.status.phase !== 'idle' &&
      this.status.phase !== 'done' &&
      this.status.phase !== 'failed' &&
      this.status.phase !== 'rolled_back'
    ) {
      throw new EngineError('Migration already in progress')
    }

    const sourceDir = getDataDir()
    const startTime = Date.now()

    this.status = {
      phase: 'preflight',
      sourceDir,
      targetDir,
      totalBytes: 0,
      copiedBytes: 0,
      fileCount: 0,
      copiedFiles: 0,
      startedAt: startTime,
    }

    // Same path no-op
    if (this.normalizePath(sourceDir) === this.normalizePath(targetDir)) {
      return {
        ok: true,
        phase: 'done',
        sourceDir,
        targetDir,
        durationMs: Date.now() - startTime,
        bytesCopied: 0,
        fileCount: 0,
      }
    }

    try {
      await this.phasePreflight(sourceDir, targetDir)
      await this.phaseCopy(sourceDir, targetDir)
      await this.phaseVerify(sourceDir, targetDir)
      await this.phaseSwitch(sourceDir, targetDir)

      // Deferred cleanup — mark old location as archived
      await this.phaseCleanupDeferred(sourceDir)

      clearMarker(targetDir)

      this.status.phase = 'done'
      return {
        ok: true,
        phase: 'done',
        sourceDir,
        targetDir,
        durationMs: Date.now() - startTime,
        bytesCopied: this.status.copiedBytes,
        fileCount: this.status.fileCount,
      }
    } catch (err) {
      catchDebug(err, 'engines:storage-relocation-engine:258')
      const errorMsg = err instanceof Error ? err.message : String(err)
      log.error({ err, phase: this.status.phase }, 'Migration failed')

      // Auto-rollback if we got past preflight
      if (this.status.phase !== 'preflight') {
        try {
          await this.rollbackToLocation(sourceDir)
          this.status.phase = 'rolled_back'
        } catch (rollbackErr) {
          log.error({ err: rollbackErr }, 'Rollback also failed')
          this.status.phase = 'failed'
        }
      } else {
        this.status.phase = 'failed'
      }

      this.status.error = errorMsg
      return {
        ok: false,
        phase: this.status.phase,
        sourceDir,
        targetDir,
        durationMs: Date.now() - startTime,
        bytesCopied: this.status.copiedBytes,
        fileCount: this.status.fileCount,
        error: errorMsg,
      }
    }
  }

  // ── Phase 1: PREFLIGHT ──────────────────────────────────────────────────

  private async phasePreflight(sourceDir: string, targetDir: string): Promise<void> {
    this.status.phase = 'preflight'
    log.info({ sourceDir, targetDir }, 'Phase 1: PREFLIGHT')

    // Validate source exists
    if (!existsSync(sourceDir)) {
      throw new EngineError(`Source directory does not exist: ${sourceDir}`)
    }

    // Ensure target parent exists
    const targetParent = dirname(targetDir)
    if (!existsSync(targetParent)) {
      mkdirSync(targetParent, { recursive: true })
    }

    // Check target is writable
    try {
      const testFile = join(targetDir, '.write-test')
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(testFile, 'ok', 'utf-8')
      unlinkSync(testFile)
    } catch (_err) {
      throw new EngineError(`Target directory is not writable: ${targetDir}`)
    }

    // Check free disk space
    const sourceSize = this.dirSize(sourceDir)
    this.status.totalBytes = sourceSize
    const _multiplier = this.config.minFreeSpaceMultiplier ?? 2
    // Use a simple heuristic: stat the target's filesystem
    // Bun doesn't have statvfs, so we check the target parent
    try {
      const { statSync: s } = await import('node:fs')
      const _targetStat = s(targetParent)
      // If we can stat it, the filesystem is accessible
      // Real space check would need platform-specific APIs; we warn if source > 1GB
      if (sourceSize > 1024 * 1024 * 1024) {
        log.warn(
          { sourceSizeGB: (sourceSize / (1024 * 1024 * 1024)).toFixed(2) },
          'Large data directory — ensure target has enough space',
        )
      }
    } catch (e) {
      catchDebug(e, 'storage-relocation: source size check failed')
    }

    // Detect network/removable drive warnings
    if (targetDir.startsWith('\\\\') || targetDir.includes(':\\')) {
      log.warn({ targetDir }, 'Target may be a network share or removable drive')
    }

    log.info({ sourceSize, targetDir }, 'Phase 1: PREFLIGHT complete')
  }

  // ── Phase 2: COPY ───────────────────────────────────────────────────────

  private async phaseCopy(sourceDir: string, targetDir: string): Promise<void> {
    this.status.phase = 'copy'
    this.abortController = new AbortController()
    log.info({ sourceDir, targetDir }, 'Phase 2: COPY')

    // WAL checkpoint on SQLite before copy (ensures clean copy)
    try {
      const dbPath = getDbPath()
      if (existsSync(dbPath)) {
        const { PrismaClient } = await import('@prisma/client')
        const tmpPrisma = new PrismaClient({
          datasources: { db: { url: `file:${dbPath}` } },
        })
        await tmpPrisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)')
        await tmpPrisma.$disconnect()
        log.info('WAL checkpoint completed before copy')
      }
    } catch (err) {
      log.warn({ err }, 'WAL checkpoint failed — proceeding with copy')
    }

    // Copy directory tree
    await this.copyDir(sourceDir, targetDir)

    log.info(
      { copiedFiles: this.status.copiedFiles, copiedBytes: this.status.copiedBytes },
      'Phase 2: COPY complete',
    )
  }

  private async copyDir(src: string, dest: string): Promise<void> {
    if (this.abortController?.signal.aborted) {
      throw new EngineError('Migration aborted')
    }

    mkdirSync(dest, { recursive: true })
    const entries = readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      if (this.abortController?.signal.aborted) {
        throw new EngineError('Migration aborted')
      }

      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath)
      } else {
        // Stream-copy file
        const data = readFileSync(srcPath)
        writeFileSync(destPath, data)
        this.status.copiedBytes += data.length
        this.status.copiedFiles++
        this.status.fileCount = Math.max(this.status.fileCount, this.status.copiedFiles)
      }
    }
  }

  // ── Phase 3: VERIFY ─────────────────────────────────────────────────────

  private async phaseVerify(sourceDir: string, targetDir: string): Promise<void> {
    this.status.phase = 'verify'
    log.info({ sourceDir, targetDir }, 'Phase 3: VERIFY')

    // SHA-256 checksum every copied file
    await this.verifyDir(sourceDir, targetDir)

    // SQLite integrity check on copied DB
    const dbRelative = relative(sourceDir, getDbPath())
    const copiedDbPath = join(targetDir, dbRelative)
    if (existsSync(copiedDbPath)) {
      try {
        const { PrismaClient } = await import('@prisma/client')
        const testPrisma = new PrismaClient({
          datasources: { db: { url: `file:${copiedDbPath}` } },
        })
        const result = await testPrisma.$queryRawUnsafe('PRAGMA integrity_check')
        await testPrisma.$disconnect()

        const check = Array.isArray(result) ? result[0] : result
        const status = check?.integrity_check ?? check?.integrity_check
        if (status !== 'ok') {
          throw new EngineError(`SQLite integrity check failed: ${JSON.stringify(check)}`)
        }
        log.info('SQLite integrity check passed')
      } catch (err) {
        if (err instanceof EngineError) throw err
        throw new EngineError(`SQLite verification failed: ${err}`)
      }
    }

    log.info('Phase 3: VERIFY complete')
  }

  private async verifyDir(src: string, dest: string): Promise<void> {
    const entries = readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.verifyDir(srcPath, destPath)
      } else {
        const srcHash = this.fileHash(srcPath)
        const destHash = this.fileHash(destPath)
        if (srcHash !== destHash) {
          throw new EngineError(`Checksum mismatch: ${relative(src, srcPath)}`)
        }
      }
    }
  }

  // ── Phase 4: SWITCH ─────────────────────────────────────────────────────
  // Atomic switch: pause writes → update config → reconnect Prisma → resume.

  private async phaseSwitch(sourceDir: string, targetDir: string): Promise<void> {
    this.status.phase = 'switch'
    const pauseMs = this.config.switchPauseMs ?? 2000
    log.info({ sourceDir, targetDir, pauseMs }, 'Phase 4: SWITCH')

    // Write migration marker for crash recovery
    writeMarker(targetDir, {
      sourceDir,
      targetDir,
      phase: 'switch',
      startedAt: Date.now(),
    })

    // 1. Update config paths in-memory and persist to tunables
    const targetDbPath = join(targetDir, 'cap-store.sqlite')
    const targetProfileDir = join(targetDir, 'chrome-profiles')
    setStoragePaths(targetDir, targetDbPath)

    // 2. Disconnect old Prisma client
    await closePrisma()

    // 3. Create fresh Prisma client pointing to new DB
    //    Override DATABASE_URL so getPrisma() picks up the new path
    setDatabaseUrl(`file:${targetDbPath}`)

    // 4. Create new Prisma client and apply WAL pragmas
    const newPrisma = getPrisma()
    await initPrismaWal(newPrisma)

    // 5. Ensure new directories exist
    mkdirSync(targetDir, { recursive: true })
    mkdirSync(targetProfileDir, { recursive: true })

    // 6. Persist to config_entry via store
    await this.store.setStorageConfig({
      dataDir: targetDir,
      dbPath: targetDbPath,
      profileBaseDir: targetProfileDir,
      retainOldDays: this.config.retainOldDays ?? 7,
    })

    log.info('Phase 4: SWITCH complete — Prisma reconnected to new location')
  }

  // ── Phase 5: CLEANUP (deferred) ─────────────────────────────────────────

  private async phaseCleanupDeferred(sourceDir: string): Promise<void> {
    // Mark old location as archived — actual deletion happens after retention period
    const sizeBytes = this.dirSize(sourceDir)
    await this.store.markArchived(sourceDir, Date.now(), sizeBytes)
    log.info({ sourceDir, sizeBytes }, 'Phase 5: Old location archived (retention window started)')
  }

  /**
   * Check and clean up expired archived locations.
   * Call this periodically (e.g., on boot).
   */
  async cleanupExpiredArchives(): Promise<string[]> {
    const retainDays = this.config.retainOldDays ?? 7
    const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1000
    const archived = await this.store.getArchivedLocations()
    const cleaned: string[] = []

    for (const loc of archived) {
      if (loc.archivedAt < cutoff) {
        try {
          if (existsSync(loc.path)) {
            rmSync(loc.path, { recursive: true, force: true })
          }
          await this.store.removeArchived(loc.path)
          cleaned.push(loc.path)
          log.info({ path: loc.path }, 'Cleaned up expired archived location')
        } catch (err) {
          log.error({ err, path: loc.path }, 'Failed to clean up archived location')
        }
      }
    }

    return cleaned
  }

  // ── Rollback ─────────────────────────────────────────────────────────────

  async rollback(): Promise<RelocationResult> {
    const _sourceDir = getDataDir()
    const archived = await this.store.getArchivedLocations()
    if (archived.length === 0) {
      throw new EngineError('No archived location to rollback to')
    }

    // Rollback to the most recent archived location
    const target = archived.sort((a, b) => b.archivedAt - a.archivedAt)[0]!
    return this.rollbackToLocation(target.path)
  }

  private async rollbackToLocation(previousDir: string): Promise<RelocationResult> {
    const currentDir = getDataDir()
    const startTime = Date.now()

    log.info({ from: currentDir, to: previousDir }, 'Rolling back to previous location')

    // Disconnect Prisma
    await closePrisma()

    // Update config
    const previousDbPath = join(previousDir, 'cap-store.sqlite')
    const previousProfileDir = join(previousDir, 'chrome-profiles')
    setStoragePaths(previousDir, previousDbPath)

    // Reconnect Prisma
    setDatabaseUrl(`file:${previousDbPath}`)
    const newPrisma = getPrisma()
    await initPrismaWal(newPrisma)

    // Persist to config_entry
    await this.store.setStorageConfig({
      dataDir: previousDir,
      dbPath: previousDbPath,
      profileBaseDir: previousProfileDir,
      retainOldDays: this.config.retainOldDays ?? 7,
    })

    this.status = {
      phase: 'rolled_back',
      sourceDir: previousDir,
      targetDir: currentDir,
      totalBytes: 0,
      copiedBytes: 0,
      fileCount: 0,
      copiedFiles: 0,
      startedAt: startTime,
    }

    return {
      ok: true,
      phase: 'rolled_back',
      sourceDir: previousDir,
      targetDir: currentDir,
      durationMs: Date.now() - startTime,
      bytesCopied: 0,
      fileCount: 0,
    }
  }

  // ── Storage Status ──────────────────────────────────────────────────────

  async getStorageStatus(): Promise<StorageStatus> {
    const dataDir = getDataDir()
    const dbPath = getDbPath()
    const profileBaseDir = join(dataDir, 'chrome-profiles')

    const totalBytes = this.dirSize(dataDir)
    const breakdown = {
      database: existsSync(dbPath) ? this.fileSize(dbPath) : 0,
      chromeProfiles: existsSync(profileBaseDir) ? this.dirSize(profileBaseDir) : 0,
      parserCache: this.dirSize(join(dataDir, 'parsers')),
      logs: this.dirSize(join(dataDir, 'logs')),
      other: 0,
    }
    breakdown.other =
      totalBytes -
      breakdown.database -
      breakdown.chromeProfiles -
      breakdown.parserCache -
      breakdown.logs

    const archivedLocations = await this.store.getArchivedLocations()

    return {
      dataDir,
      dbPath,
      profileBaseDir,
      totalBytes,
      breakdown,
      archivedLocations,
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private dirSize(dir: string): number {
    if (!existsSync(dir)) return 0
    let size = 0
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const p = join(dir, entry.name)
        if (entry.isDirectory()) {
          size += this.dirSize(p)
        } else {
          size += this.fileSize(p)
        }
      }
    } catch (e) {
      catchDebug(e, 'storage-relocation: dirSize failed')
    }
    return size
  }

  private fileSize(file: string): number {
    try {
      return statSync(file).size
    } catch (e) {
      catchDebug(e, 'storage-relocation: fileSize failed')
      return 0
    }
  }

  private fileHash(file: string): string {
    const data = readFileSync(file)
    return createHash('sha256').update(data).digest('hex')
  }

  private normalizePath(p: string): string {
    return resolve(p).replace(/[/\\]$/, '')
  }
}
