import { describe, expect, it } from 'bun:test'
import { readCircuitGate, canExecute } from '../../../../src/engines/harness/circuit-breaker-adapter.js'

function makeGovernor(circuitState: string | undefined) {
  return {
    getHealth: async () => (circuitState ? { circuitState } : undefined),
  } as any
}

describe('circuit-breaker-adapter', () => {
  describe('readCircuitGate', () => {
    it('returns open when circuitState is open', async () => {
      const gate = await readCircuitGate(makeGovernor('open'), 's1')
      expect(gate.state).toBe('open')
      expect(gate.isOpen).toBe(true)
    })

    it('returns closed when circuitState is closed', async () => {
      const gate = await readCircuitGate(makeGovernor('closed'), 's1')
      expect(gate.state).toBe('closed')
      expect(gate.isOpen).toBe(false)
    })

    it('returns half_open as not open', async () => {
      const gate = await readCircuitGate(makeGovernor('half_open'), 's1')
      expect(gate.state).toBe('half_open')
      expect(gate.isOpen).toBe(false)
    })

    it('defaults to open when health is undefined', async () => {
      const gate = await readCircuitGate(makeGovernor(undefined), 's1')
      expect(gate.state).toBe('open')
      expect(gate.isOpen).toBe(true)
    })
  })

  describe('canExecute', () => {
    it('returns false when circuit is open', async () => {
      expect(await canExecute(makeGovernor('open'), 's1')).toBe(false)
    })

    it('returns true when circuit is closed', async () => {
      expect(await canExecute(makeGovernor('closed'), 's1')).toBe(true)
    })

    it('returns true when circuit is half_open', async () => {
      expect(await canExecute(makeGovernor('half_open'), 's1')).toBe(true)
    })
  })
})
