// src/resilience/resilience-pipeline.ts
// Combined resilience pipeline that wraps operations with circuit breaker + retry + bulkhead + timeout.
// WP-06 — the main entry point for callers. A single ResiliencePipeline instance
// composes all resilience patterns into a deterministic execution order:
//   1. Circuit breaker (reject fast when open)
//   2. Bulkhead (limit concurrency)
//   3. Timeout (guard against hanging)
//   4. Retry (back off and try again)

import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import { Bulkhead } from './bulkhead.js'
import { CircuitBreaker, DEFAULT_CB_CONFIG } from './circuit-breaker.js'
import { RetryPolicy } from './retry-policy.js'
import type {
  CircuitBreakerConfig,
  ExecutionResult,
  HealthResult,
  HealthStatus,
  ResiliencePolicy,
  RetryConfig,
} from './types.js'
import { CircuitBreakerOpenError, ResilienceTimeoutError, RetryExhaustedError } from './types.js'

const log = getLogger('resilience:pipeline')

export class ResiliencePipeline {
  private readonly circuitBreaker?: CircuitBreaker
  private readonly retryPolicy?: RetryPolicy
  private readonly bulkhead?: Bulkhead

  constructor(private readonly policy: ResiliencePolicy) {
    const p = policy.name

    if (policy.circuitBreaker) {
      const cfg: CircuitBreakerConfig = {
        failureThreshold:
          policy.circuitBreaker.failureThreshold ?? DEFAULT_CB_CONFIG.failureThreshold,
        resetTimeoutMs: policy.circuitBreaker.resetTimeoutMs ?? DEFAULT_CB_CONFIG.resetTimeoutMs,
        halfOpenSuccessThreshold:
          policy.circuitBreaker.halfOpenSuccessThreshold ??
          DEFAULT_CB_CONFIG.halfOpenSuccessThreshold,
        successThreshold:
          policy.circuitBreaker.successThreshold ?? DEFAULT_CB_CONFIG.successThreshold,
      }
      this.circuitBreaker = new CircuitBreaker(cfg, `${p}:circuit-breaker`)
    }

    if (policy.retry) {
      this.retryPolicy = new RetryPolicy(policy.retry, `${p}:retry`)
    }

    if (policy.bulkhead) {
      this.bulkhead = new Bulkhead(policy.bulkhead, `${p}:bulkhead`)
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Execute an async operation through the full resilience pipeline.
   *
   * Order of guard layers (outer → inner):
   *   1. Circuit breaker — rejects fast when open.
   *   2. Bulkhead — limits concurrency.
   *   3. Retry — wraps the actual call with exponential backoff.
   *   4. Timeout — aborts long-running inner calls.
   */
  async execute<T>(fn: () => Promise<T>): Promise<ExecutionResult<T>> {
    const startMs = Date.now()
    let attempts = 0
    let circuitBreakerTripped = false

    try {
      // 1. Circuit breaker gate.
      if (this.circuitBreaker) {
        if (!this.circuitBreaker.canExecute()) {
          circuitBreakerTripped = true
          throw new CircuitBreakerOpenError(this.circuitBreaker.name)
        }
      }

      // Build the inner function that the retry policy will invoke.
      const innerFn = async (): Promise<T> => {
        // 2. Bulkhead gate.
        if (this.bulkhead) {
          return this.bulkhead.execute(async () => {
            // 3. Timeout gate.
            return this.withTimeout(fn)
          })
        }
        // 3. Timeout gate (no bulkhead).
        return this.withTimeout(fn)
      }

      // 4. Retry wrapper.
      let result: T
      if (this.retryPolicy) {
        result = await this.retryPolicy.execute(innerFn)
      } else {
        result = await innerFn()
      }

      // Record success in circuit breaker.
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess()
      }

      attempts = 1
      return {
        success: true,
        value: result,
        attempts,
        durationMs: Date.now() - startMs,
        circuitBreakerTripped,
        fromCache: false,
      }
    } catch (err) {
      catchDebug(err, 'resilience:resilience-pipeline:117')
      // Record failure in circuit breaker (only for real execution errors).
      if (this.circuitBreaker && !circuitBreakerTripped) {
        this.circuitBreaker.recordFailure()
      }

      const error = err instanceof Error ? err : new Error(String(err))
      attempts = error instanceof RetryExhaustedError ? error.attempts : 1

      log.warn(
        {
          pipeline: this.policy.name,
          attempts,
          durationMs: Date.now() - startMs,
          circuitBreakerTripped,
          error: error.message,
        },
        '[resilience-pipeline] execution failed',
      )

      return {
        success: false,
        error,
        attempts,
        durationMs: Date.now() - startMs,
        circuitBreakerTripped,
        fromCache: false,
      }
    }
  }

  /** Health snapshot of the pipeline's individual components. */
  getHealth(): HealthResult {
    const now = Date.now()
    const children: HealthResult[] = []

    if (this.circuitBreaker) {
      const m = this.circuitBreaker.getMetrics()
      children.push({
        status: cbStateToHealth(m.state),
        component: this.circuitBreaker.name,
        checkedAt: now,
        durationMs: 0,
        details: `state=${m.state} failures=${m.failureCount}`,
      })
    }

    if (this.bulkhead) {
      const m = this.bulkhead.getMetrics()
      const status: HealthStatus =
        m.rejected > 0 ? 'degraded' : m.queued > m.available ? 'degraded' : 'healthy'
      children.push({
        status,
        component: this.bulkhead.name,
        checkedAt: now,
        durationMs: 0,
        details: `active=${m.active} queued=${m.queued} rejected=${m.rejected}`,
      })
    }

    // Overall status is the worst child status.
    const overall = worstStatus(children.map((c) => c.status))

    return {
      status: overall,
      component: this.policy.name,
      checkedAt: now,
      durationMs: 0,
      children,
    }
  }

  /** Aggregated metrics from all components. */
  getMetrics(): {
    circuitBreaker?: ReturnType<CircuitBreaker['getMetrics']>
    retry?: { name: string; config: RetryConfig }
    bulkhead?: ReturnType<Bulkhead['getMetrics']>
  } {
    return {
      circuitBreaker: this.circuitBreaker?.getMetrics(),
      retry: this.retryPolicy
        ? { name: this.retryPolicy.name, config: this.policy.retry as RetryConfig }
        : undefined,
      bulkhead: this.bulkhead?.getMetrics(),
    }
  }

  /** Reset all internal components to their initial state. */
  reset(): void {
    this.circuitBreaker?.reset()
    this.bulkhead?.reset()
    log.info({ pipeline: this.policy.name }, 'pipeline reset')
  }

  /** Direct access to the circuit breaker (for advanced wiring). */
  getCircuitBreaker(): CircuitBreaker | undefined {
    return this.circuitBreaker
  }

  /** Direct access to the bulkhead (for advanced wiring). */
  getBulkhead(): Bulkhead | undefined {
    return this.bulkhead
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.policy.timeout) return fn()

    const { timeoutMs } = this.policy.timeout
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ResilienceTimeoutError(timeoutMs))
      }, timeoutMs)

      fn()
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cbStateToHealth(state: string): HealthStatus {
  switch (state) {
    case 'closed':
      return 'healthy'
    case 'half_open':
      return 'degraded'
    case 'open':
      return 'unhealthy'
    default:
      return 'unknown'
  }
}

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy'
  if (statuses.includes('degraded')) return 'degraded'
  if (statuses.includes('unknown')) return 'unknown'
  return 'healthy'
}
