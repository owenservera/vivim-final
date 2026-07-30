// tests/load/fleet-concurrency.test.ts
// Load test: Spawn many concurrent Chrome instances and verify scheduling.
// Phase 11: Production hardening via load testing.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { BrowserPool } from '../../src/engines/pool/browser-pool.js'
import type { AcquireResult } from '../../src/engines/pool/browser-pool.js'
import { ResourceManager } from '../../src/engines/resource/resource-manager.js'

describe('Load: Fleet Concurrency', () => {
  let pool: BrowserPool
  let resourceManager: ResourceManager
  let slaveCounter = 0

  beforeEach(() => {
    resourceManager = new ResourceManager()
    resourceManager.start()
    slaveCounter = 0
    pool = new BrowserPool(
      async (_providerId, _accountId) => {
        slaveCounter++
        return {
          slaveId: `mock-slave-${slaveCounter}`,
          debugPort: 9000 + slaveCounter,
          profileDir: `/tmp/profile-${slaveCounter}`,
        }
      },
      { minWarm: 0, maxWarm: 5, maxIdleMs: 60_000, maxLeasesPerSlave: 1 },
    )
    pool.start()
  })

  afterEach(async () => {
    await pool.stop()
    resourceManager.stop()
  })

  it('should handle 10 concurrent acquire requests', async () => {
    const acquirePromises: Promise<AcquireResult>[] = []

    for (let i = 0; i < 10; i++) {
      acquirePromises.push(pool.acquire('chatgpt', `account-${i}`))
    }

    const results = await Promise.allSettled(acquirePromises)
    const successful = results.filter((r) => r.status === 'fulfilled')

    // All should succeed (pool spawns on demand)
    expect(successful.length).toBe(10)
  })

  it('should track resource manager concurrency', async () => {
    const maxConcurrent = resourceManager.getMaxConcurrent()
    expect(maxConcurrent).toBeGreaterThan(0)

    // Acquire several slaves
    const acquires: Promise<AcquireResult>[] = []
    for (let i = 0; i < 5; i++) {
      acquires.push(pool.acquire('chatgpt', `concurrent-${i}`))
    }
    await Promise.all(acquires)

    const stats = pool.stats()
    expect(stats.leased).toBe(5)
  })

  it('should handle acquire-release cycle under load', async () => {
    const cycles = 50
    let completedCycles = 0

    const runCycle = async () => {
      const result = await pool.acquire('chatgpt', `cycle-${completedCycles}`)

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))

      // Release back to pool
      await pool.release(result.slaveId, true)
      completedCycles++
    }

    await Promise.all(Array.from({ length: cycles }, () => runCycle()))
    expect(completedCycles).toBeGreaterThanOrEqual(40) // Most should complete
  })
})
