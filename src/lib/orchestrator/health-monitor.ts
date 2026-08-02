/**
 * VIVIM Orchestrator — Health Monitor
 *
 * Monitors all subsystems (tunnel, P2P, local server) for health.
 * Triggers restarts on crashes and reports status.
 */

import { EventEmitter } from 'node:events'
import { ServiceCrashError } from '../tunnel-shared/errors.js'
import { getLogger } from '../tunnel-shared/logger.js'
import type { OrchestratorStatus, ServiceState, ServiceStatus } from '../tunnel-shared/types.js'
import type { VivimConfig } from '../tunnel-shared/types.js'

const log = getLogger('health-monitor')

export class HealthMonitor extends EventEmitter {
  private config: VivimConfig
  private services: Map<string, ServiceState> = new Map()
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private restartAttempts: Map<string, number> = new Map()

  constructor(config: VivimConfig) {
    super()
    this.config = config
  }

  start(): void {
    this.healthTimer = setInterval(
      () => this.checkHealth(),
      this.config.orchestrator.healthCheckIntervalMs,
    )
    log.info('Health monitor started')
  }

  stop(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
    log.info('Health monitor stopped')
  }

  registerService(name: string): void {
    this.services.set(name, {
      name,
      status: 'stopped',
      startedAt: null,
      errorCount: 0,
      lastError: null,
    })
  }

  updateServiceStatus(name: string, status: ServiceStatus, error?: string): void {
    const service = this.services.get(name)
    if (!service) return

    service.status = status

    if (status === 'running') {
      service.startedAt = Date.now()
      this.restartAttempts.set(name, 0)
    }

    if (status === 'error' && error) {
      service.errorCount++
      service.lastError = error

      const attempt = (this.restartAttempts.get(name) ?? 0) + 1
      this.restartAttempts.set(name, attempt)

      if (attempt <= this.config.orchestrator.maxRestartAttempts) {
        log.warn(
          { service: name, attempt, maxAttempts: this.config.orchestrator.maxRestartAttempts },
          'Service error, will attempt restart',
        )
        this.emit('restart', name, attempt)
      } else {
        log.error({ service: name, attempt }, 'Service exceeded max restart attempts')
        this.emit('fatal', new ServiceCrashError(name, attempt))
      }
    }
  }

  private checkHealth(): void {
    for (const [name, service] of this.services) {
      if (service.status === 'running') {
        // Check if service has been running for a reasonable time
        const uptime = service.startedAt ? Date.now() - service.startedAt : 0
        log.trace({ service: name, status: service.status, uptimeMs: uptime }, 'Health check')
      }
    }
  }

  getStatus(): OrchestratorStatus {
    const services: Record<string, ServiceState> = {}
    for (const [name, state] of this.services) {
      services[name] = { ...state }
    }

    return {
      services,
      uptime: 0, // Set by orchestrator
      tunnel: {
        connected: false,
        subdomain: null,
        reconnectCount: 0,
      },
      p2p: {
        running: false,
        peerCount: 0,
        relayed: false,
      },
      localServer: {
        running: false,
        port: 0,
        requestCount: 0,
      },
    }
  }
}
