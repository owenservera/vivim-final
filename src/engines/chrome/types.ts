// src/engines/chrome/types.ts
// Type definitions for the ChromeGovernor subsystem.
//
// Session 6 (2026-08-07): Extracted from chrome-governor.ts (was 1521 LOC).
// These types are shared across ChromeGovernor, CDPProxy, HealthMonitor,
// TraceLog, CircuitBreaker, and AsyncMutex.

import type { SlaveLifecycle } from '../../executor/slave-states.js'

// ── Canonical types ──────────────────────────────────────────────────────────

/** Canonical slave lifecycle (atomic-v13 / FR-3). Single source of truth. */
export type SlaveStatus = SlaveLifecycle

/** Fleet super-state (FR-3): idle | active | degraded | terminal. */
export type SuperState = 'idle' | 'sending' | 'capturing' | 'parsing' | 'authenticating' | 'error'

/** Circuit breaker state machine. */
export type CircuitState = 'closed' | 'half_open' | 'open'

// ── Config ───────────────────────────────────────────────────────────────────

export interface FleetConfig {
  chromePath?: string
  profileBaseDir?: string
  portRange: [number, number]
  healthProbeIntervalMs: number
  healthProbeTimeoutMs: number
  autoRestart: boolean
  maxRestarts: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
  // ── admission control (SOTA: browserless Limiter) ──
  maxConcurrent?: number
  maxQueued?: number
  queueTimeoutMs?: number
  // ── pre-spawn pressure gate (SOTA: browserless priority cascade) ──
  cpuOverloadPct?: number
  memOverloadPct?: number
  // ── launch-time crash recovery (SOTA: puppeteer-cluster) ──
  spawnRetryLimit?: number
  spawnRetryDelayMs?: number
}

export interface LaunchOptions {
  visible?: boolean
  profileDir?: string
  debugPort?: number
  extraArgs?: string[]
}

// ── Slave ────────────────────────────────────────────────────────────────────

export interface ChromeSlave {
  slaveId: string
  providerId: string
  accountId: string
  debugPort: number
  profileDir: string
  status: SlaveStatus
  superState: SuperState
  pid: number | null
  consecutiveFailures: number
  circuitState: CircuitState
  lastHealthCheck: number
  channel?: 'system' | 'chrome' | 'chromium' | 'edge'
  mode?: 'headless-new' | 'headless' | 'headed'
  firstRun?: boolean
}

export interface SlaveHealth {
  slaveId: string
  status: SlaveStatus
  circuitState: CircuitState
  consecutiveFailures: number
  lastHealthCheck: number
  uptimeMs: number
}

// ── Capture + harness ────────────────────────────────────────────────────────

export interface CaptureResult {
  body: string
  url?: string
  headers?: Record<string, string>
  status?: number
  durationMs?: number
  capturedAt?: number
}

export interface PageState {
  url: string
  title: string
  readyState: string
}

export interface HarnessResult {
  success: boolean
  stepsCompleted: number
  error?: string
  capturedBody?: string
}

export interface HarnessDAG {
  nodes: HarnessNode[]
  edges: HarnessEdge[]
}

export interface HarnessNode {
  type: 'action' | 'sequence' | 'branch' | 'parallel' | 'retry' | 'precondition' | 'step'
  action?: string
  selector?: string
  params?: Record<string, unknown>
  moduleId?: string
  input?: Record<string, unknown>
  outputKey?: string
  condition?: { outputKey: string; equals?: string; truthy?: boolean }
}

export interface HarnessEdge {
  from: number
  to: number
}

// ── Event bus ────────────────────────────────────────────────────────────────

export interface GovernorEventBus {
  emit(event: string, data: unknown): void
}

// ── CDP Transport contract ───────────────────────────────────────────────────

export interface CDPTransport {
  connect?(slaveId: string, debugPort: number): Promise<void>
  isConnected?(slaveId: string): boolean
  send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>
  capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult>
  captureStream?(
    slaveId: string,
    pattern: RegExp,
    timeoutMs?: number,
  ): Promise<{ body: string; chunks: string[] }>
  getPageState(slaveId: string): Promise<PageState>
  captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string>
}
