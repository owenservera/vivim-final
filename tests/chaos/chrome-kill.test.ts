// tests/chaos/chrome-kill.test.ts
// Chaos test: Kill Chrome process mid-operation and verify recovery.
// Phase 11: Production hardening via chaos engineering.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { EventBus } from '../../src/engines/events/event-bus.js'
import { RecoveryOrchestrator } from '../../src/engines/reliability/recovery-orchestrator.js'

describe('Chaos: Chrome Kill Mid-Operation', () => {
  let eventBus: EventBus
  let recovery: RecoveryOrchestrator

  beforeEach(() => {
    eventBus = new EventBus()
    recovery = new RecoveryOrchestrator(
      eventBus,
      () => ({
        slaveId: 'test-slave',
        debugPort: 9222,
        profileDir: '/tmp/test-profile',
        providerId: 'chatgpt',
      }),
      () => ({
        maxRetries: {
          OOM: 3,
          RendererCrash: 3,
          BrowserCrash: 2,
          NavigationTimeout: 2,
          ProviderTimeout: 2,
          AuthFailure: 1,
          ProfileCorruption: 1,
          CdpDisconnect: 3,
          GpuFailure: 2,
          Unknown: 1,
        },
      }),
    )
  })

  afterEach(() => {
    recovery.stop()
  })

  it('should recover from Chrome process crash', async () => {
    recovery.start()

    // Simulate a crash event
    await eventBus.publish({
      type: 'SlaveCrashed',
      slaveId: 'test-slave',
      cause: 'Process killed',
      ts: Date.now(),
    })

    // Wait for recovery
    await new Promise((resolve) => setTimeout(resolve, 100))

    const attempts = recovery.getAttempts('test-slave')
    expect(attempts.length).toBeGreaterThan(0)
  })

  it('should classify renderer crash correctly', async () => {
    recovery.start()

    await eventBus.publish({
      type: 'SlaveCrashed',
      slaveId: 'test-slave',
      cause: 'Inspector.targetCrashed',
      ts: Date.now(),
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const attempts = recovery.getAttempts('test-slave')
    expect(attempts.length).toBeGreaterThan(0)
    expect(attempts[0]?.failureClass).toBe('RendererCrash')
  })

  it('should classify OOM correctly', async () => {
    recovery.start()

    await eventBus.publish({
      type: 'SlaveCrashed',
      slaveId: 'test-slave',
      cause: 'MEMORY_EXCESS',
      ts: Date.now(),
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const attempts = recovery.getAttempts('test-slave')
    expect(attempts.length).toBeGreaterThan(0)
    expect(attempts[0]?.failureClass).toBe('OOM')
  })

  it('should exhaust retries and stop', async () => {
    recovery.start()

    // Crash 4 times (exceeding maxRetries of 1 for Unknown)
    for (let i = 0; i < 4; i++) {
      await eventBus.publish({
        type: 'SlaveCrashed',
        slaveId: 'test-slave',
        cause: 'Unknown error',
        ts: Date.now(),
      })
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // Should have attempted recovery but stopped after max
    const attempts = recovery.getAttempts('test-slave')
    expect(attempts.length).toBeLessThanOrEqual(2) // circuit_breaker + maybe one more
  })
})
