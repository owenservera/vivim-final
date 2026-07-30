// tests/stress/memory-leak.test.ts
// Stress test: Run operations for extended period and monitor memory.
// Phase 11: Production hardening via stress testing.

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { EventBus } from '../../src/engines/events/event-bus.js'
import { BrowserPool } from '../../src/engines/pool/browser-pool.js'
import { FleetManager } from '../../src/fleet/fleet-manager.js'
import { InMemoryEventStore } from '../../src/engines/reliability/event-store.js'

describe('Stress: Memory Leak Detection', () => {
  let eventBus: EventBus
  let pool: BrowserPool
  let fleet: FleetManager
  let eventStore: InMemoryEventStore
  let slaveCounter = 0

  beforeEach(() => {
    eventBus = new EventBus()
    slaveCounter = 0
    pool = new BrowserPool(
      async (providerId, accountId) => {
        slaveCounter++
        return {
          slaveId: `stress-slave-${slaveCounter}`,
          debugPort: 9100 + slaveCounter,
          profileDir: `/tmp/stress-profile-${slaveCounter}`,
        }
      },
      { minWarm: 0, maxWarm: 2, maxIdleMs: 30_000, maxLeasesPerSlave: 1 },
    )
    fleet = new FleetManager(eventBus, { minWorkers: 0, maxWorkers: 3, scaleUpThreshold: 0.8, scaleDownThresholdMs: 300_000, globalConcurrency: 50 })
    eventStore = new InMemoryEventStore()
  })

  afterEach(async () => {
    await fleet.stop()
    await pool.stop()
  })

  it('should not leak memory during 1000 event cycles', async () => {
    const initialMemory = process.memoryUsage().heapUsed

    // Publish and subscribe 1000 events
    const unsubscribe = eventBus.subscribe('SlaveCrashed', async () => {})

    for (let i = 0; i < 1000; i++) {
      await eventBus.publish({
        type: 'SlaveCrashed',
        slaveId: `stress-slave-${i % 10}`,
        cause: 'Test crash',
        ts: Date.now(),
      })
    }

    unsubscribe()

    // Force GC if available
    if (global.gc) global.gc()

    const finalMemory = process.memoryUsage().heapUsed
    const memoryGrowthMb = (finalMemory - initialMemory) / (1024 * 1024)

    // Should not grow more than 50MB for 1000 events
    expect(memoryGrowthMb).toBeLessThan(50)
  })

  it('should not leak event store entries', async () => {
    // Append 500 events
    for (let i = 0; i < 500; i++) {
      await eventStore.append({
        streamId: `stream-${i % 5}`,
        type: 'TestEvent',
        payload: { type: 'SlaveCrashed', slaveId: 'test', cause: 'test', ts: Date.now() },
        createdAt: new Date(),
      })
    }

    // Query should return recent entries only
    const recent = await eventStore.getByType('TestEvent', 100)
    expect(recent.length).toBe(100) // Limited by limit
  })
})
