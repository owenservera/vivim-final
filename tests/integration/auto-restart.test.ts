// tests/integration/auto-restart.test.ts
// T014: Verify auto-restart on transient failures (FR-5)
// Tests restart logic and exponential backoff.

import { describe, expect, it } from 'bun:test'
import {
  backoffDelay,
  computeSuperState,
  nextState,
  type SlaveLifecycle,
} from '../../src/executor/slave-states.js'

describe('Auto-Restart (US2)', () => {
  it('unhealthy slave can restart', () => {
    // FR-5: Auto-restart on transient failures
    const result = nextState('unhealthy', 'restarting')
    expect(result).toBe('restarting')
  })

  it('restarting slave transitions to running on success', () => {
    const result = nextState('restarting', 'running')
    expect(result).toBe('running')
  })

  it('restarting slave can fail back to unhealthy', () => {
    const result = nextState('restarting', 'unhealthy')
    expect(result).toBe('unhealthy')
  })

  it('restarting slave can fail to error', () => {
    const result = nextState('restarting', 'error')
    expect(result).toBe('error')
  })

  it('exponential backoff increases delay with attempt count', () => {
    // FR-18: Exponential backoff for restarts
    const d0 = backoffDelay(0)
    const d1 = backoffDelay(1)
    const d2 = backoffDelay(2)
    const d3 = backoffDelay(3)

    expect(d1).toBeGreaterThan(d0)
    expect(d2).toBeGreaterThan(d1)
    expect(d3).toBeGreaterThan(d2)
  })

  it('backoff is capped at maxMs', () => {
    // FR-18: Backoff cap
    const d10 = backoffDelay(10)
    const d20 = backoffDelay(20)

    expect(d10).toBe(30000) // maxMs default
    expect(d20).toBe(30000) // still capped
  })

  it('backoff with custom parameters', () => {
    // Custom base, factor, max
    const d0 = backoffDelay(0, 500, 3, 5000)
    const d1 = backoffDelay(1, 500, 3, 5000)
    const d2 = backoffDelay(2, 500, 3, 5000)

    expect(d0).toBe(500) // 500 * 3^0 = 500
    expect(d1).toBe(1500) // 500 * 3^1 = 1500
    expect(d2).toBe(4500) // 500 * 3^2 = 4500
  })

  it('negative attempt clamps to 0', () => {
    const d = backoffDelay(-1)
    expect(d).toBe(1000) // same as attempt 0
  })

  it('fleet remains degraded during restart', () => {
    const states = [
      { status: 'running' as SlaveLifecycle },
      { status: 'restarting' as SlaveLifecycle },
    ]
    expect(computeSuperState(states)).toBe('degraded')
  })
})
