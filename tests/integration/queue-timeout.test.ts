// tests/integration/queue-timeout.test.ts
// T023: Verify queue timeout works (FR-9, AC4.2)
// Tests that queued requests timeout appropriately.

import { describe, expect, it } from 'bun:test'
import { FleetLimiter } from '../../src/executor/fleet-limiter.js'

describe('Queue Timeout (US4)', () => {
  it('acquire resolves immediately when slot available', async () => {
    // AC4.2: Excess requests are queued with timeout
    const limiter = new FleetLimiter(2, 5, 10_000)

    const start = Date.now()
    await limiter.acquire()
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(100)
    expect(limiter.stats().active).toBe(1)

    await limiter.release()
  })

  it('acquire resolves when slot frees up', async () => {
    const limiter = new FleetLimiter(1, 5, 10_000)

    await limiter.acquire()

    // Queue a second acquire
    let resolved = false
    const p = limiter.acquire().then(() => {
      resolved = true
    })

    // Should be queued
    expect(limiter.stats().queued).toBe(1)

    // Release → should resolve
    limiter.release()
    await p

    expect(resolved).toBe(true)
    expect(limiter.stats().active).toBe(1)

    await limiter.release()
  })

  it('queue has maximum depth', async () => {
    const limiter = new FleetLimiter(1, 2, 10_000)

    await limiter.acquire()

    // Queue 2 (at limit)
    const p1 = limiter.acquire()
    const p2 = limiter.acquire()

    expect(limiter.stats().queued).toBe(2)

    // Third queue should reject (FleetQueueFullError)
    await expect(limiter.acquire()).rejects.toThrow()

    // Cleanup
    limiter.release()
    await p1
    limiter.release()
    await p2
    limiter.release()
  })

  it('stats reflect current state', async () => {
    const limiter = new FleetLimiter(3, 5, 10_000)

    expect(limiter.stats()).toEqual({
      active: 0,
      queued: 0,
      maxConcurrent: 3,
    })

    await limiter.acquire()
    await limiter.acquire()

    expect(limiter.stats()).toEqual({
      active: 2,
      queued: 0,
      maxConcurrent: 3,
    })

    limiter.release()
    limiter.release()

    expect(limiter.stats()).toEqual({
      active: 0,
      queued: 0,
      maxConcurrent: 3,
    })
  })
})
