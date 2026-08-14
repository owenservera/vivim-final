// tests/unit/server/module-registry.test.ts
// Tests for the ModuleRegistry with topological sort, cycle detection, and bootstrap.

import { beforeEach, describe, expect, it } from 'bun:test'
import type { ModuleDefinition } from '../../../src/server/module-registry.js'
import { ModuleRegistry } from '../../../src/server/module-registry.js'
import { ServiceContainer } from '../../../src/server/service-container.js'

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry
  let container: ServiceContainer

  beforeEach(() => {
    registry = new ModuleRegistry()
    container = new ServiceContainer()
  })

  // ── define / get / getAll / getByTag ─────────────────────────────────

  describe('define / get / getAll / getByTag', () => {
    it('defines a module and retrieves it by name', () => {
      const def: ModuleDefinition = {
        name: 'eventBus',
        tags: ['infra'],
        create: () => ({ type: 'bus' }),
      }
      registry.define(def)
      expect(registry.get('eventBus')).toBe(def)
      expect(registry.get('eventBus')?.name).toBe('eventBus')
    })

    it('returns undefined for unknown module', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('throws on duplicate definition', () => {
      registry.define({ name: 'dup', tags: [], create: () => ({}) })
      expect(() => registry.define({ name: 'dup', tags: [], create: () => ({}) })).toThrow(
        "ModuleRegistry: module 'dup' already defined",
      )
    })

    it('returns all defined modules', () => {
      registry.define({ name: 'a', tags: ['x'], create: () => ({}) })
      registry.define({ name: 'b', tags: ['y'], create: () => ({}) })
      expect(registry.getAll()).toHaveLength(2)
    })

    it('filters modules by tag', () => {
      registry.define({ name: 'a', tags: ['infra', 'core'], create: () => ({}) })
      registry.define({ name: 'b', tags: ['engine'], create: () => ({}) })
      registry.define({ name: 'c', tags: ['infra'], create: () => ({}) })

      expect(registry.getByTag('infra').map((m) => m.name)).toEqual(['a', 'c'])
      expect(registry.getByTag('engine').map((m) => m.name)).toEqual(['b'])
      expect(registry.getByTag('nonexistent')).toEqual([])
    })
  })

  // ── Topological sort ─────────────────────────────────────────────────

  describe('resolveOrder', () => {
    it('returns modules with no dependencies in a single pass', () => {
      registry.define({ name: 'a', tags: [], create: () => ({}) })
      registry.define({ name: 'b', tags: [], create: () => ({}) })
      registry.define({ name: 'c', tags: [], create: () => ({}) })

      // All have zero in-degree; alphabetical order for determinism
      expect(registry.resolveOrder()).toEqual(['a', 'b', 'c'])
    })

    it('sorts modules respecting dependsOn', () => {
      registry.define({ name: 'db', tags: ['infra'], create: () => ({}) })
      registry.define({ name: 'eventBus', tags: ['infra'], create: () => ({}) })
      registry.define({
        name: 'conversationStore',
        tags: ['store'],
        dependsOn: ['db'],
        create: (deps) => ({ db: deps.db }),
      })
      registry.define({
        name: 'conversationManager',
        tags: ['engine'],
        dependsOn: ['eventBus', 'conversationStore'],
        create: (deps) => ({ bus: deps.eventBus, store: deps.conversationStore }),
      })

      const order = registry.resolveOrder()
      expect(order.indexOf('db')).toBeLessThan(order.indexOf('conversationStore'))
      expect(order.indexOf('eventBus')).toBeLessThan(order.indexOf('conversationManager'))
      expect(order.indexOf('conversationStore')).toBeLessThan(order.indexOf('conversationManager'))
    })

    it('produces deterministic output for ties (alphabetical)', () => {
      registry.define({ name: 'zebra', tags: [], create: () => ({}) })
      registry.define({ name: 'alpha', tags: [], create: () => ({}) })
      registry.define({ name: 'beta', tags: [], create: () => ({}) })

      expect(registry.resolveOrder()).toEqual(['alpha', 'beta', 'zebra'])
    })

    it('handles diamond dependencies correctly', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D
      registry.define({ name: 'A', tags: [], create: () => ({}) })
      registry.define({ name: 'B', tags: [], dependsOn: ['A'], create: () => ({}) })
      registry.define({ name: 'C', tags: [], dependsOn: ['A'], create: () => ({}) })
      registry.define({ name: 'D', tags: [], dependsOn: ['B', 'C'], create: () => ({}) })

      const order = registry.resolveOrder()
      expect(order).toContain('A')
      expect(order).toContain('B')
      expect(order).toContain('C')
      expect(order).toContain('D')
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'))
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'))
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'))
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'))
    })
  })

  // ── Cycle detection ──────────────────────────────────────────────────

  describe('cycle detection', () => {
    it('detects a simple cycle A → B → A', () => {
      registry.define({ name: 'A', tags: [], dependsOn: ['B'], create: () => ({}) })
      registry.define({ name: 'B', tags: [], dependsOn: ['A'], create: () => ({}) })

      expect(() => registry.resolveOrder()).toThrow(/circular dependency/i)
    })

    it('detects a three-way cycle A → B → C → A', () => {
      registry.define({ name: 'A', tags: [], dependsOn: ['C'], create: () => ({}) })
      registry.define({ name: 'B', tags: [], dependsOn: ['A'], create: () => ({}) })
      registry.define({ name: 'C', tags: [], dependsOn: ['B'], create: () => ({}) })

      expect(() => registry.resolveOrder()).toThrow(/circular dependency/i)
    })

    it('includes the cycle members in the error message', () => {
      registry.define({ name: 'A', tags: [], dependsOn: ['B'], create: () => ({}) })
      registry.define({ name: 'B', tags: [], dependsOn: ['A'], create: () => ({}) })

      try {
        registry.resolveOrder()
        expect.unreachable('Should have thrown')
      } catch (err: unknown) {
        const msg = (err as Error).message
        expect(msg).toContain('A')
        expect(msg).toContain('B')
      }
    })

    it('does not false-positive on diamond (non-cyclic) deps', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D
      registry.define({ name: 'A', tags: [], create: () => ({}) })
      registry.define({ name: 'B', tags: [], dependsOn: ['A'], create: () => ({}) })
      registry.define({ name: 'C', tags: [], dependsOn: ['A'], create: () => ({}) })
      registry.define({ name: 'D', tags: [], dependsOn: ['B', 'C'], create: () => ({}) })

      // Should NOT throw
      expect(() => registry.resolveOrder()).not.toThrow()
    })
  })

  // ── Missing dependency ──────────────────────────────────────────────

  describe('missing dependency', () => {
    it('throws when a dependency is not defined', () => {
      registry.define({
        name: 'A',
        tags: [],
        dependsOn: ['nonexistent'],
        create: () => ({}),
      })

      expect(() => registry.resolveOrder()).toThrow(
        "depends on 'nonexistent', which is not defined",
      )
    })
  })

  // ── Bootstrap ───────────────────────────────────────────────────────

  describe('bootstrap', () => {
    it('creates and registers all modules in dependency order', async () => {
      registry.define({
        name: 'db',
        tags: ['infra'],
        create: () => ({ type: 'database' }),
      })
      registry.define({
        name: 'eventBus',
        tags: ['infra'],
        create: () => ({ type: 'bus' }),
      })
      registry.define({
        name: 'store',
        tags: ['store'],
        dependsOn: ['db'],
        create: (deps) => ({ db: deps.db, type: 'store' }),
      })

      await registry.bootstrap(container)

      expect(container.has('db')).toBe(true)
      expect(container.has('eventBus')).toBe(true)
      expect(container.has('store')).toBe(true)

      const db = container.resolve<{ type: string }>('db')
      expect(db.type).toBe('database')

      const store = container.resolve<{ db: unknown; type: string }>('store')
      expect(store.type).toBe('store')
      expect(store.db).toBe(db)
    })

    it('passes tags to the container', async () => {
      registry.define({
        name: 'engine',
        tags: ['engine', 'core'],
        create: () => ({}),
      })

      await registry.bootstrap(container)
      expect(container.list()).toEqual([{ name: 'engine', tags: ['engine', 'core'] }])
    })

    it('registers lifecycle hooks from module definition', async () => {
      const initCalls: string[] = []
      const startCalls: string[] = []
      const stopCalls: string[] = []

      registry.define({
        name: 'lifecycleModule',
        tags: ['service'],
        create: () => ({ id: 'lc' }),
        lifecycle: {
          init: async (instance) => {
            initCalls.push(`init:${(instance as { id: string }).id}`)
          },
          start: async (instance) => {
            startCalls.push(`start:${(instance as { id: string }).id}`)
          },
          stop: async (instance) => {
            stopCalls.push(`stop:${(instance as { id: string }).id}`)
          },
        },
      })

      await registry.bootstrap(container)
      await container.initAll()
      await container.startAll()
      await container.stopAll()

      expect(initCalls).toEqual(['init:lc'])
      expect(startCalls).toEqual(['start:lc'])
      expect(stopCalls).toEqual(['stop:lc'])
    })

    it('handles async create factories', async () => {
      registry.define({
        name: 'asyncModule',
        tags: ['infra'],
        create: async () => {
          // Simulate async initialization
          await Promise.resolve()
          return { async: true }
        },
      })

      await registry.bootstrap(container)
      const instance = container.resolve<{ async: boolean }>('asyncModule')
      expect(instance.async).toBe(true)
    })

    it('bootstraps a realistic multi-layer scenario', async () => {
      // infra → stores → engines → services
      registry.define({ name: 'db', tags: ['infra'], create: () => ({ db: true }) })
      registry.define({ name: 'bus', tags: ['infra'], create: () => ({ bus: true }) })
      registry.define({
        name: 'userStore',
        tags: ['store'],
        dependsOn: ['db'],
        create: (deps) => ({ ...deps.db, store: 'user' }),
      })
      registry.define({
        name: 'userManager',
        tags: ['engine'],
        dependsOn: ['userStore', 'bus'],
        create: (deps) => ({ store: deps.userStore, bus: deps.bus }),
      })
      registry.define({
        name: 'userService',
        tags: ['service'],
        dependsOn: ['userManager'],
        create: (deps) => ({ manager: deps.userManager }),
      })

      await registry.bootstrap(container)

      // Verify all are registered
      expect(container.has('db')).toBe(true)
      expect(container.has('bus')).toBe(true)
      expect(container.has('userStore')).toBe(true)
      expect(container.has('userManager')).toBe(true)
      expect(container.has('userService')).toBe(true)

      // Verify dependency wiring
      const userService = container.resolve<{ manager: unknown }>('userService')
      const userManager = userService.manager as { store: unknown; bus: unknown }
      expect(userManager.store).toBeTruthy()
      expect(userManager.bus).toBeTruthy()
    })
  })
})
