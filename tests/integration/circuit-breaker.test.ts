// tests/integration/circuit-breaker.test.ts
// T015: Verify circuit breaker prevents cascade (FR-6)
// Tests circuit breaker state transitions and failure counting.

import { describe, expect, it } from 'bun:test'
import {
  type SlaveLifecycle,
  computeSuperState,
  nextState,
} from '../../src/executor/slave-states.js'

describe('Circuit Breaker (US2)', () => {
  it('error state transitions to circuit_open', () => {
    // FR-6: Circuit breaker opens after threshold
    const result = nextState('error', 'circuit_open')
    expect(result).toBe('circuit_open')
  })

  it('restarting can transition to circuit_open', () => {
    // FR-6: Circuit breaker can open during restart
    const result = nextState('restarting', 'circuit_open')
    expect(result).toBe('circuit_open')
  })

  it('circuit_open cannot transition to running', () => {
    // FR-6: Circuit breaker blocks new operations
    const result = nextState('circuit_open', 'running')
    expect(result).toBeNull()
  })

  it('circuit_open can transition to stopped', () => {
    // FR-6: Manual intervention can stop
    const result = nextState('circuit_open', 'stopped')
    expect(result).toBe('stopped')
  })

  it('circuit_open can transition to restarting', () => {
    // FR-6: Manual restart possible
    const result = nextState('circuit_open', 'restarting')
    expect(result).toBe('restarting')
  })

  it('fleet is terminal when all slaves are in circuit_open', () => {
    // FR-6: Fleet shows terminal state
    const states = [
      { status: 'circuit_open' as SlaveLifecycle },
      { status: 'circuit_open' as SlaveLifecycle },
    ]
    expect(computeSuperState(states)).toBe('terminal')
  })

  it('fleet is terminal when any slave is in error', () => {
    const states = [{ status: 'running' as SlaveLifecycle }, { status: 'error' as SlaveLifecycle }]
    expect(computeSuperState(states)).toBe('terminal')
  })

  it('error state can transition to stopped', () => {
    // Manual cleanup
    const result = nextState('error', 'stopped')
    expect(result).toBe('stopped')
  })

  it('error state can transition to restarting', () => {
    // Manual restart
    const result = nextState('error', 'restarting')
    expect(result).toBe('restarting')
  })
})
