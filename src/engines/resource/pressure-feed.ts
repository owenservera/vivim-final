// src/engines/resource/pressure-feed.ts
// PressureFeed — unified host pressure monitoring.
// Phase 6: Replaces static SystemPressure with adaptive feedback.

import * as os from 'node:os'
import { getLogger } from '../../observability/logger.js'
import { getMetrics } from '../../observability/metrics.js'

export interface Pressure {
  cpuPct: number
  memPct: number
  gpuMemPct?: number
  chromeRssTotal: number
  rendererCount: number
  fdUsagePct?: number
}

export interface PressureFeedOptions {
  pollIntervalMs: number
  cpuHighThreshold: number
  cpuLowThreshold: number
  memHighThreshold: number
}

const DEFAULT_OPTIONS: PressureFeedOptions = {
  pollIntervalMs: 5_000,
  cpuHighThreshold: 80,
  cpuLowThreshold: 50,
  memHighThreshold: 85,
}

export class PressureFeed {
  private currentPressure: Pressure = {
    cpuPct: 0,
    memPct: 0,
    chromeRssTotal: 0,
    rendererCount: 0,
  }
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private logger = getLogger('PressureFeed')
  private metrics = getMetrics()
  private opts: PressureFeedOptions

  constructor(options?: Partial<PressureFeedOptions>) {
    this.opts = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Start periodic pressure monitoring.
   */
  start(): void {
    this.logger.info('Starting pressure feed', { intervalMs: this.opts.pollIntervalMs })
    this.pollTimer = setInterval(() => this.poll(), this.opts.pollIntervalMs)
    this.poll() // Initial poll
  }

  /**
   * Stop pressure monitoring.
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /**
   * Get current pressure reading.
   */
  getPressure(): Pressure {
    return { ...this.currentPressure }
  }

  /**
   * Check if CPU is under high pressure.
   */
  isCpuHigh(): boolean {
    return this.currentPressure.cpuPct > this.opts.cpuHighThreshold
  }

  /**
   * Check if CPU is under low pressure (can scale up).
   */
  isCpuLow(): boolean {
    return this.currentPressure.cpuPct < this.opts.cpuLowThreshold
  }

  /**
   * Check if memory is under high pressure.
   */
  isMemHigh(): boolean {
    return this.currentPressure.memPct > this.opts.memHighThreshold
  }

  /**
   * Update Chrome RSS total (called by fleet supervisor).
   */
  updateChromeMetrics(rssTotal: number, rendererCount: number): void {
    this.currentPressure.chromeRssTotal = rssTotal
    this.currentPressure.rendererCount = rendererCount
  }

  private poll(): void {
    const cores = Math.max(1, os.cpus().length)
    const load = os.loadavg()[0] ?? 0
    const cpuPct = Math.min(100, Math.max(0, (load / cores) * 100))

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = Math.max(0, totalMem - freeMem)
    const memPct = totalMem > 0 ? Math.min(100, Math.max(0, (usedMem / totalMem) * 100)) : 0

    this.currentPressure.cpuPct = cpuPct
    this.currentPressure.memPct = memPct

    // Update metrics
    this.metrics.setGauge('chrome_resource_pressure', { resource: 'cpu' }, cpuPct)
    this.metrics.setGauge('chrome_resource_pressure', { resource: 'memory' }, memPct)
    this.metrics.setGauge(
      'chrome_resource_pressure',
      { resource: 'chrome_rss' },
      this.currentPressure.chromeRssTotal,
    )
  }
}
