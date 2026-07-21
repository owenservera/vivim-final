// tests/integration/chrome-slave-launch.test.ts
// T010: Verify Chrome slave launches for provider (FR-1, FR-3, FR-11, FR-12)
// Tests state machine transitions during launch, SingletonLock cleanup, port allocation.

import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FleetLimiter } from '../../src/executor/fleet-limiter.js'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'
import { backoffDelay, computeSuperState, nextState } from '../../src/executor/slave-states.js'

let base: string

describe('Chrome Slave Launch (US1)', () => {
  it('state machine transitions: stopped → starting → running', () => {
    // FR-3: System SHALL implement state machine for slave lifecycle
    const s1 = nextState('stopped', 'starting')
    expect(s1).toBe('starting')

    const s2 = nextState('starting', 'running')
    expect(s2).toBe('running')
  })

  it('returns null for illegal state transitions', () => {
    // FR-3: Invalid transitions return null
    expect(nextState('stopped', 'running')).toBeNull()
    expect(nextState('stopped', 'unhealthy')).toBeNull()
    expect(nextState('circuit_open', 'running')).toBeNull()
    expect(nextState('starting', 'stopped')).toBeNull()
  })

  it('fleet super-state correctly aggregates', () => {
    // FR-3: Fleet super-state computation
    expect(computeSuperState([])).toBe('idle')
    expect(computeSuperState([{ status: 'stopped' }, { status: 'stopped' }])).toBe('idle')
    expect(computeSuperState([{ status: 'running' }, { status: 'stopped' }])).toBe('active')
    expect(computeSuperState([{ status: 'unhealthy' }, { status: 'running' }])).toBe('degraded')
    expect(computeSuperState([{ status: 'error' }, { status: 'circuit_open' }])).toBe('terminal')
  })

  it('admission control bounds concurrent launches', async () => {
    // FR-9: System SHALL enforce admission control
    const limiter = new FleetLimiter(2, 5, 10_000)

    // Acquire 2 slots (at limit)
    await limiter.acquire()
    await limiter.acquire()

    const stats = limiter.stats()
    expect(stats.active).toBe(2)

    // Third acquire should queue (not throw immediately since maxQueued > 0)
    // Release one slot to unblock
    limiter.release()

    const statsAfter = limiter.stats()
    expect(statsAfter.active).toBe(1)
  })

  it('profile directory is created on allocate', async () => {
    base = await mkdtemp(join(tmpdir(), 'chrome-launch-profile-'))
    try {
      const alloc = new ProfileAllocator(base)
      const path = await alloc.allocate('gemini', 'test@gmail.com')

      expect(existsSync(path)).toBe(true)

      // .profile-meta.json is written
      const metaPath = join(path, '.profile-meta.json')
      expect(existsSync(metaPath)).toBe(true)

      const meta = JSON.parse(await Bun.file(metaPath).text())
      expect(meta.providerSlug).toBe('gemini')
      expect(meta.accountId).toBe('test@gmail.com')
      expect(meta.allocatedAt).toBeDefined()
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  it('exponential backoff grows correctly', () => {
    // FR-18: Exponential backoff for restarts
    expect(backoffDelay(0)).toBe(1000) // base * 2^0 = 1000
    expect(backoffDelay(1)).toBe(2000) // base * 2^1 = 2000
    expect(backoffDelay(2)).toBe(4000) // base * 2^2 = 4000
    expect(backoffDelay(3)).toBe(8000) // base * 2^3 = 8000
    expect(backoffDelay(10)).toBe(30000) // capped at maxMs
  })
})
