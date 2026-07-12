// tests/unit/engines/config-universal-surface.test.ts
// Unit tests for ConfigUniversalSurface (v9.1)

import { describe, expect, test, beforeEach } from 'bun:test'
import { ConfigUniversalSurface } from '../../../src/engines/config-universal-surface.js'
import type { CapabilityEventBus, EngineEvent } from '../../../src/engines/capability-event-bus.js'

// Mock event bus
const events: Array<{ type: string; data: unknown }> = []
const mockEventBus: CapabilityEventBus = {
  emit(event: EngineEvent) {
    events.push({ type: event.type, data: event })
  },
  on() { return () => {} },
  off() {},
  subscribe() {},
  unsubscribe() {},
} as unknown as CapabilityEventBus

describe('ConfigUniversalSurface', () => {
  let surface: ConfigUniversalSurface

  beforeEach(() => {
    events.length = 0
    surface = new ConfigUniversalSurface({
      registry: {} as any,
      configManager: { registerSchema() {}, getConfig() { return {} } } as any,
      eventBus: mockEventBus as any,
    })
  })

  test('listScopes returns all 12 scopes', () => {
    const scopes = surface.listScopes()
    expect(scopes.length).toBe(12)
    const scopeIds = scopes.map(s => s.id)
    expect(scopeIds).toContain('engine')
    expect(scopeIds).toContain('capability')
    expect(scopeIds).toContain('store')
    expect(scopeIds).toContain('route')
    expect(scopeIds).toContain('autoheal')
    expect(scopeIds).toContain('nlcl')
    expect(scopeIds).toContain('stealth')
    expect(scopeIds).toContain('provider')
    expect(scopeIds).toContain('workflow')
    expect(scopeIds).toContain('canvas:layer')
    expect(scopeIds).toContain('kernel:topology')
    expect(scopeIds).toContain('telemetry')
  })

  test('get/set round-trips a value', () => {
    const result = surface.set('engine', 'testKey', { value: 42 })
    expect(result.value).toEqual({ value: 42 })
    expect(result.scope).toBe('engine')
    expect(result.key).toBe('testKey')

    const fetched = surface.get('engine', 'testKey')
    expect(fetched?.value).toEqual({ value: 42 })
  })

  test('set emits config:changed on eventBus', () => {
    surface.set('autoheal', 'setting', {
      stalledEngineRestart: { enabled: true, maxAgeMinutes: 5, backoffMs: 1000 },
      healthDecayRestart: { enabled: false, decayThreshold: 10, minHealth: 0.5, cooldownMinutes: 1 },
    })
    expect(events.length).toBe(1)
    expect((events[0]?.data as { engineId?: string }).engineId).toBe('autoheal')
  })

  test('snapshot/rollback restores prior state', () => {
    surface.set('engine', 'before', 'original')
    const snapId = surface.snapshot()
    surface.set('engine', 'before', 'modified')
    const beforeRollback = surface.get('engine', 'before')
    expect(beforeRollback?.value).toBe('modified')

    surface.rollback(snapId)
    const afterRollback = surface.get('engine', 'before')
    expect(afterRollback?.value).toBe('original')
  })

  test('set rejects invalid autoheal value via Zod', () => {
    expect(() => surface.set('autoheal', 'policy', { invalid: 'value' } as unknown)).toThrow()
    surface.set('autoheal', 'policy', {
      stalledEngineRestart: { enabled: true, maxAgeMinutes: 5, backoffMs: 1000 },
      healthDecayRestart: { enabled: false, decayThreshold: 10, minHealth: 0.5, cooldownMinutes: 1 },
    })
    const fetched = surface.get('autoheal', 'policy')
    expect(fetched?.value).toBeDefined()
  })

  test('rollback throws for unknown snapshot id', () => {
    expect(() => surface.rollback('snap:nonexistent')).toThrow('Snapshot snap:nonexistent not found')
  })
})