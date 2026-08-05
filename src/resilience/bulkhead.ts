// src/resilience/bulkhead.ts
// Bulkhead pattern for limiting concurrent operations.
// WP-06 — prevents cascading failures by isolating resource pools with a
// configurable concurrency cap + bounded waiting queue.

import { getLogger } from '../lib/logger.js'
import type { BulkheadConfig } from './types.js'
import { BulkheadRejectedError } from './types.js'

const log = getLogger('resilience:bulkhead')

interface QueuedEntry {
  resolve: () => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class Bulkhead {
  private activeCount = 0
  private rejectedCount = 0
  private queue: QueuedEntry[] = []

  constructor(
    private readonly config: BulkheadConfig,
    public readonly name: string,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Execute a function within the bulkhead's concurrency limit.
   * If the limit is reached the request is queued up to maxQueueSize.
   * If the queue is full (or the queue-timeout fires), a BulkheadRejectedError is thrown.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Fast path: there is room.
    if (this.activeCount < this.config.maxConcurrent) {
      return this.run(fn)
    }

    // Slow path: enqueue.
    if (this.queue.length >= this.config.maxQueueSize) {
      this.rejectedCount++
      log.warn(
        { bulkhead: this.name, active: this.activeCount, queueLen: this.queue.length },
        'bulkhead queue full — rejecting',
      )
      throw new BulkheadRejectedError(this.name)
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove from queue if still waiting.
        const idx = this.queue.findIndex((e) => e.reject === reject)
        if (idx !== -1) this.queue.splice(idx, 1)
        this.rejectedCount++
        log.warn(
          { bulkhead: this.name, queueTimeoutMs: this.config.queueTimeoutMs },
          'bulkhead queue timeout — rejecting',
        )
        reject(new BulkheadRejectedError(this.name))
      }, this.config.queueTimeoutMs)

      this.queue.push({
        resolve: () => {
          clearTimeout(timer)
          this.run(fn).then(resolve, reject)
        },
        reject: (err: Error) => {
          clearTimeout(timer)
          reject(err)
        },
        timer,
      })
    })
  }

  /** Snapshot of bulkhead metrics. */
  getMetrics(): {
    active: number
    queued: number
    available: number
    rejected: number
  } {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      available: Math.max(0, this.config.maxConcurrent - this.activeCount),
      rejected: this.rejectedCount,
    }
  }

  /** Reset internal counters (useful for testing or manual intervention). */
  reset(): void {
    // Reject anything still in the queue (count them before clearing).
    const queueLen = this.queue.length
    for (const entry of this.queue) {
      clearTimeout(entry.timer)
      entry.reject(new BulkheadRejectedError(this.name))
    }
    this.queue = []
    this.activeCount = 0
    // Preserve rejection count from queue drain but don't double-count.
    this.rejectedCount += queueLen
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.activeCount++
    try {
      return await fn()
    } finally {
      this.activeCount--
      this.drainQueue()
    }
  }

  /** Promote the next queued entry (if any) now that a slot is free. */
  private drainQueue(): void {
    if (this.queue.length === 0) return
    if (this.activeCount >= this.config.maxConcurrent) return

    const next = this.queue.shift()
    if (next) {
      next.resolve()
    }
  }
}
