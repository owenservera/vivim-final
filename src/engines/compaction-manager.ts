// src/engines/compaction-manager.ts
// CompactionManager — manages SQLite VACUUM operations for database compaction

import { getLogger } from '../lib/logger.js'
import type { CapStoreDb } from '../storage/db.js'

const log = getLogger('compaction-manager')

export interface CompactionManagerConfig {
  autoVacuumIntervalMs: number
  minFreeSpaceThreshold: number // percentage
}

export class CompactionManager {
  private intervalId?: ReturnType<typeof setInterval>
  private isRunning = false

  constructor(
    private db: CapStoreDb,
    private config: CompactionManagerConfig = {
      autoVacuumIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      minFreeSpaceThreshold: 20, // 20%
    },
  ) {}

  start(): void {
    if (this.isRunning) {
      log.warn('CompactionManager already running')
      return
    }

    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.checkAndVacuum().catch((err) => {
        log.error({ err }, 'Auto VACUUM check failed')
      })
    }, this.config.autoVacuumIntervalMs)

    log.info('CompactionManager started')
  }

  stop(): void {
    if (!this.isRunning) return

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    this.isRunning = false
    log.info('CompactionManager stopped')
  }

  async vacuum(): Promise<{ freedPages: number; durationMs: number }> {
    const start = Date.now()
    log.info('Starting VACUUM')

    try {
      await this.db.prisma.$executeRaw`VACUUM`
      const durationMs = Date.now() - start
      log.info('VACUUM completed')
      return { freedPages: 0, durationMs }
    } catch (err) {
      log.error({ err }, 'VACUUM failed')
      throw err
    }
  }

  async analyze(): Promise<{ pageCount: number; freePages: number; pageSize: number }> {
    const result = await this.db.prisma.$queryRaw<
      Array<{ page_count: number; freelist_count: number; page_size: number }>
    >`
      SELECT 
        (SELECT count(*) FROM sqlite_master) as page_count,
        (SELECT count(*) FROM pragma_freelist_count) as freelist_count,
        (SELECT page_size FROM pragma_page_size) as page_size
    `

    if (result.length === 0) {
      return { pageCount: 0, freePages: 0, pageSize: 4096 }
    }

    const row = result[0]
    if (!row) {
      return { pageCount: 0, freePages: 0, pageSize: 4096 }
    }
    return {
      pageCount: row.page_count,
      freePages: row.freelist_count,
      pageSize: row.page_size,
    }
  }

  async checkAndVacuum(): Promise<{ vacuumed: boolean; freedPages: number; durationMs: number }> {
    const stats = await this.analyze()
    const freeSpacePercent = stats.pageCount > 0 ? (stats.freePages / stats.pageCount) * 100 : 0

    log.info('VACUUM check')

    if (freeSpacePercent >= this.config.minFreeSpaceThreshold) {
      const result = await this.vacuum()
      return { vacuumed: true, freedPages: stats.freePages, durationMs: result.durationMs }
    }

    return { vacuumed: false, freedPages: 0, durationMs: 0 }
  }

  async getDatabaseSize(): Promise<{ sizeBytes: number; sizeMB: number }> {
    const result = await this.db.prisma.$queryRaw<Array<{ page_count: number; page_size: number }>>`
      SELECT page_count, page_size FROM pragma_page_count, pragma_page_size
    `

    if (result.length === 0) {
      return { sizeBytes: 0, sizeMB: 0 }
    }

    const row = result[0]
    if (!row) {
      return { sizeBytes: 0, sizeMB: 0 }
    }
    const sizeBytes = row.page_count * row.page_size
    return { sizeBytes, sizeMB: sizeBytes / (1024 * 1024) }
  }
}
