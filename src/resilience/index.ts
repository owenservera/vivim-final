// src/resilience/index.ts
// WP-06 — Unified resilience middleware barrel export.
// Import everything from a single entry-point:
//
//   import { createPipeline, HealthAggregator, CircuitBreaker } from '@/resilience'

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  CircuitState,
  CircuitBreakerConfig,
  RetryConfig,
  BulkheadConfig,
  TimeoutConfig,
  HealthStatus,
  HealthResult,
  ResiliencePolicy,
  ExecutionResult,
} from './types.js'

export {
  CircuitBreakerOpenError,
  BulkheadRejectedError,
  ResilienceTimeoutError,
  RetryExhaustedError,
} from './types.js'

// ── Circuit Breaker ─────────────────────────────────────────────────────────
export { CircuitBreaker, withCircuitBreaker, DEFAULT_CB_CONFIG } from './circuit-breaker.js'

// ── Retry Policy ────────────────────────────────────────────────────────────
export { RetryPolicy } from './retry-policy.js'

// ── Bulkhead ──────────────────────────────────────────────────────────────────
export { Bulkhead } from './bulkhead.js'

// ── Resilience Pipeline ─────────────────────────────────────────────────────
export { ResiliencePipeline } from './resilience-pipeline.js'

// ── Health Aggregator ────────────────────────────────────────────────────────
export { HealthAggregator, worstHealthStatus, registerPipelineHealth } from './health-aggregator.js'

// ── Presets & Factories ────────────────────────────────────────────────────────
export { PRESETS, createPolicy, createPipeline } from './presets.js'
