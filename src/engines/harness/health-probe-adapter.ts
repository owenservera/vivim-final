// src/engines/harness/health-probe-adapter.ts
// Unit 24.3 - Health probe adapter.
// Reuses the governor's existing probe/health methods (ChromeGovernor.probe,
// probeHealth, getHealth) — no new health mechanism. Exposes a capability-level
// health snapshot the status ladder / confidence promotion can read.

import type { ChromeGovernor, CircuitState } from '../chrome-governor.js'

export interface SlaveHealthSnapshot {
  slaveId: string
  alive: boolean
  circuitState: CircuitState
  healthScore: number
}

export async function probeSlave(
  governor: ChromeGovernor,
  slaveId: string,
): Promise<SlaveHealthSnapshot> {
  const alive = await governor.probe(slaveId)
  const health = await governor.getHealth(slaveId)
  return {
    slaveId,
    alive,
    circuitState: health?.circuitState ?? 'open',
    healthScore: alive ? 1 : 0,
  }
}
