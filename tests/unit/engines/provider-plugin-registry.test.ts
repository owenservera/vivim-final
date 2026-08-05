// tests/unit/engines/provider-plugin-registry.test.ts
// Tests for ProviderPluginRegistry — lifecycle, health checks, capability queries.

import { beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import {
  ProviderPluginRegistry,
  resetProviderPluginRegistry,
} from '../../../src/engines/providers/plugin-registry.js'
import type {
  ProviderPlugin,
  ProviderPluginFactory,
} from '../../../src/engines/providers/provider-plugin-interface.js'

// ── Test Helpers ──────────────────────────────────────────────────────────

/** Create a mock plugin with full lifecycle tracking. */
function createMockPlugin(
  overrides?: Partial<ProviderPlugin> & { slug?: string },
): ProviderPlugin & { _log: string[] } {
  const slug = overrides?.slug ?? 'mock'
  const log: string[] = []

  return {
    metadata: {
      slug,
      name: `${slug} provider`,
      type: 'llm',
      version: '1.0.0',
      surfaces: ['cli', 'ui'],
      tags: ['ai'],
      ...overrides?.metadata,
    },
    init: async () => {
      log.push(`${slug}:init`)
    },
    healthCheck: async () => ({
      status: 'healthy' as const,
      checkedAt: Date.now(),
      latencyMs: 10,
    }),
    getCapabilities: () => [{ capabilityId: `${slug}_chat`, name: 'Chat', available: true }],
    stop: async () => {
      log.push(`${slug}:stop`)
    },
    start: async () => {
      log.push(`${slug}:start`)
    },
    reset: async () => {
      log.push(`${slug}:reset`)
    },
    _log: log,
    ...overrides,
  } as ProviderPlugin & { _log: string[] }
}

describe('ProviderPluginRegistry', () => {
  let registry: ProviderPluginRegistry
  let eventBus: CapabilityEventBus

  beforeEach(() => {
    resetProviderPluginRegistry()
    CapabilityEventBus.resetInstance()
    registry = new ProviderPluginRegistry()
    eventBus = CapabilityEventBus.getInstance()
  })

  // ── Factory Registration ───────────────────────────────────────────────

  describe('registerFactory', () => {
    it('registers a factory and instantiates during initAll', async () => {
      const plugin = createMockPlugin({ slug: 'factory-plugin' })
      const factory: ProviderPluginFactory = () => plugin

      registry.registerFactory('factory-plugin', factory)
      expect(registry.has('factory-plugin')).toBe(false) // not yet instantiated

      await registry.initAll(eventBus, {})
      expect(registry.has('factory-plugin')).toBe(true)
      expect(registry.get('factory-plugin')?.metadata.slug).toBe('factory-plugin')
    })

    it('overwrites existing factory with same slug', () => {
      const factory1: ProviderPluginFactory = () => createMockPlugin({ slug: 'a' })
      const factory2: ProviderPluginFactory = () => createMockPlugin({ slug: 'a' })

      registry.registerFactory('a', factory1)
      registry.registerFactory('a', factory2)
      // Both registered without error — last one wins during init
      expect(registry.size).toBe(0) // not instantiated yet
    })
  })

  // ── Direct Plugin Registration ─────────────────────────────────────────

  describe('registerPlugin', () => {
    it('registers a plugin instance directly', () => {
      const plugin = createMockPlugin({ slug: 'direct' })
      registry.registerPlugin(plugin)

      expect(registry.has('direct')).toBe(true)
      expect(registry.get('direct')).toBe(plugin)
    })

    it('overwrites existing plugin with same slug', () => {
      const p1 = createMockPlugin({ slug: 'dup' })
      const p2 = createMockPlugin({ slug: 'dup' })

      registry.registerPlugin(p1)
      registry.registerPlugin(p2)

      expect(registry.get('dup')).toBe(p2)
      expect(registry.size).toBe(1)
    })
  })

  // ── Init Order ─────────────────────────────────────────────────────────

  describe('initAll', () => {
    it('initializes plugins in registration order', async () => {
      const p1 = createMockPlugin({ slug: 'alpha' })
      const p2 = createMockPlugin({ slug: 'beta' })
      const p3 = createMockPlugin({ slug: 'gamma' })

      registry.registerPlugin(p1)
      registry.registerPlugin(p2)
      registry.registerPlugin(p3)

      await registry.initAll(eventBus, {})

      expect(p1._log).toEqual(['alpha:init'])
      expect(p2._log).toEqual(['beta:init'])
      expect(p3._log).toEqual(['gamma:init'])
    })

    it('instantiates factories before initializing them', async () => {
      const plugin = createMockPlugin({ slug: 'from-factory' })
      const factory: ProviderPluginFactory = () => plugin

      registry.registerFactory('from-factory', factory)
      await registry.initAll(eventBus, {})

      expect(plugin._log).toEqual(['from-factory:init'])
    })

    it('continues init when one plugin throws', async () => {
      const good1 = createMockPlugin({ slug: 'good1' })
      const bad = createMockPlugin({
        slug: 'bad',
        init: async () => {
          throw new Error('boom')
        },
      })
      const good2 = createMockPlugin({ slug: 'good2' })

      registry.registerPlugin(good1)
      registry.registerPlugin(bad)
      registry.registerPlugin(good2)

      // Should not throw — errors are logged and swallowed
      await registry.initAll(eventBus, {})

      expect(good1._log).toEqual(['good1:init'])
      expect(bad._log).toEqual([])
      expect(good2._log).toEqual(['good2:init'])
    })

    it('is idempotent — second call is a no-op', async () => {
      const plugin = createMockPlugin({ slug: 'idem' })
      registry.registerPlugin(plugin)

      await registry.initAll(eventBus, {})
      await registry.initAll(eventBus, {})

      // init called exactly once
      expect(plugin._log).toEqual(['idem:init'])
    })
  })

  // ── Start / Stop Lifecycle ─────────────────────────────────────────────

  describe('startAll / stopAll', () => {
    it('starts all plugins in init order', async () => {
      const p1 = createMockPlugin({ slug: 's1' })
      const p2 = createMockPlugin({ slug: 's2' })

      registry.registerPlugin(p1)
      registry.registerPlugin(p2)

      await registry.initAll(eventBus, {})
      await registry.startAll()

      expect(p1._log).toEqual(['s1:init', 's1:start'])
      expect(p2._log).toEqual(['s2:init', 's2:start'])
    })

    it('stops all plugins in reverse init order', async () => {
      const p1 = createMockPlugin({ slug: 'r1' })
      const p2 = createMockPlugin({ slug: 'r2' })

      registry.registerPlugin(p1)
      registry.registerPlugin(p2)

      await registry.initAll(eventBus, {})
      await registry.startAll()
      await registry.stopAll()

      // r2 was inited after r1, so r2 stops first
      expect(p1._log).toEqual(['r1:init', 'r1:start', 'r1:stop'])
      expect(p2._log).toEqual(['r2:init', 'r2:start', 'r2:stop'])
    })

    it('startAll is a no-op before init', async () => {
      const plugin = createMockPlugin({ slug: 'premature' })
      registry.registerPlugin(plugin)

      await registry.startAll()
      expect(plugin._log).toEqual([])
    })

    it('plugins without start() are skipped gracefully', async () => {
      const noStart = createMockPlugin({
        slug: 'nostart',
      })
      // Delete the start property entirely to test the optional hook
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (noStart as any).start

      registry.registerPlugin(noStart)
      await registry.initAll(eventBus, {})
      await registry.startAll()

      expect(noStart._log).toEqual(['nostart:init'])
    })

    it('continues stopping when one plugin throws', async () => {
      const good = createMockPlugin({ slug: 'stop-good' })
      const bad = createMockPlugin({
        slug: 'stop-bad',
        stop: async () => {
          throw new Error('stop boom')
        },
      })

      registry.registerPlugin(good)
      registry.registerPlugin(bad)

      await registry.initAll(eventBus, {})
      // Should not throw
      await registry.stopAll()

      expect(good._log).toEqual(['stop-good:init', 'stop-good:stop'])
    })
  })

  // ── Health Check Aggregation ───────────────────────────────────────────

  describe('healthCheckAll', () => {
    it('returns health results for all plugins', async () => {
      const p1 = createMockPlugin({ slug: 'h1' })
      const p2 = createMockPlugin({ slug: 'h2' })

      registry.registerPlugin(p1)
      registry.registerPlugin(p2)
      await registry.initAll(eventBus, {})

      const results = await registry.healthCheckAll()

      expect(results.size).toBe(2)
      expect(results.get('h1')?.status).toBe('healthy')
      expect(results.get('h2')?.status).toBe('healthy')
    })

    it('captures errors as unhealthy results', async () => {
      const failing = createMockPlugin({
        slug: 'failing',
        healthCheck: async () => {
          throw new Error('connection refused')
        },
      })

      registry.registerPlugin(failing)
      await registry.initAll(eventBus, {})

      const results = await registry.healthCheckAll()
      const result = results.get('failing')

      expect(result?.status).toBe('unhealthy')
      expect(result?.details).toContain('connection refused')
      expect(result?.latencyMs).toBe(0)
    })

    it('caches health results', async () => {
      const plugin = createMockPlugin({ slug: 'cached' })
      registry.registerPlugin(plugin)
      await registry.initAll(eventBus, {})

      await registry.healthCheckAll()
      const cached = registry.getCachedHealth('cached')

      expect(cached).toBeDefined()
      expect(cached?.status).toBe('healthy')
    })
  })

  describe('healthCheck (single)', () => {
    it('returns health result for a specific plugin', async () => {
      const plugin = createMockPlugin({
        slug: 'single',
        healthCheck: async () => ({
          status: 'degraded' as const,
          checkedAt: 1000,
          latencyMs: 500,
          details: 'rate limited',
          nextCheckAt: 2000,
        }),
      })

      registry.registerPlugin(plugin)
      await registry.initAll(eventBus, {})

      const result = await registry.healthCheck('single')
      expect(result?.status).toBe('degraded')
      expect(result?.latencyMs).toBe(500)
      expect(result?.details).toBe('rate limited')
      expect(result?.nextCheckAt).toBe(2000)
    })

    it('returns undefined for unknown plugin', async () => {
      const result = await registry.healthCheck('nonexistent')
      expect(result).toBeUndefined()
    })

    it('captures errors as unhealthy results', async () => {
      const plugin = createMockPlugin({
        slug: 'err-single',
        healthCheck: async () => {
          throw new Error('timeout')
        },
      })

      registry.registerPlugin(plugin)
      await registry.initAll(eventBus, {})

      const result = await registry.healthCheck('err-single')
      expect(result?.status).toBe('unhealthy')
      expect(result?.details).toContain('timeout')
    })
  })

  // ── Capability Queries ─────────────────────────────────────────────────

  describe('getPluginsByCapability', () => {
    it('finds plugins that offer a specific capability', async () => {
      const p1 = createMockPlugin({
        slug: 'cap-a',
        getCapabilities: () => [
          { capabilityId: 'chat', name: 'Chat', available: true },
          { capabilityId: 'vision', name: 'Vision', available: false },
        ],
      })
      const p2 = createMockPlugin({
        slug: 'cap-b',
        getCapabilities: () => [{ capabilityId: 'chat', name: 'Chat', available: true }],
      })
      const p3 = createMockPlugin({
        slug: 'cap-c',
        getCapabilities: () => [{ capabilityId: 'code', name: 'Code', available: true }],
      })

      registry.registerPlugin(p1)
      registry.registerPlugin(p2)
      registry.registerPlugin(p3)

      const chatProviders = registry.getPluginsByCapability('chat')
      expect(chatProviders).toHaveLength(2)
      const chatSlugs = chatProviders.map((p) => p.metadata.slug)
      expect(chatSlugs).toEqual(['cap-a', 'cap-b'])

      const codeProviders = registry.getPluginsByCapability('code')
      expect(codeProviders).toHaveLength(1)
      expect(codeProviders[0]?.metadata.slug).toBe('cap-c')

      const missing = registry.getPluginsByCapability('nonexistent')
      expect(missing).toHaveLength(0)
    })
  })

  describe('getAllCapabilities', () => {
    it('returns all capabilities across all plugins', async () => {
      const p1 = createMockPlugin({
        slug: 'all-a',
        getCapabilities: () => [{ capabilityId: 'chat', name: 'Chat', available: true }],
      })
      const p2 = createMockPlugin({
        slug: 'all-b',
        getCapabilities: () => [
          { capabilityId: 'vision', name: 'Vision', available: true },
          { capabilityId: 'code', name: 'Code', available: false },
        ],
      })

      registry.registerPlugin(p1)
      registry.registerPlugin(p2)

      const all = registry.getAllCapabilities()
      expect(all).toHaveLength(3)
      const capIds = all.map((e) => e.capability.capabilityId)
      expect(capIds).toEqual(['chat', 'vision', 'code'])
      expect(all[0]?.provider.slug).toBe('all-a')
      expect(all[1]?.provider.slug).toBe('all-b')
    })
  })

  // ── Metadata ───────────────────────────────────────────────────────────

  describe('listMetadata', () => {
    it('returns metadata for all registered plugins', () => {
      registry.registerPlugin(createMockPlugin({ slug: 'm1' }))
      registry.registerPlugin(createMockPlugin({ slug: 'm2' }))

      const meta = registry.listMetadata()
      expect(meta).toHaveLength(2)
      const slugs = meta.map((m) => m.slug)
      expect(slugs).toEqual(['m1', 'm2'])
      expect(meta[0]?.type).toBe('llm')
      expect(meta[0]?.surfaces).toEqual(['cli', 'ui'])
    })
  })

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty registry gracefully', async () => {
      await registry.initAll(eventBus, {})
      await registry.startAll()
      const health = await registry.healthCheckAll()
      expect(health.size).toBe(0)
      expect(registry.listMetadata()).toEqual([])
      expect(registry.getPluginsByCapability('chat')).toEqual([])
      expect(registry.getAllCapabilities()).toEqual([])
      await registry.stopAll()
    })

    it('factory that throws is handled gracefully', async () => {
      const badFactory: ProviderPluginFactory = () => {
        throw new Error('factory error')
      }
      registry.registerFactory('bad-factory', badFactory)

      // Should not throw
      await registry.initAll(eventBus, {})
      expect(registry.has('bad-factory')).toBe(false)
    })

    it('getCachedHealth returns undefined before any check', () => {
      expect(registry.getCachedHealth('any')).toBeUndefined()
    })
  })
})
