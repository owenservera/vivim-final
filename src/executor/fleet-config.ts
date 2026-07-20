// src/executor/fleet-config.ts
// Fleet configuration for ChromeGovernor.

export interface FleetConfig {
  chromePath?: string | null
  portRange: { start: number; end: number }
  healthProbeIntervalMs: number
  healthProbeTimeoutMs?: number
  autoRestart?: boolean
  maxRestarts?: number
  profileBaseDir?: string
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
  // ── admission control (SOTA: browserless Limiter) ──
  maxConcurrent?: number // active slave cap; default = port range span
  maxQueued?: number // queue depth; default = maxConcurrent * 2
  queueTimeoutMs?: number // reject if no slot within window; default 30000
  // ── pre-spawn pressure gate (SOTA: browserless priority cascade) ──
  cpuOverloadPct?: number // reject/defer above this; default 100 (disabled)
  memOverloadPct?: number // default 100 (disabled)
  // ── launch-time crash recovery (SOTA: puppeteer-cluster) ──
  spawnRetryLimit?: number // launch retries; default 0 (preserve single-attempt)
  spawnRetryDelayMs?: number // exp-backoff base; default 1000
}
