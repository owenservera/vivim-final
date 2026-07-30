// src/fleet/worker-node.ts
// WorkerNode — represents a remote worker that hosts Chrome instances.
// Phase 10: Scale-out workers for multi-machine fleet deployment.

import type { SlaveId } from '../domain/types.js'
import { getLogger } from '../observability/logger.js'
import { getMetrics } from '../observability/metrics.js'

export interface WorkerNodeConfig {
  /** Worker node identifier (hostname or IP) */
  workerId: string
  /** WebSocket or HTTP endpoint for the worker */
  endpoint: string
  /** Max concurrent Chrome instances on this worker */
  maxConcurrency: number
  /** Tags for scheduling (region, gpu, etc.) */
  tags: string[]
  /** Health check interval in ms */
  healthCheckIntervalMs: number
}

export type WorkerStatus = 'connecting' | 'ready' | 'degraded' | 'disconnected'

export interface WorkerNodeStats {
  activeInstances: number
  queuedRequests: number
  totalSpawned: number
  totalFailed: number
  avgSpawnTimeMs: number
  avgResponseTimeMs: number
  lastHealthCheck: Date | null
}

/**
 * WorkerNode represents a remote worker that can host Chrome instances.
 * Communicates with the fleet manager via WebSocket/HTTP.
 */
export class WorkerNode {
  private status: WorkerStatus = 'disconnected'
  private config: WorkerNodeConfig
  private stats: WorkerNodeStats = {
    activeInstances: 0,
    queuedRequests: 0,
    totalSpawned: 0,
    totalFailed: 0,
    avgSpawnTimeMs: 0,
    avgResponseTimeMs: 0,
    lastHealthCheck: null,
  }
  private heartbeatTimer?: ReturnType<typeof setInterval>
  private logger = getLogger('WorkerNode')
  private metrics = getMetrics()

  constructor(config: WorkerNodeConfig) {
    this.config = config
  }

  /**
   * Connect to the worker node.
   */
  async connect(): Promise<void> {
    this.status = 'connecting'
    this.logger.info('Connecting to worker', {
      workerId: this.config.workerId,
      endpoint: this.config.endpoint,
    })

    try {
      // Attempt WebSocket/HTTP connection to worker
      // In production, this would establish a persistent connection
      this.status = 'ready'
      this.startHeartbeat()
      this.metrics.setGauge('worker_status', { workerId: this.config.workerId }, 1)
      this.logger.info('Connected to worker', { workerId: this.config.workerId })
    } catch (err) {
      this.status = 'disconnected'
      this.logger.error('Failed to connect to worker', { workerId: this.config.workerId, error: err })
    }
  }

  /**
   * Disconnect from the worker node.
   */
  async disconnect(): Promise<void> {
    this.stopHeartbeat()
    this.status = 'disconnected'
    this.logger.info('Disconnected from worker', { workerId: this.config.workerId })
  }

  /**
   * Spawn a Chrome instance on this worker.
   */
  async spawn(profileDir: string, providerId: string): Promise<{ debugPort: number; pid: number } | null> {
    if (this.status !== 'ready') {
      this.logger.warn('Worker not ready', { workerId: this.config.workerId, status: this.status })
      return null
    }

    if (this.stats.activeInstances >= this.config.maxConcurrency) {
      this.logger.warn('Worker at capacity', {
        workerId: this.config.workerId,
        active: this.stats.activeInstances,
        max: this.config.maxConcurrency,
      })
      return null
    }

    this.logger.info('Spawning Chrome on worker', {
      workerId: this.config.workerId,
      providerId,
    })

    // In production, this would send a spawn command to the worker
    // For now, simulate a spawn response
    this.stats.totalSpawned++
    this.stats.activeInstances++
    this.metrics.setGauge('worker_active_instances', { workerId: this.config.workerId }, this.stats.activeInstances)

    return { debugPort: 9222 + this.stats.totalSpawned, pid: 1000 + this.stats.totalSpawned }
  }

  /**
   * Kill a Chrome instance on this worker.
   */
  async kill(debugPort: number): Promise<boolean> {
    if (this.status !== 'ready') return false

    this.logger.info('Killing Chrome on worker', {
      workerId: this.config.workerId,
      debugPort,
    })

    // In production, this would send a kill command
    this.stats.activeInstances = Math.max(0, this.stats.activeInstances - 1)
    this.metrics.setGauge('worker_active_instances', { workerId: this.config.workerId }, this.stats.activeInstances)
    return true
  }

  /**
   * Perform a health check on this worker.
   */
  async healthCheck(): Promise<{ healthy: boolean; stats: WorkerNodeStats }> {
    this.stats.lastHealthCheck = new Date()
    this.logger.debug('Health check', { workerId: this.config.workerId })

    // In production, this would query the worker's health endpoint
    const healthy = this.status === 'ready'
    return { healthy, stats: { ...this.stats } }
  }

  /**
   * Get worker status and stats.
   */
  getInfo(): { config: WorkerNodeConfig; status: WorkerStatus; stats: WorkerNodeStats } {
    return {
      config: { ...this.config },
      status: this.status,
      stats: { ...this.stats },
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.healthCheck().catch((err) => {
        this.logger.error('Health check failed', { workerId: this.config.workerId, error: err })
        this.status = 'degraded'
      })
    }, this.config.healthCheckIntervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }
}
