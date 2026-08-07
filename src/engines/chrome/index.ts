// src/engines/chrome/index.ts
// Barrel export for the ChromeGovernor subsystem.
//
// Session 6 (2026-08-07): Created as part of the chrome-governor.ts split.
// All types and helper classes now live in focused modules under src/engines/chrome/.
// The main ChromeGovernor class remains in src/engines/chrome-governor.ts
// for backward compatibility with existing imports.

export * from './types.js'
export { AsyncMutex } from './async-mutex.js'
export {
  type CircuitBreaker,
  createCircuitBreaker,
  circuitRecordSuccess,
  circuitRecordFailure,
  circuitTryAcquire,
} from './circuit-breaker.js'
export { TraceLog } from './trace-log.js'
export { HealthMonitor } from './health-monitor.js'
export { CDPProxy } from './cdp-proxy.js'
