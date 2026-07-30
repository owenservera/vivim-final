// src/fleet/fleet-manager.ts
// FleetManager — manages distributed worker nodes and global scheduling.
// Phase 10: Orchestrates multi-machine Chrome fleet deployment.

import type { SlaveId } from '../domain/types.js'
import { WorkerNode, type WorkerNodeConfig, type WorkerStatus } from './worker-node.js'
import type { EventBus } from '../engines/events/event-bus.js'
import { getLogger } from '../observability/logger.js'
import { getMetrics } from '../observability/metrics.js'

export interface FleetConfig {
  /** Minimum workers to maintain */
  minWorkers: number
  /** Maximum workers allowed */
  maxWorkers: number
  /** Auto-scale threshold (queue length / available capacity) */
  scaleUpThreshold: number
  /** Scale down threshold (idle workers for N seconds) */
  scaleDownThresholdMs: number
  /** Global concurrency limit */
  globalConcurrency: number
}

export interface FleetStats {
  totalWorkers: number
  readyWorkers: number
  totalActiveInstances: number
  totalQueuedRequests: number
  globalConcurrency: number
}

/**
 * FleetManager manages a distributed fleet of Chrome workers.
 * Handles worker registration, health monitoring, global scheduling, and auto-scaling.
 */
export class FleetManager {
  private workers = new Map<string, WorkerNode>()
  private config: FleetConfig
  private logger = getLogger('FleetManager')
  private metrics = getMetrics()
  private healthCheckTimer?: ReturnType<typeof setInterval>
  private unsubscribe?: () => void

  constructor(
    private eventBus: EventBus,
    config: Partial<FleetConfig> = {},
  ) {
    this.config = {
      minWorkers: 1,
      maxWorkers: 10,
      scaleUpThreshold: 0.8,
      scaleDownThresholdMs: 300_000,
      globalConcurrency: 50,
      ...config,
    }
  }

  /**
   * Start the fleet manager.
   */
  async start(): Promise<void> {
    this.logger.info('Starting FleetManager', { config: this.config })

    // Subscribe to fleet events
    this.unsubscribe = this.eventBus.subscribe('SlaveCrashed', async (event) => {
      this.metrics.incCounter('fleet_slave_crashes_total', {})
    })

    // Start health check loop
    this.healthCheckTimer = setInterval(() => {
      this.healthCheckAll().catch((err) => {
        this.logger.error('Fleet health check failed', { error: err })
      })
    }, 30_000)
  }

  /**
   * Stop the fleet manager.
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping FleetManager')
    this.unsubscribe?.()
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    // Disconnect all workers
    for (const worker of this.workers.values()) {
      await worker.disconnect()
    }
    this.workers.clear()
  }

  /**
   * Register a worker node with the fleet.
   */
  async registerWorker(config: WorkerNodeConfig): Promise<void> {
    if (this.workers.has(config.workerId)) {
      this.logger.warn('Worker already registered', { workerId: config.workerId })
      return
    }

    if (this.workers.size >= this.config.maxWorkers) {
      this.logger.warn('Fleet at max capacity', {
        current: this.workers.size,
        max: this.config.maxWorkers,
      })
      return
    }

    const worker = new WorkerNode(config)
    await worker.connect()
    this.workers.set(config.workerId, worker)

    this.logger.info('Worker registered', { workerId: config.workerId })
    this.metrics.setGauge('fleet_workers_total', {}, this.workers.size)
  }

  /**
   * Unregister a worker node.
   */
  async unregisterWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId)
    if (!worker) return

    await worker.disconnect()
    this.workers.delete(workerId)
    this.logger.info('Worker unregistered', { workerId })
    this.metrics.setGauge('fleet_workers_total', {}, this.workers.size)
  }

  /**
   * Get the best worker for spawning a Chrome instance.
   */
  getBestWorker(tags?: string[]): WorkerNode | null {
    let bestWorker: WorkerNode | null = null
    let bestScore = -1

    for (const worker of this.workers.values()) {
      const info = worker.getInfo()
      if (info.status !== 'ready') continue
      if (info.stats.activeInstances >= info.config.maxConcurrency) continue

      // Score: available capacity + tag match
      let score = (info.config.maxConcurrency - info.stats.activeInstances) / info.config.maxConcurrency
      if (tags && tags.length > 0) {
        const tagMatch = tags.filter((t) => info.config.tags.includes(t)).length
        score += tagMatch * 0.1
      }

      if (score > bestScore) {
        bestScore = score
        bestWorker = worker
      }
    }

    return bestWorker
  }

  /**
   * Spawn a Chrome instance on the best available worker.
   */
  async spawnOnBest(profileDir: string, providerId: string, tags?: string[]): Promise<{ workerId: string; debugPort: number; pid: number } | null> {
    const worker = this.getBestWorker(tags)
    if (!worker) {
      this.logger.warn('No available workers for spawn')
      return null
    }

    const result = await worker.spawn(profileDir, providerId)
    if (!result) return null

    return { workerId: worker.getInfo().config.workerId, ...result }
  }

  /**
   * Kill a Chrome instance on a specific worker.
   */
  async killOnWorker(workerId: string, debugPort: number): Promise<boolean> {
    const worker = this.workers.get(workerId)
    if (!worker) return false
    return worker.kill(debugPort)
  }

  /**
   * Get fleet statistics.
   */
  getStats(): FleetStats {
    let totalActiveInstances = 0
    let totalQueuedRequests = 0
    let readyWorkers = 0

    for (const worker of this.workers.values()) {
      const info = worker.getInfo()
      if (info.status === 'ready') readyWorkers++
      totalActiveInstances += info.stats.activeInstances
      totalQueuedRequests += info.stats.queuedRequests
    }

    return {
      totalWorkers: this.workers.size,
      readyWorkers,
      totalActiveInstances,
      totalQueuedRequests,
      globalConcurrency: this.config.globalConcurrency,
    }
  }

  /**
   * Health check all workers.
   */
  private async healthCheckAll(): Promise<void> {
    for (const [workerId, worker] of this.workers.entries()) {
      try {
        const { healthy, stats } = await worker.healthCheck()
        if (!healthy) {
          this.logger.warn('Worker unhealthy', { workerId })
          this.metrics.incCounter('fleet_worker_unhealthy_total', {})
        }
      } catch (err) {
        this.logger.error('Worker health check error', { workerId, error: err })
      }
    }
  }
}
