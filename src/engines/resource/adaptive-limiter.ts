// src/engines/resource/adaptive-limiter.ts
// AdaptiveLimiter — dynamic concurrency control based on host pressure.
// Phase 6: Replaces static FleetLimiter with adaptive feedback loop.

import { getLogger } from '../../observability/logger.js'
import { getMetrics } from '../../observability/metrics.js'

export interface AdaptiveLimiterOptions {
  initialMax: number
  ceiling: number
  floor: number
  adjustmentIntervalMs: number
  hysteresisBand: number
}

const DEFAULT_OPTIONS: AdaptiveLimiterOptions = {
  initialMax: 10,
  ceiling: 100,
  floor: 1,
  adjustmentIntervalMs: 30_000,
  hysteresisBand: 5,
}

export class AdaptiveLimiter {
  private currentMax: number
  private logger = getLogger('AdaptiveLimiter')
  private metrics = getMetrics()
  private opts: AdaptiveLimiterOptions
  private lastAdjustment = 0
  private adjustTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private getCpuPct: () => number,
    private getQueueDepth: () => number,
    options?: Partial<AdaptiveLimiterOptions>,
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...options }
    this.currentMax = this.opts.initialMax
  }

  /**
   * Start adaptive adjustment loop.
   */
  start(): void {
    this.logger.info('Starting adaptive limiter', { initial: this.currentMax })
    this.adjustTimer = setInterval(() => this.adjust(), this.opts.adjustmentIntervalMs)
  }

  /**
   * Stop adaptive adjustment.
   */
  stop(): void {
    if (this.adjustTimer) {
      clearInterval(this.adjustTimer)
      this.adjustTimer = null
    }
  }

  /**
   * Get current concurrency limit.
   */
  getMaxConcurrent(): number {
    return this.currentMax
  }

  /**
   * Manually set concurrency limit (for testing or overrides).
   */
  setMaxConcurrent(value: number): void {
    this.currentMax = Math.max(this.opts.floor, Math.min(this.opts.ceiling, value))
    this.metrics.setGauge('chrome_concurrency_limit', {}, this.currentMax)
  }

  /**
   * Adjust concurrency based on pressure.
   */
  private adjust(): void {
    const now = Date.now()
    if (now - this.lastAdjustment < this.opts.adjustmentIntervalMs) return

    const cpuPct = this.getCpuPct()
    const queueDepth = this.getQueueDepth()
    const previousMax = this.currentMax

    // Scale down if CPU is high
    if (cpuPct > 80) {
      this.currentMax = Math.max(this.opts.floor, this.currentMax - 1)
      this.logger.info('Scaling down concurrency', {
        cpuPct: cpuPct.toFixed(1),
        from: previousMax,
        to: this.currentMax,
      })
    }
    // Scale up if CPU is low and there's queue pressure
    else if (cpuPct < 50 && queueDepth > 0) {
      this.currentMax = Math.min(this.opts.ceiling, this.currentMax + 1)
      this.logger.info('Scaling up concurrency', {
        cpuPct: cpuPct.toFixed(1),
        queueDepth,
        from: previousMax,
        to: this.currentMax,
      })
    }

    // Hysteresis: don't oscillate faster than 30s
    if (this.currentMax !== previousMax) {
      this.lastAdjustment = now
      this.metrics.setGauge('chrome_concurrency_limit', {}, this.currentMax)
    }
  }
}
