// src/executor/slave-states.ts
// Canonical Chrome Slave lifecycle state machine + fleet super-state.
//
// Single source of truth for slave status (FR-3). Replaces the three divergent
// SlaveStatus/SuperState definitions that previously lived in
// schema/chrome.ts, engines/chrome-governor.ts, and executor/fleet-supervisor.ts.

// ── Lifecycle (per-slave) ────────────────────────────────────────────────────
//
//   stopped ──▶ starting ──▶ running ──▶ unhealthy
//      ▲          │             │  │          │
//      │          │             │  └──────────┤ (transient failure, not yet terminal)
//      │          │             ▼             ▼
//      │          │          restarting ──▶ error
//      │          │             │            │
//      │          │             ▼            ▼
//      │          └───────── circuit_open ──▶ terminal(error)
//      └─────────────────────────────────────────── (explicit stop / shutdown)
//
export type SlaveLifecycle =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'unhealthy'
  | 'restarting'
  | 'error'
  | 'circuit_open'

// ── Aggregate super-state (whole fleet) ──────────────────────────────────────
export type FleetSuperState = 'idle' | 'active' | 'degraded' | 'terminal'

const TERMINAL_INDIVIDUAL: ReadonlySet<SlaveLifecycle> = new Set(['error', 'circuit_open'])
const DEGRADED_INDIVIDUAL: ReadonlySet<SlaveLifecycle> = new Set([
  'unhealthy',
  'restarting',
  'circuit_open',
])
const LIVE_INDIVIDUAL: ReadonlySet<SlaveLifecycle> = new Set(['running', 'starting'])

/**
 * Reduce a set of per-slave lifecycle states into the fleet super-state (FR-3).
 *  - all stopped            → idle
 *  - any running/starting   → active
 *  - any degraded           → degraded
 *  - all terminal           → terminal
 * Precedence: terminal > degraded > active > idle (a single active slave in a
 * fleet of broken slaves still shows degraded, never idle).
 */
export function computeSuperState(
  instances: ReadonlyArray<{ status: SlaveLifecycle }>,
): FleetSuperState {
  if (instances.length === 0) return 'idle'

  let anyLive = false
  let anyDegraded = false

  for (const inst of instances) {
    if (TERMINAL_INDIVIDUAL.has(inst.status)) return 'terminal'
    if (LIVE_INDIVIDUAL.has(inst.status)) anyLive = true
    if (DEGRADED_INDIVIDUAL.has(inst.status)) anyDegraded = true
  }

  if (anyDegraded) return 'degraded'
  if (anyLive) return 'active'
  return 'idle'
}

/** Valid forward transitions — used by {@link nextState} to guard illegal moves. */
const TRANSITIONS: Readonly<Record<SlaveLifecycle, ReadonlyArray<SlaveLifecycle>>> = {
  stopped: ['starting'],
  starting: ['running', 'error'],
  running: ['unhealthy', 'restarting', 'stopped', 'error'],
  unhealthy: ['restarting', 'running', 'error', 'stopped'],
  restarting: ['running', 'unhealthy', 'error', 'circuit_open'],
  error: ['stopped', 'restarting', 'circuit_open'],
  circuit_open: ['stopped', 'restarting', 'half_open' as SlaveLifecycle].filter(
    (s): s is SlaveLifecycle => s !== ('half_open' as SlaveLifecycle),
  ),
}

/** Returns the next lifecycle state if `to` is a legal transition from `from`. */
export function nextState(from: SlaveLifecycle, to: SlaveLifecycle): SlaveLifecycle | null {
  return TRANSITIONS[from]?.includes(to) ? to : null
}

/**
 * Exponential backoff schedule (FR-18): base * factor^attempt, capped.
 * attempt is 0-based. Returns milliseconds.
 */
export function backoffDelay(attempt: number, baseMs = 1_000, factor = 2, maxMs = 30_000): number {
  const n = attempt < 0 ? 0 : attempt
  const raw = baseMs * factor ** n
  return Math.min(Math.round(raw), maxMs)
}
