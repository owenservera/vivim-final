// tests/unit/executor/slave-states.test.ts
import { describe, expect, it } from 'bun:test'
import {
  type SlaveLifecycle,
  backoffDelay,
  computeSuperState,
  nextState,
} from '../../../src/executor/slave-states.js'

describe('computeSuperState (FR-3)', () => {
  it('empty fleet is idle', () => {
    expect(computeSuperState([])).toBe('idle')
  })

  it('all stopped is idle', () => {
    expect(computeSuperState([{ status: 'stopped' }, { status: 'stopped' }])).toBe('idle')
  })

  it('any running/starting is active', () => {
    expect(computeSuperState([{ status: 'stopped' }, { status: 'running' }])).toBe('active')
    expect(computeSuperState([{ status: 'starting' }])).toBe('active')
  })

  it('any degraded (unhealthy/restarting) is degraded', () => {
    expect(computeSuperState([{ status: 'running' }, { status: 'unhealthy' }])).toBe('degraded')
    expect(computeSuperState([{ status: 'restarting' }])).toBe('degraded')
  })

  it('all terminal (error/circuit_open) is terminal', () => {
    expect(computeSuperState([{ status: 'error' }, { status: 'error' }])).toBe('terminal')
    expect(computeSuperState([{ status: 'circuit_open' }])).toBe('terminal')
  })

  it('precedence: terminal over degraded over active', () => {
    const mix: SlaveLifecycle[] = ['error', 'circuit_open', 'unhealthy']
    expect(computeSuperState(mix.map((s) => ({ status: s })))).toBe('terminal')
  })
})

describe('nextState (FR-3 transitions)', () => {
  it('allows legal transitions', () => {
    expect(nextState('stopped', 'starting')).toBe('starting')
    expect(nextState('starting', 'running')).toBe('running')
    expect(nextState('running', 'unhealthy')).toBe('unhealthy')
    expect(nextState('unhealthy', 'restarting')).toBe('restarting')
  })

  it('rejects illegal transitions', () => {
    expect(nextState('stopped', 'running')).toBeNull()
    expect(nextState('error', 'running')).toBeNull()
  })
})

describe('backoffDelay (FR-18 exponential backoff)', () => {
  it('grows exponentially from base', () => {
    expect(backoffDelay(0)).toBe(1000)
    expect(backoffDelay(1)).toBe(2000)
    expect(backoffDelay(2)).toBe(4000)
    expect(backoffDelay(3)).toBe(8000)
  })

  it('is capped at maxMs', () => {
    expect(backoffDelay(10, 1000, 2, 30000)).toBe(30000)
  })

  it('clamps negative attempt to 0', () => {
    expect(backoffDelay(-3)).toBe(1000)
  })
})
