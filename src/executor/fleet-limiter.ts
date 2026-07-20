// src/executor/fleet-limiter.ts
// Governor-owned admission control for Chrome spawns.
// Pattern source: browserless Limiter (bounded concurrency + queue + timeout).
// Contains NO CDP — only ChromeGovernor.launchChrome touches Chrome (Governor Canon).

import { FleetQueueFullError, FleetQueueTimeoutError } from './fleet-supervisor.js'

interface Waiter {
  resolve: () => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class FleetLimiter {
  private active = 0
  private readonly waiters: Waiter[] = []

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number,
    private readonly queueTimeoutMs: number,
  ) {}

  /** Acquire a slot or throw. Caller MUST call release() in a finally block. */
  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++
      return
    }
    if (this.waiters.length >= this.maxQueued) {
      throw new FleetQueueFullError(this.waiters.length)
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.timer === timer)
        if (i >= 0) this.waiters.splice(i, 1)
        reject(new FleetQueueTimeoutError(this.queueTimeoutMs))
      }, this.queueTimeoutMs)
      this.waiters.push({ resolve, reject, timer })
    })
    this.active++
  }

  /** Release a slot and hand it to the next waiter (if any). Idempotent-safe. */
  release(): void {
    this.active = Math.max(0, this.active - 1)
    const next = this.waiters.shift()
    if (next) {
      clearTimeout(next.timer)
      next.resolve()
    }
  }

  stats(): { active: number; queued: number; maxConcurrent: number } {
    return { active: this.active, queued: this.waiters.length, maxConcurrent: this.maxConcurrent }
  }
}
