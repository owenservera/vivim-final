// src/resilience/circuit-breaker.ts
// Unified circuit breaker implementation.
// WP-06 — state machine: closed → open → half_open → closed.
// Emits state transitions to the CapabilityEventBus (if available) for observability.

import { getLogger } from '../lib/logger.js'
import type { CircuitBreakerConfig, CircuitState } from './types.js'
import { CircuitBreakerOpenError } from './types.js'

const log = getLogger('resilience:circuit-breaker')

/** Default circuit breaker configuration values. */
export const DEFAULT_CB_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenSuccessThreshold: 3,
  successThreshold: 3,
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private successCount = 0
  private halfOpenSuccessCount = 0
  private lastFailureTime = 0

  /** Listener subscriptions keyed by a unique id — returned by onStateChange(). */
  private readonly listeners = new Map<string, (state: CircuitState) => void>()
  private listenerIdCounter = 0

  /**
   * Optional callback to fire on state transitions.
   * Can be wired to CapabilityEventBus.emit() by the pipeline layer.
   */
  onTransition?: (from: CircuitState, to: CircuitState) => void

  constructor(
    private readonly config: CircuitBreakerConfig,
    public readonly name: string,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /** Whether the breaker currently allows execution. */
  canExecute(): boolean {
    // Lazily transition open → half_open when the timeout has elapsed.
    this.maybeTransitionToHalfOpen()
    return this.state !== 'open'
  }

  /** Record a successful execution. */
  recordSuccess(): void {
    this.successCount++

    if (this.state === 'half_open') {
      this.halfOpenSuccessCount++
      if (this.halfOpenSuccessCount >= this.config.halfOpenSuccessThreshold) {
        this.transitionTo('closed')
        this.failureCount = 0
        this.halfOpenSuccessCount = 0
        log.info({ breaker: this.name }, 'circuit breaker closed after half_open recovery')
      }
    } else if (this.state === 'closed') {
      // After enough consecutive successes, reset the failure counter.
      const threshold = this.config.successThreshold ?? DEFAULT_CB_CONFIG.successThreshold
      if (this.successCount >= threshold) {
        this.failureCount = 0
        this.successCount = 0
      }
    }
  }

  /** Record a failed execution. */
  recordFailure(): void {
    this.failureCount++
    this.successCount = 0
    this.halfOpenSuccessCount = 0
    this.lastFailureTime = Date.now()

    if (this.state === 'half_open') {
      // Any failure in half_open immediately re-opens.
      this.transitionTo('open')
      log.warn(
        { breaker: this.name, failures: this.failureCount },
        'circuit breaker re-opened from half_open',
      )
    } else if (this.state === 'closed') {
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('open')
        log.warn(
          {
            breaker: this.name,
            failures: this.failureCount,
            threshold: this.config.failureThreshold,
          },
          'circuit breaker tripped open',
        )
      }
    }
  }

  /** Get the current state (may lazily transition from open → half_open). */
  getState(): CircuitState {
    this.maybeTransitionToHalfOpen()
    return this.state
  }

  /** Snapshot of breaker metrics. */
  getMetrics(): {
    state: CircuitState
    failureCount: number
    successCount: number
    halfOpenSuccessCount: number
    lastFailureTime: number
    timeSinceLastFailure: number
  } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      halfOpenSuccessCount: this.halfOpenSuccessCount,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: this.lastFailureTime > 0 ? Date.now() - this.lastFailureTime : -1,
    }
  }

  /** Manually reset the breaker to closed (e.g. after a manual intervention). */
  reset(): void {
    this.failureCount = 0
    this.successCount = 0
    this.halfOpenSuccessCount = 0
    this.lastFailureTime = 0
    this.transitionTo('closed')
    log.info({ breaker: this.name }, 'circuit breaker manually reset')
  }

  /** Manually trip the breaker open (e.g. for maintenance). */
  trip(): void {
    this.lastFailureTime = Date.now()
    this.transitionTo('open')
    log.info({ breaker: this.name }, 'circuit breaker manually tripped')
  }

  /**
   * Subscribe to state-change events.
   * Returns an unsubscribe function.
   */
  onStateChange(listener: (state: CircuitState) => void): () => void {
    const id = String(++this.listenerIdCounter)
    this.listeners.set(id, listener)
    return () => {
      this.listeners.delete(id)
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private transitionTo(state: CircuitState): void {
    const from = this.state
    if (from === state) return
    this.state = state
    // Notify local listeners
    for (const listener of this.listeners.values()) {
      try {
        listener(state)
      } catch {
        // Swallow listener errors so they don't break the state machine.
      }
    }
    // Notify optional external handler (e.g. CapabilityEventBus)
    try {
      this.onTransition?.(from, state)
    } catch {
      // Swallow
    }
  }

  /** Lazily move from open → half_open when the reset timeout has elapsed. */
  private maybeTransitionToHalfOpen(): void {
    if (this.state !== 'open') return
    const elapsed = Date.now() - this.lastFailureTime
    if (elapsed >= this.config.resetTimeoutMs) {
      this.transitionTo('half_open')
      this.halfOpenSuccessCount = 0
      log.info(
        { breaker: this.name, elapsedMs: elapsed },
        'circuit breaker transitioned to half_open',
      )
    }
  }
}

/**
 * Helper: wrap a call with circuit-breaker protection.
 * Rejects immediately with CircuitBreakerOpenError when the breaker is open.
 */
export async function withCircuitBreaker<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
): Promise<T> {
  if (!breaker.canExecute()) {
    throw new CircuitBreakerOpenError(breaker.name)
  }
  try {
    const result = await fn()
    breaker.recordSuccess()
    return result
  } catch (err) {
    breaker.recordFailure()
    throw err
  }
}
