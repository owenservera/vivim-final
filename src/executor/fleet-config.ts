// src/executor/fleet-config.ts
// Fleet configuration for ChromeGovernor.

export interface FleetConfig {
  chromePath?: string | null
  portRange: { start: number; end: number }
  healthProbeIntervalMs: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
}
