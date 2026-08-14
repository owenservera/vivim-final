// src/resilience/index.ts
// WP-06 — Unified resilience middleware barrel export.
// Import everything from a single entry-point:
//
//   import { createPipeline, HealthAggregator, CircuitBreaker } from '@/resilience'

export type {
  AccountBreakerConfig,
  BreakerState as AccountBreakerState,
} from './account-circuit-breaker.js'
// ── Account Circuit Breaker (harvested from edge-pwa) ──────────────────────────
export {
  AccountCircuitBreaker,
  CircuitOpenError as AccountCircuitOpenError,
} from './account-circuit-breaker.js'
// ── Bulkhead ──────────────────────────────────────────────────────────────────
export { Bulkhead } from './bulkhead.js'
// ── Circuit Breaker ─────────────────────────────────────────────────────────
export { CircuitBreaker, DEFAULT_CB_CONFIG, withCircuitBreaker } from './circuit-breaker.js'
// ── Health Aggregator ────────────────────────────────────────────────────────
export { HealthAggregator, registerPipelineHealth, worstHealthStatus } from './health-aggregator.js'
export type {
  HealthCheckResult,
  HealthCheckTarget,
  HealthEvent,
  ProbeClassification,
} from './health-monitor.js'
// ── Health Monitor (harvested from edge-pwa) ───────────────────────────────────
export { createHealthMonitor } from './health-monitor.js'

// ── Presets & Factories ────────────────────────────────────────────────────────
export { createPipeline, createPolicy, PRESETS } from './presets.js'
// ── Resilience Pipeline ─────────────────────────────────────────────────────
export { ResiliencePipeline } from './resilience-pipeline.js'
// ── Retry Policy ────────────────────────────────────────────────────────────
export { RetryPolicy } from './retry-policy.js'
// ── Types ────────────────────────────────────────────────────────────────────
export type {
  BulkheadConfig,
  CircuitBreakerConfig,
  CircuitState,
  ExecutionResult,
  HealthResult,
  HealthStatus,
  ResiliencePolicy,
  RetryConfig,
  TimeoutConfig,
} from './types.js'
export {
  BulkheadRejectedError,
  CircuitBreakerOpenError,
  ResilienceTimeoutError,
  RetryExhaustedError,
} from './types.js'
