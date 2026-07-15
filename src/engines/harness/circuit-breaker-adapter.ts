// src/engines/harness/circuit-breaker-adapter.ts
// Unit 23.4 - Circuit breaker adapter.
// Reuses the governor's existing CircuitState (per-slave 'closed'|'half_open'|
// 'open') rather than inventing a second breaker. The governor already blocks
// CDP send/executeHarnessPlan when a slave's circuit is 'open'; this adapter
// exposes a capability-level gate the executor consults BEFORE attempting a run.

import type { ChromeGovernor, CircuitState } from '../chrome-governor.js'

export interface CircuitGate {
  state: CircuitState
  isOpen: boolean
}

export async function readCircuitGate(
  governor: ChromeGovernor,
  slaveId: string,
): Promise<CircuitGate> {
  const health = await governor.getHealth(slaveId)
  const state: CircuitState = health?.circuitState ?? 'open'
  return { state, isOpen: state === 'open' }
}

/** True if execution may proceed (circuit not open). Mirrors cap-store gate. */
export async function canExecute(governor: ChromeGovernor, slaveId: string): Promise<boolean> {
  const gate = await readCircuitGate(governor, slaveId)
  return !gate.isOpen
}
