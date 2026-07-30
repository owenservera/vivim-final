// src/engines/reliability/recovery-orchestrator.ts
// RecoveryOrchestrator — coordinates failure classification and recovery.
// Phase 9: Subscribes to SlaveCrashed events and applies class-specific strategies.

import type { FailureClass, RecoveryStrategy } from '../actor/messages.js'
import { classifyFailure } from './classifier.js'
import { executeRecovery, type RecoveryContext, type StrategyResult } from './strategies.js'
import type { EventBus, FleetEvent } from '../events/event-bus.js'
import { getLogger } from '../../observability/logger.js'
import { getMetrics } from '../../observability/metrics.js'

export interface RecoveryAttempt {
  failureClass: FailureClass
  strategy: RecoveryStrategy
  result: StrategyResult
  ts: number
}

export class RecoveryOrchestrator {
  private logger = getLogger('RecoveryOrchestrator')
  private metrics = getMetrics()
  private attempts = new Map<string, RecoveryAttempt[]>()
  private unsubscribe?: () => void

  constructor(
    private eventBus: EventBus,
    private getRecoveryContext: (slaveId: string) => RecoveryContext | undefined,
    private getProviderConfig: (providerId: string) => { maxRetries: Record<FailureClass, number> } | undefined,
  ) {}

  /**
   * Start listening for crash events.
   */
  start(): void {
    this.logger.info('Starting recovery orchestrator')
    this.unsubscribe = this.eventBus.subscribe('SlaveCrashed', async (event: Extract<FleetEvent, { type: 'SlaveCrashed' }>) => {
      await this.handleCrash(event)
    })
  }

  /**
   * Stop listening for events.
   */
  stop(): void {
    this.unsubscribe?.()
    this.logger.info('Stopped recovery orchestrator')
  }

  /**
   * Handle a crash event.
   */
  private async handleCrash(event: Extract<FleetEvent, { type: 'SlaveCrashed' }>): Promise<void> {
    const { slaveId, cause } = event
    const context = this.getRecoveryContext(slaveId)
    if (!context) {
      this.logger.warn('No recovery context for slave', { slaveId })
      return
    }

    // Classify the failure
    const classification = classifyFailure(new Error(cause))
    this.logger.info('Classified failure', {
      slaveId,
      failureClass: classification.failureClass,
      confidence: classification.confidence,
      signals: classification.signals,
    })

    // Get provider config for max retries
    const providerConfig = this.getProviderConfig(context.providerId)
    const maxRetries = providerConfig?.maxRetries[classification.failureClass] ?? 3

    // Check retry count
    const attempts = this.attempts.get(slaveId) ?? []
    const recentAttempts = attempts.filter(
      (a) => a.failureClass === classification.failureClass && Date.now() - a.ts < 300_000
    )

    if (recentAttempts.length >= maxRetries) {
      this.logger.warn('Max retries exceeded', {
        slaveId,
        failureClass: classification.failureClass,
        attempts: recentAttempts.length,
        maxRetries,
      })
      this.metrics.incCounter('chrome_recovery_exhausted_total', { failureClass: classification.failureClass })
      return
    }

    // Determine strategy from provider config
    const strategy = this.getStrategy(classification.failureClass, context.providerId)

    // Execute recovery
    const result = await executeRecovery(classification.failureClass, strategy, context)

    // Record attempt
    const attempt: RecoveryAttempt = {
      failureClass: classification.failureClass,
      strategy,
      result,
      ts: Date.now(),
    }
    attempts.push(attempt)
    this.attempts.set(slaveId, attempts)

    // Publish recovery event
    if (result.success) {
      await this.eventBus.publish({
        type: 'SlaveRecovered',
        slaveId,
        strategy,
        ts: Date.now(),
      })
      this.metrics.incCounter('chrome_recovery_total', { result: 'success', failureClass: classification.failureClass })
    } else {
      this.metrics.incCounter('chrome_recovery_total', { result: 'failure', failureClass: classification.failureClass })
    }
  }

  private getStrategy(failureClass: FailureClass, providerId: string): RecoveryStrategy {
    const config = this.getProviderConfig(providerId)
    return config?.maxRetries[failureClass]
      ? this.getDefaultStrategy(failureClass)
      : this.getDefaultStrategy(failureClass)
  }

  private getDefaultStrategy(failureClass: FailureClass): RecoveryStrategy {
    const strategies: Record<FailureClass, RecoveryStrategy> = {
      OOM: 'kill_disable_gpu',
      RendererCrash: 'renavigate_only',
      BrowserCrash: 'ensure_running',
      NavigationTimeout: 'reload_clear_cookies',
      ProviderTimeout: 'reload_reinject_antidetection',
      AuthFailure: 'visible_relaunch',
      ProfileCorruption: 'reallocate_profile',
      CdpDisconnect: 'force_reconnect',
      GpuFailure: 'kill_disable_gpu',
      Unknown: 'circuit_breaker',
    }
    return strategies[failureClass]
  }

  /**
   * Get recovery attempts for a slave.
   */
  getAttempts(slaveId: string): RecoveryAttempt[] {
    return this.attempts.get(slaveId) ?? []
  }
}
