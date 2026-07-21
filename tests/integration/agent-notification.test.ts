// tests/integration/agent-notification.test.ts
// T016: Verify agent notified of persistent failures (FR-6, AC2.4)
// Tests that terminal states are detectable by the agent.

import { describe, expect, it } from 'bun:test'
import {
  type SlaveLifecycle,
  computeSuperState,
  nextState,
} from '../../src/executor/slave-states.js'

describe('Agent Notification (US2)', () => {
  it('terminal state is detectable via super-state', () => {
    // AC2.4: Agent is notified of persistent failures
    const states = [{ status: 'error' as SlaveLifecycle }]
    expect(computeSuperState(states)).toBe('terminal')
  })

  it('terminal state includes circuit_open', () => {
    const states = [{ status: 'circuit_open' as SlaveLifecycle }]
    expect(computeSuperState(states)).toBe('terminal')
  })

  it('degraded state is detectable via super-state', () => {
    // Agent can detect unhealthy slaves
    const states = [{ status: 'unhealthy' as SlaveLifecycle }]
    expect(computeSuperState(states)).toBe('degraded')
  })

  it('restarting state is degraded', () => {
    // Agent can detect restart attempts
    const states = [{ status: 'restarting' as SlaveLifecycle }]
    expect(computeSuperState(states)).toBe('degraded')
  })

  it('mixed states show correct precedence', () => {
    // Terminal takes precedence over degraded
    const states = [
      { status: 'error' as SlaveLifecycle },
      { status: 'unhealthy' as SlaveLifecycle },
    ]
    expect(computeSuperState(states)).toBe('terminal')
  })

  it('degraded takes precedence over active', () => {
    const states = [
      { status: 'running' as SlaveLifecycle },
      { status: 'unhealthy' as SlaveLifecycle },
    ]
    expect(computeSuperState(states)).toBe('degraded')
  })

  it('agent can transition from terminal to stopped', () => {
    // Manual intervention: stop the failed slave
    const result = nextState('error', 'stopped')
    expect(result).toBe('stopped')
  })

  it('agent can transition from circuit_open to stopped', () => {
    // Manual intervention: stop the circuit-broken slave
    const result = nextState('circuit_open', 'stopped')
    expect(result).toBe('stopped')
  })
})
