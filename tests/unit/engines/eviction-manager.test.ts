// tests/unit/engines/eviction-manager.test.ts
// Unit 8.1 — Idle slave TTL + configurable eviction policy.

import { afterEach, describe, expect, it } from 'bun:test'
import { EvictionManager } from '../../../src/engines/eviction-manager.js'

function makeMocks() {
  const handlers: Record<string, (e: unknown) => void> = {}
  const eventBus: any = {
    on: (ev: string, fn: (e: unknown) => void) => {
      handlers[ev] = fn
    },
  }
  const killed: string[] = []
  const governor: any = {
    getAllSlaves: (): any[] => [],
    kill: async (id: string) => {
      killed.push(id)
    },
  }
  return { handlers, eventBus, governor, killed }
}

describe('EvictionManager (Unit 8.1)', () => {
  const managers: EvictionManager[] = []
  afterEach(() => {
    for (const m of managers) m.stop()
    managers.length = 0
  })

  function make(eventBus: any, governor: any): EvictionManager {
    const em = new EvictionManager(governor, eventBus)
    managers.push(em)
    return em
  }

  it('registers a capability:executed handler to record access', () => {
    const { handlers, eventBus, governor } = makeMocks()
    const em = make(eventBus, governor)
    expect(typeof handlers['capability:executed']).toBe('function')
    handlers['capability:executed']({ slaveId: 's1' })
    expect((em as any).accessLog.has('s1')).toBe(true)
  })

  it('evicts slaves that exceed the idle TTL', async () => {
    const { handlers, eventBus, governor, killed } = makeMocks()
    const em = make(eventBus, governor)
    handlers['capability:executed']({ slaveId: 'busy' })
    governor.getAllSlaves = () => [
      { slaveId: 'busy', id: 'busy' },
      { slaveId: 'idle', id: 'idle' },
    ]
    ;(em as any).accessLog.set('idle', {
      lastAccess: Date.now() - 10 * 60_000,
      accessCount: 0,
      createdAt: Date.now() - 10 * 60_000,
    })
    await (em as any).runCheck()
    expect(killed).toContain('idle')
    expect(killed).not.toContain('busy')
  })

  it('does not evict slaves within the idle TTL', async () => {
    const { handlers, eventBus, governor, killed } = makeMocks()
    const em = make(eventBus, governor)
    governor.getAllSlaves = () => [{ slaveId: 'fresh', id: 'fresh' }]
    ;(em as any).accessLog.set('fresh', {
      lastAccess: Date.now(),
      accessCount: 1,
      createdAt: Date.now(),
    })
    await (em as any).runCheck()
    expect(killed).not.toContain('fresh')
  })

  it('start/stop manage the timer without throwing', () => {
    const { eventBus, governor } = makeMocks()
    const em = make(eventBus, governor)
    expect(() => {
      em.start()
      em.stop()
    }).not.toThrow()
  })
})
