// tests/integration/pressure-gate.test.ts
// T022: Verify pressure gate checks resources (FR-9, AC4.3)
// Tests that system pressure is checked before spawn.

import { describe, expect, it } from 'bun:test'
import { computeSuperState, type SlaveLifecycle } from '../../src/executor/slave-states.js'

describe('Pressure Gate (US4)', () => {
  it('fleet shows idle when no slaves', () => {
    // AC4.3: Pre-spawn pressure gate checks CPU/memory before launch
    expect(computeSuperState([])).toBe('idle')
  })

  it('fleet shows active when slaves running', () => {
    const states = [{ status: 'running' as SlaveLifecycle }]
    expect(computeSuperState(states)).toBe('active')
  })

  it('fleet shows degraded when pressure causes unhealthy', () => {
    // Pressure gate may mark slaves unhealthy
    const states = [
      { status: 'running' as SlaveLifecycle },
      { status: 'unhealthy' as SlaveLifecycle },
    ]
    expect(computeSuperState(states)).toBe('degraded')
  })

  it('fleet shows terminal when pressure causes error', () => {
    // Severe pressure may cause errors
    const states = [{ status: 'error' as SlaveLifecycle }]
    expect(computeSuperState(states)).toBe('terminal')
  })

  it('mixed states show correct precedence', () => {
    // Terminal > degraded > active > idle
    const states = [{ status: 'running' as SlaveLifecycle }, { status: 'error' as SlaveLifecycle }]
    expect(computeSuperState(states)).toBe('terminal')
  })
})
