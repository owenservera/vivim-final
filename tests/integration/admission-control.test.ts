// tests/integration/admission-control.test.ts
// T020: Verify admission control works (FR-9)
// Tests bounded concurrency, queue, and timeout behavior.

import { describe, expect, it } from 'bun:test'
import { FleetLimiter } from '../../src/executor/fleet-limiter.js'

describe('Admission Control (US4)', () => {
  it('acquires slot when under limit', async () => {
    // FR-9: System SHALL enforce admission control
    const limiter = new FleetLimiter(2, 5, 10_000)

    await limiter.acquire()
    const stats = limiter.stats()
    expect(stats.active).toBe(1)

    await limiter.release()
  })

  it('rejects when at limit', async () => {
    const limiter = new FleetLimiter(1, 0, 10_000)

    await limiter.acquire()
    const stats = limiter.stats()
    expect(stats.active).toBe(1)

    // At limit with no queue → should reject
    await expect(limiter.acquire()).rejects.toThrow()

    await limiter.release()
  })

  it('queues when under queue limit', async () => {
    const limiter = new FleetLimiter(1, 5, 10_000)

    await limiter.acquire()

    // Queue a second acquire
    let resolved = false
    const p = limiter.acquire().then(() => {
      resolved = true
    })

    // Should be queued
    const stats = limiter.stats()
    expect(stats.queued).toBe(1)

    // Release first slot → second should resolve
    limiter.release()
    await p

    expect(resolved).toBe(true)
    expect(limiter.stats().active).toBe(1)

    await limiter.release()
  })

  it('release hands slot to next waiter', async () => {
    const limiter = new FleetLimiter(1, 5, 10_000)

    await limiter.acquire()

    // Queue multiple waiters
    const p1 = limiter.acquire()
    const p2 = limiter.acquire()

    expect(limiter.stats().queued).toBe(2)

    // Release → p1 gets slot
    limiter.release()
    await p1
    expect(limiter.stats().active).toBe(1)
    expect(limiter.stats().queued).toBe(1)

    // Release → p2 gets slot
    limiter.release()
    await p2
    expect(limiter.stats().active).toBe(1)
    expect(limiter.stats().queued).toBe(0)

    await limiter.release()
  })

  it('stats returns correct counts', async () => {
    const limiter = new FleetLimiter(3, 5, 10_000)

    const initial = limiter.stats()
    expect(initial.active).toBe(0)
    expect(initial.queued).toBe(0)
    expect(initial.maxConcurrent).toBe(3)

    await limiter.acquire()
    await limiter.acquire()

    const after = limiter.stats()
    expect(after.active).toBe(2)
    expect(after.queued).toBe(0)

    limiter.release()
    limiter.release()
  })
})
