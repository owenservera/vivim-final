// src/resilience/types.ts
// Unified resilience infrastructure types.
// WP-06 — provides a shared type vocabulary for circuit breakers, retry policies,
// bulkheads, timeout guards, health checks, and combined resilience pipelines.

// ── Circuit Breaker ───────────────────────────────────────────────────────────

/** Circuit breaker states. */
export type CircuitState = 'closed' | 'open' | 'half_open'

/** Circuit breaker configuration. */
export interface CircuitBreakerConfig {
  /** Failure threshold to trip the breaker (default: 5). */
  failureThreshold: number
  /** Reset timeout in ms — how long the breaker stays open before transitioning to half_open (default: 30 000). */
  resetTimeoutMs: number
  /** Number of consecutive successes required in half_open to close the breaker (default: 3). */
  halfOpenSuccessThreshold: number
  /** Consecutive successes required in closed state to reset the failure counter (default: 3). */
  successThreshold?: number
}

// ── Retry ────────────────────────────────────────────────────────────────────

/** Retry configuration. */
export interface RetryConfig {
  /** Maximum number of attempts (including the first call). */
  maxAttempts: number
  /** Initial backoff delay in ms. */
  initialBackoffMs: number
  /** Maximum backoff delay in ms. */
  maxBackoffMs: number
  /** Exponential multiplier applied each attempt. */
  multiplier: number
  /** Whether to add random jitter to prevent thundering-herd. */
  jitter: boolean
  /** Optional predicate — only retry when this returns true. */
  retryableIf?: (error: unknown) => boolean
}

// ── Bulkhead ──────────────────────────────────────────────────────────────────

/** Bulkhead configuration — isolates resources so failures in one partition don't cascade. */
export interface BulkheadConfig {
  /** Maximum concurrent operations (default: 10). */
  maxConcurrent: number
  /** Maximum queue depth for pending operations (default: 100). */
  maxQueueSize: number
  /** Queue timeout in ms — reject if a slot isn't acquired within this time (default: 5000). */
  queueTimeoutMs: number
}

// ── Timeout ───────────────────────────────────────────────────────────────────

/** Timeout configuration. */
export interface TimeoutConfig {
  /** Timeout in ms. */
  timeoutMs: number
  /** Whether to cancel the underlying operation on timeout (default: true). */
  cancelOnTimeout?: boolean
}

// ── Health ───────────────────────────────────────────────────────────────────

/** Health status levels. */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

/** Result of a single health check or an aggregated set. */
export interface HealthResult {
  /** Overall health status. */
  status: HealthStatus
  /** Component / subsystem name. */
  component: string
  /** Epoch-ms timestamp of the check. */
  checkedAt: number
  /** Wall-clock duration of the check in ms. */
  durationMs: number
  /** Free-form detail string (error message, score, etc.). */
  details?: string
  /** Child results when this is an aggregate. */
  children?: HealthResult[]
}

// ── Resilience Policy & Execution ─────────────────────────────────────────────

/** A named resilience policy combining one or more resilience patterns. */
export interface ResiliencePolicy {
  /** Human-readable name (e.g. 'providerApi', 'database'). */
  name: string
  circuitBreaker?: CircuitBreakerConfig
  retry?: RetryConfig
  bulkhead?: BulkheadConfig
  timeout?: TimeoutConfig
}

/** Result returned by the ResiliencePipeline after an execution attempt. */
export interface ExecutionResult<T> {
  /** Whether the operation succeeded. */
  success: boolean
  /** The return value on success. */
  value?: T
  /** The error on failure. */
  error?: Error
  /** Total attempts made (≥ 1). */
  attempts: number
  /** Total wall-clock time in ms (includes retries + queue wait). */
  durationMs: number
  /** Whether the circuit breaker rejected the call. */
  circuitBreakerTripped: boolean
  /** Whether the result was served from cache (reserved for future use). */
  fromCache: boolean
}

// ── Errors ───────────────────────────────────────────────────────────────────

/** Thrown when the circuit breaker is open and the call is rejected immediately. */
export class CircuitBreakerOpenError extends Error {
  public readonly breakerName: string

  constructor(breakerName: string) {
    super(`Circuit breaker "${breakerName}" is open`)
    this.name = 'CircuitBreakerOpenError'
    this.breakerName = breakerName
  }
}

/** Thrown when the bulkhead queue is full and the operation is rejected. */
export class BulkheadRejectedError extends Error {
  public readonly bulkheadName: string

  constructor(bulkheadName: string) {
    super(`Bulkhead "${bulkheadName}" rejected — queue full`)
    this.name = 'BulkheadRejectedError'
    this.bulkheadName = bulkheadName
  }
}

/** Thrown when a timeout is exceeded. */
export class ResilienceTimeoutError extends Error {
  public readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`)
    this.name = 'ResilienceTimeoutError'
    this.timeoutMs = timeoutMs
  }
}

/** Thrown when all retry attempts are exhausted. */
export class RetryExhaustedError extends Error {
  public readonly attempts: number
  public readonly lastError?: Error

  constructor(attempts: number, lastError?: Error) {
    super(`Retry exhausted after ${attempts} attempt(s)`)
    this.name = 'RetryExhaustedError'
    this.attempts = attempts
    this.lastError = lastError
  }
}
