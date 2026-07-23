import { describe, expect, it } from 'bun:test'
import { probeSlave } from '../../../../src/engines/harness/health-probe-adapter.js'

function makeGovernor(probeResult: boolean, healthState?: string) {
  return {
    probe: async () => probeResult,
    getHealth: async () => (healthState ? { circuitState: healthState } : undefined),
  } as any
}

describe('health-probe-adapter', () => {
  it('returns alive=true and healthScore=1 when probe succeeds', async () => {
    const snapshot = await probeSlave(makeGovernor(true, 'closed'), 's1')
    expect(snapshot.alive).toBe(true)
    expect(snapshot.healthScore).toBe(1)
    expect(snapshot.circuitState).toBe('closed')
    expect(snapshot.slaveId).toBe('s1')
  })

  it('returns alive=false and healthScore=0 when probe fails', async () => {
    const snapshot = await probeSlave(makeGovernor(false, 'open'), 's1')
    expect(snapshot.alive).toBe(false)
    expect(snapshot.healthScore).toBe(0)
    expect(snapshot.circuitState).toBe('open')
  })

  it('defaults circuitState to open when health is undefined', async () => {
    const snapshot = await probeSlave(makeGovernor(true, undefined), 's1')
    expect(snapshot.circuitState).toBe('open')
  })
})
