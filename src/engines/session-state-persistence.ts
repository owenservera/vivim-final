// src/engines/session-state-persistence.ts
// In-memory + optional file-backed persistence for session state.
// Supports periodic flushing of dirty records to disk.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import type { SessionRecord } from './session-lifecycle-manager.js'

const log = getLogger('session-state-persistence')

const PERSISTENCE_FILENAME = 'sessions.json'

type JsonRow = {
  sessionId: string
  data: string // JSON-serialized SessionRecord
  updatedAt: number
}

export class SessionStatePersistence {
  private readonly records = new Map<string, SessionRecord>()
  private dirty = new Set<string>()
  private flushTimer?: ReturnType<typeof setInterval>
  private readonly persistenceDir: string | undefined

  constructor(persistenceDir?: string) {
    this.persistenceDir = persistenceDir
  }

  /** Save a session record (marks dirty for periodic flush). */
  save(record: SessionRecord): void {
    const existing = this.records.get(record.sessionId)
    this.records.set(record.sessionId, record)
    this.dirty.add(record.sessionId)
    if (!existing) {
      log.debug({ sessionId: record.sessionId }, 'session record saved')
    }
  }

  /** Load a session record from the in-memory cache. */
  load(sessionId: string): SessionRecord | undefined {
    return this.records.get(sessionId)
  }

  /** Delete a session record from the in-memory cache and disk. */
  delete(sessionId: string): void {
    this.records.delete(sessionId)
    this.dirty.delete(sessionId)
    // Also remove from disk immediately
    if (this.persistenceDir) {
      try {
        this.flushToDisk()
      } catch (err) {
        log.warn({ err, sessionId }, 'failed to flush after delete')
      }
    }
    log.debug({ sessionId }, 'session record deleted')
  }

  /** Flush all dirty records to disk (called on state transitions or manually). */
  async flush(): Promise<void> {
    if (!this.persistenceDir) return
    if (this.dirty.size === 0) return

    this.flushToDisk()
    this.dirty.clear()
  }

  /** Load all records from disk (call at startup to recover sessions). */
  async loadFromDisk(): Promise<number> {
    if (!this.persistenceDir) return 0

    const filePath = this.getFilePath()
    if (!existsSync(filePath)) return 0

    try {
      const raw = readFileSync(filePath, 'utf-8')
      const rows: JsonRow[] = JSON.parse(raw)
      let count = 0

      for (const row of rows) {
        try {
          const record: SessionRecord = JSON.parse(row.data)
          this.records.set(record.sessionId, record)
          count++
        } catch (err) {
          log.warn({ err, sessionId: row.sessionId }, 'failed to deserialize session record')
        }
      }

      log.info({ count }, 'session records loaded from disk')
      return count
    } catch (err) {
      log.warn({ err }, 'failed to load session records from disk')
      return 0
    }
  }

  /** Start periodic flush of dirty records to disk. */
  startPeriodicFlush(intervalMs = 30_000): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        log.warn({ err }, 'periodic flush failed')
      })
    }, intervalMs)
    // Allow the process to exit without waiting for the timer
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      ;(this.flushTimer as unknown as { unref(): void }).unref()
    }
    log.debug({ intervalMs }, 'periodic flush started')
  }

  /** Stop periodic flush. */
  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
      log.debug('periodic flush stopped')
    }
  }

  /** Get all in-memory records. */
  getAll(): SessionRecord[] {
    return [...this.records.values()]
  }

  /** Cleanup all resources. */
  destroy(): void {
    this.stopPeriodicFlush()
    // Best-effort final flush
    if (this.persistenceDir && this.dirty.size > 0) {
      try {
        this.flushToDisk()
      } catch (err) {
        catchDebug(err, 'engines:session-state-persistence:135')
        // ignore
      }
    }
    this.records.clear()
    this.dirty.clear()
    log.debug('session state persistence destroyed')
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private getFilePath(): string {
    return join(this.persistenceDir!, PERSISTENCE_FILENAME)
  }

  private flushToDisk(): void {
    if (!this.persistenceDir) return

    // Ensure directory exists
    if (!existsSync(this.persistenceDir)) {
      mkdirSync(this.persistenceDir, { recursive: true })
    }

    // Build array of rows: only records that exist in memory (deletes are reflected)
    const rows: JsonRow[] = []
    for (const [sessionId, record] of this.records) {
      rows.push({
        sessionId,
        data: JSON.stringify(record),
        updatedAt: Date.now(),
      })
    }

    writeFileSync(this.getFilePath(), JSON.stringify(rows, null, 2), 'utf-8')
  }
}
