// src/engines/chrome/circuit-breaker.ts
// Circuit breaker state machine for Chrome slave health management.
//
// Session 6 (2026-08-07): Extracted from chrome-governor.ts.

import type { CircuitState } from './types.js'

/**
 * Circuit breaker state for a single Chrome slave.
 * Tracks failure count, last failure/success times, and current state.
 */
export interface CircuitBreaker {
  state: CircuitState
  failureCount: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  openedAt: number | null
}

/** Create a fresh circuit breaker in the 'closed' state. */
export function createCircuitBreaker(): CircuitBreaker {
  return {
    state: 'closed',
    failureCount: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    openedAt: null,
  }
}

/** Record a successful operation — resets the breaker to 'closed'. */
export function circuitRecordSuccess(cb: CircuitBreaker, threshold: number, resetMs: number): void {
  const now = Date.now()
  cb.lastSuccessAt = now
  cb.failureCount = 0
  if (cb.state === 'half_open') {
    cb.state = 'closed'
    cb.openedAt = null
  }
  void threshold
  void resetMs
}

/** Record a failed operation — may trip the breaker to 'open'. */
export function circuitRecordFailure(
  cb: CircuitBreaker,
  threshold: number,
  _resetMs: number,
): CircuitState {
  const now = Date.now()
  cb.failureCount++
  cb.lastFailureAt = now

  if (cb.state === 'half_open') {
    cb.state = 'open'
    cb.openedAt = now
    return 'open'
  }

  if (cb.failureCount >= threshold) {
    cb.state = 'open'
    cb.openedAt = now
    return 'open'
  }

  return cb.state
}

/** Try to acquire a slot through the breaker. Returns true if allowed. */
export function circuitTryAcquire(cb: CircuitBreaker, resetMs: number): boolean {
  if (cb.state === 'closed') return true
  if (cb.state === 'half_open') return true
  // open → check if reset window has elapsed
  if (cb.openedAt && Date.now() - cb.openedAt >= resetMs) {
    cb.state = 'half_open'
    return true
  }
  return false
}
