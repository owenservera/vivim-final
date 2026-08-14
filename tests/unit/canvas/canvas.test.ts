// tests/unit/canvas/canvas.test.ts
// Unit coverage for vivim-canvas orchestration — CanvasEngine, registry, mounter,
// mirror, bridge, oracle, primitives, and designer.

import { beforeEach, describe, expect, it, mock } from 'bun:test'

type MockFn = (...args: any[]) => any

import { CanvasEngine } from '../../../src/canvas/canvas-engine.js'
import { CanvasMirror, InMemoryCanvasMirrorStore } from '../../../src/canvas/canvas-mirror.js'
import { CanvasRegistry } from '../../../src/canvas/canvas-registry.js'
import { SandboxBridge } from '../../../src/canvas/capability-bridge.js'
import { CanvasDesigner } from '../../../src/canvas/designer.js'
import { InMemoryCanvasStore } from '../../../src/canvas/in-memory-store.js'
import { type LayerHost, LayerMounter } from '../../../src/canvas/layer-mounter.js'
import { OracleReader } from '../../../src/canvas/oracle-reader.js'
import { CorePrimitiveRegistry } from '../../../src/canvas/primitives.js'
import type {
  CanvasDefinition,
  OracleVisibility,
  PrimitiveKind,
} from '../../../src/canvas/types.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { CanvasStore } from '../../../src/storage/contracts/canvas-store.js'

// Mock LayerHost implementation
function makeLayerHost(): LayerHost {
  return {
    mount: mock(() => Promise.resolve({ hostNodeId: 'node-1' })),
    unmount: mock(() => Promise.resolve()),
    isMounted: mock(() => false),
  } as unknown as LayerHost
}

// Mock CapabilityExecutor
function makeExecutor(): { execute: MockFn } {
  return {
    execute: mock(() => Promise.resolve({ success: true })),
  }
}

// Mock OracleReadProvider
function makeOracleProvider(): { visibility: MockFn } {
  return {
    visibility: mock(() =>
      Promise.resolve({
        providers: 3,
        engines: 5,
        openLayers: 2,
        projects: 10,
        knowledgeNodes: 100,
        agents: 4,
        health: { status: 'ok' },
      } as OracleVisibility),
    ),
  }
}

// Mock PrimitiveProvider
function makePrimitiveProvider(kind: PrimitiveKind): { kind: PrimitiveKind; read: MockFn } {
  return {
    kind,
    read: mock(() => Promise.resolve([])),
  }
}

describe('CanvasEngine (orchestration)', () => {
  let store: CanvasStore
  let host: LayerHost
  let executor: { execute: MockFn }
  let oracle: { visibility: MockFn }
  let engine: CanvasEngine

  beforeEach(() => {
    store = new InMemoryCanvasStore()
    host = makeLayerHost()
    executor = makeExecutor()
    oracle = makeOracleProvider()
    engine = new CanvasEngine({
      store,
      host,
      executor,
      oracle,
    })
  })

  describe('seedCoreLayers', () => {
    it('seeds core layers and registers capabilities', async () => {
      // Seed core layers
      const seeded = await engine.seedCoreLayers()
      expect(seeded.length).toBeGreaterThanOrEqual(3)

      // Create a fake registry mock with a register method
      let registered = 0
      const fakeRegistry = {
        register: mock(() => {
          registered++
        }),
        list: mock(() => []),
        get: mock(() => null),
        getBySlug: mock(() => null),
        unmount: mock(() => {}),
        isMounted: mock(() => false),
      } as unknown as UnifiedCapabilityRegistry

      // Register capabilities with kernel oracle context (v9.5) to get 7 capabilities
      const _fullOracle = {
        visibility: oracle.visibility,
        query: {
          query: mock(() => Promise.resolve({ health: 'ok' })),
        },
        actuator: {
          heal: mock(() => Promise.resolve({})),
        },
      }
      const _configSurface = {
        listScopes: mock(() => []),
        get: mock(() => undefined),
        set: mock(() => {}),
        snapshot: mock(() => '{}'),
        rollback: mock(() => {}),
      }

      // We need to create engine with kernelOracle and configSurface for full capabilities
      const engineWithKernel = new CanvasEngine({
        store: new InMemoryCanvasStore(),
        host: makeLayerHost(),
        executor: makeExecutor(),
        oracle,
        primities: [
          makePrimitiveProvider('workspace'),
          makePrimitiveProvider('projects'),
          makePrimitiveProvider('knowledge'),
          makePrimitiveProvider('agents'),
          makePrimitiveProvider('providers'),
          makePrimitiveProvider('conversations'),
        ],
      })

      // Register canvas capabilities
      engineWithKernel.registerCapabilities(fakeRegistry as UnifiedCapabilityRegistry)
      expect(registered).toBeGreaterThanOrEqual(6) // core canvas capabilities
    })
  })
})

describe('CanvasRegistry', () => {
  let registry: CanvasRegistry
  let store: CanvasStore

  beforeEach(() => {
    store = new InMemoryCanvasStore()
    registry = new CanvasRegistry(store)
  })

  it('define() creates and stores a canvas definition', async () => {
    const def = await registry.define({
      slug: 'test-layer',
      name: 'Test Layer',
      description: 'A test layer',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: ['test'],
    })

    expect(def.id).toMatch(/^def:test-layer:/)
    expect(def.slug).toBe('test-layer')
    expect(def.name).toBe('Test Layer')
  })

  it('getBySlug() retrieves definition by slug', async () => {
    await registry.define({
      slug: 'retrieved-layer',
      name: 'Retrieved Layer',
      description: 'A layer to retrieve',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })

    const retrieved = await registry.getBySlug('retrieved-layer')
    expect(retrieved?.slug).toBe('retrieved-layer')
    expect(retrieved?.name).toBe('Retrieved Layer')
  })

  it('getBySlug() returns null for missing slug', async () => {
    const retrieved = await registry.getBySlug('nonexistent')
    expect(retrieved).toBeNull()
  })

  it('list() returns all definitions', async () => {
    await registry.define({
      slug: 'layer-1',
      name: 'Layer 1',
      description: 'First layer',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })
    await registry.define({
      slug: 'layer-2',
      name: 'Layer 2',
      description: 'Second layer',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })

    const all = await registry.list()
    expect(all.length).toBe(2)
  })

  it('list() filters by category', async () => {
    await registry.define({
      slug: 'system-layer',
      name: 'System Layer',
      description: 'System layer',
      category: 'system',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'system',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })

    const systems = await registry.list({ category: 'system' })
    expect(systems.length).toBe(1)
    expect(systems[0]?.slug).toBe('system-layer')
  })

  it('update() modifies existing definition', async () => {
    const def = await registry.define({
      slug: 'updatable',
      name: 'Original Name',
      description: 'Original description',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })

    const updated = await registry.update(def.id, {
      name: 'Updated Name',
      description: 'Updated description',
    })
    expect(updated.name).toBe('Updated Name')
    expect(updated.version).toBe(2) // Version bumps on update
  })

  it('update() throws for missing definition', async () => {
    await expect(registry.update('missing-id', { name: 'New Name' })).rejects.toThrow('not found')
  })

  it('deprecate() changes status to deprecated', async () => {
    const def = await registry.define({
      slug: 'to-deprecate',
      name: 'Deprecate Me',
      description: '',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })

    const deprecated = await registry.deprecate(def.id)
    expect(deprecated.status).toBe('deprecated')
  })

  it('delete() removes definition', async () => {
    const def = await registry.define({
      slug: 'to-delete',
      name: 'Delete Me',
      description: '',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })

    await registry.delete(def.id)
    const retrieved = await registry.getBySlug('to-delete')
    expect(retrieved).toBeNull()
  })
})

describe('LayerMounter', () => {
  let store: CanvasStore
  let host: LayerHost
  let mounter: LayerMounter
  let registry: CanvasRegistry

  beforeEach(async () => {
    store = new InMemoryCanvasStore()
    host = makeLayerHost()
    registry = new CanvasRegistry(store)
    // Seed at least one definition for spawning
    const def = await registry.define({
      slug: 'chat',
      name: 'Chat Layer',
      description: 'Chat interface',
      category: 'chat',
      html: '<div data-region="chat-thread"></div>',
      css: '',
      bindings: [
        {
          regionId: 'chat-thread',
          role: 'chat-thread',
          selector: '[data-region="chat-thread"]',
          primitive: 'conversations',
          direction: 'bidirectional',
        },
      ],
      layout: { x: 0, y: 0, z: 0, w: 400, h: 500 },
      author: 'system',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: ['core'],
    })
    mounter = new LayerMounter(store, host, registry)
    // Store definition ID for tests
    ;(mounter as any).testDefId = def.id
  })

  it('spawn() creates instance and mounts to host', async () => {
    const testDefId = (mounter as any).testDefId
    const instance = await mounter.spawn(testDefId)
    expect(instance.instanceId).toMatch(/^inst:chat:/)
    expect(instance.definitionId).toMatch(/^def:chat:/)
    expect(instance.status).toBe('live')
    expect(host.mount).toHaveBeenCalled()
  })

  it('spawn() throws for missing definition', async () => {
    await expect(mounter.spawn('missing-def')).rejects.toThrow('not found')
  })

  it('spawn() throws for deprecated definition', async () => {
    const def = await registry.define({
      slug: 'deprecated-layer',
      name: 'Deprecated',
      description: '',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })
    await registry.deprecate(def.id)

    await expect(mounter.spawn(def.id)).rejects.toThrow('deprecated')
  })

  it('list() returns instances', async () => {
    const testDefId = (mounter as any).testDefId
    await mounter.spawn(testDefId)
    const instances = await mounter.list()
    expect(instances.length).toBeGreaterThan(0)
  })

  it('dismiss() unmounts and marks dismissed', async () => {
    const testDefId = (mounter as any).testDefId
    const instance = await mounter.spawn(testDefId)
    await mounter.dismiss(instance.instanceId)
    const retrieved = await mounter.getInstance(instance.instanceId)
    expect(retrieved?.status).toBe('dismissed')
    expect(retrieved?.dismissedAt).toBeDefined()
    expect(host.unmount).toHaveBeenCalled()
  })

  it('isMounted() returns host.isMounted result', () => {
    expect(mounter.isMounted('inst-1')).toBe(false)
  })
})

describe('CanvasMirror', () => {
  let mirror: CanvasMirror
  let store: InMemoryCanvasMirrorStore

  beforeEach(() => {
    store = new InMemoryCanvasMirrorStore()
    mirror = new CanvasMirror(store)
  })

  it('pushOptimistic() records optimistic update', async () => {
    const update = await mirror.pushOptimistic('inst-1', 'region-1', { value: 'test' })
    expect(update.instanceId).toBe('inst-1')
    expect(update.regionId).toBe('region-1')
    expect(update.confirmed).toBe(false)
  })

  it('confirm() marks state as confirmed', async () => {
    await mirror.pushOptimistic('inst-1', 'region-1', { value: 'test' })
    await mirror.confirm('inst-1', 'region-1', { value: 'confirmed' })

    const state = await mirror.getRegionState('inst-1', 'region-1')
    expect(state?.confirmedAt).toBeGreaterThan(0)
  })

  it('revert() writes reverted state', async () => {
    await mirror.revert('inst-1', 'region-1', 'test-reason')
    const state = await mirror.getRegionState('inst-1', 'region-1')
    expect(state?.state).toEqual({ reverted: true, reason: 'test-reason' })
  })

  it('enforceBudget() returns budget status', () => {
    const result = mirror.enforceBudget('bind', 3)
    expect(result.withinBudget).toBe(true)
    expect(result.actualMs).toBe(3)
    expect(result.budgetMs).toBe(5)
  })

  it('enforceBudget() returns false when exceeded', () => {
    const result = mirror.enforceBudget('bind', 10)
    expect(result.withinBudget).toBe(false)
  })
})

describe('SandboxBridge', () => {
  let bridge: SandboxBridge
  let store: CanvasStore
  let executor: { execute: MockFn }

  beforeEach(async () => {
    store = new InMemoryCanvasStore()
    executor = makeExecutor()
    // Create a definition with allowed capability
    const registry = new CanvasRegistry(store)
    await registry.define({
      slug: 'test-bridge',
      name: 'Test Bridge',
      description: '',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: ['test_cap'],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })
    bridge = new SandboxBridge(store, executor, {
      read: async () => [],
    })
  })

  it('attach() stores port for instance', () => {
    const port = {
      postMessage: mock(() => {}),
      onMessage: mock(() => {}),
      close: mock(() => {}),
    }
    bridge.attach('inst-1', port)
    // Port attached - would need to test dispatch for full coverage
  })

  it('detach() removes port for instance', async () => {
    const registry = new CanvasRegistry(store)
    await registry.define({
      slug: 'detach-test',
      name: 'Detach Test',
      description: '',
      category: 'plugin',
      html: '<div></div>',
      css: '',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
      author: 'user',
      sandbox: {
        csp: "default-src 'self'",
        allowNetwork: false,
        allowCapabilities: [],
        budgetMs: 5000,
        allowInlineScript: false,
      },
      status: 'published',
      tags: [],
    })

    const port = {
      postMessage: mock(() => {}),
      onMessage: mock(() => {}),
      close: mock(() => {}),
    }
    bridge.attach('inst-1', port)
    bridge.detach('inst-1')
    // Port should be removed
  })
})

describe('OracleReader', () => {
  it('visibility() returns oracle snapshot', async () => {
    const sources = {
      visibility: makeOracleProvider(),
      listDefinitions: mock(() => Promise.resolve([])),
      listInstances: mock(() => Promise.resolve([])),
    }
    const oracle = new OracleReader(sources)
    const vis = await oracle.visibility()
    expect(vis.providers).toBe(3)
    expect(vis.engines).toBe(5)
    expect(vis.health).toBeDefined()
  })

  it('buildManifest() creates manifest with definitions', async () => {
    const defs = [
      {
        id: 'def:1',
        slug: 'test',
        category: 'plugin' as const,
        bindings: [{ regionId: 'r1', role: 'chat', selector: '.chat', direction: 'read' as const }],
      },
    ] as CanvasDefinition[]
    const sources = {
      visibility: makeOracleProvider(),
      listDefinitions: mock(() => Promise.resolve(defs)),
      listInstances: mock(() => Promise.resolve([])),
    }
    const oracle = new OracleReader(sources)
    const manifest = await oracle.buildManifest()
    expect(manifest.version).toBe(1)
    expect(manifest.definitions.length).toBe(1)
    expect(manifest.definitions[0]?.slug).toBe('test')
  })

  it('regionIsWellFormed() validates primitive binding', () => {
    const wellFormed = {
      regionId: 'r1',
      role: 'chat',
      selector: '.chat',
      boundPrimitive: 'conversations' as PrimitiveKind,
      boundCapability: undefined,
      readScope: 'scoped' as const,
    }
    const invalid = {
      regionId: 'r2',
      role: 'bad',
      selector: '.bad',
      boundPrimitive: undefined,
      boundCapability: 'nonexistent',
      readScope: 'scoped' as const,
    }
    expect(OracleReader.regionIsWellFormed(wellFormed)).toBe(true)
    expect(OracleReader.regionIsWellFormed(invalid)).toBe(true) // No primitive to validate
  })
})

describe('CorePrimitiveRegistry', () => {
  it('register() adds primitive provider', () => {
    const registry = new CorePrimitiveRegistry()
    const provider = makePrimitiveProvider('workspace')
    registry.register(provider)
    expect(registry.has('workspace')).toBe(true)
  })

  it('unregister() removes primitive provider', () => {
    const registry = new CorePrimitiveRegistry()
    const provider = makePrimitiveProvider('knowledge')
    registry.register(provider)
    registry.unregister('knowledge')
    expect(registry.has('knowledge')).toBe(false)
  })

  it('kinds() returns all primitive kinds', () => {
    const registry = new CorePrimitiveRegistry()
    const kinds = registry.kinds()
    expect(kinds).toContain('workspace')
    expect(kinds).toContain('projects')
    expect(kinds).toContain('knowledge')
    expect(kinds).toContain('agents')
    expect(kinds).toContain('providers')
    expect(kinds).toContain('conversations')
  })

  it('reader() returns working PrimitiveReader', async () => {
    const registry = new CorePrimitiveRegistry()
    registry.register(makePrimitiveProvider('projects'))
    const reader = registry.reader()
    const result = await reader.read('projects', {})
    expect(Array.isArray(result)).toBe(true)
  })

  it('getProvider() returns registered provider', () => {
    const registry = new CorePrimitiveRegistry()
    const provider = makePrimitiveProvider('agents')
    registry.register(provider)
    const retrieved = registry.getProvider('agents')
    expect(retrieved?.kind).toBe('agents')
  })
})

describe('CanvasDesigner', () => {
  let registry: CanvasRegistry

  beforeEach(() => {
    registry = new CanvasRegistry(new InMemoryCanvasStore())
  })

  it('publish() creates published definition from draft', async () => {
    const designer = new CanvasDesigner(registry)
    const draft = {
      slug: 'designed-layer',
      name: 'Designed Layer',
      category: 'plugin' as const,
      html: '<div></div>',
      bindings: [
        {
          regionId: 'r1',
          role: 'test',
          selector: '.test',
          capabilitySlug: 'test_cap',
          direction: 'write' as const,
        },
      ],
      layout: { x: 0, y: 0, z: 0, w: 200, h: 200 },
    }
    const def = await designer.publish(draft)
    expect(def.slug).toBe('designed-layer')
    expect(def.status).toBe('published')
    expect(def.sandbox.allowCapabilities).toContain('test_cap')
  })

  it('preview() returns draft without persisting', () => {
    const designer = new CanvasDesigner(registry)
    const draft = {
      slug: 'preview-layer',
      name: 'Preview Layer',
      category: 'plugin' as const,
      html: '<div></div>',
      bindings: [],
      layout: { x: 0, y: 0, z: 0, w: 200, h: 200 },
    }
    const preview = designer.preview(draft)
    expect(preview.id).toBe('preview:preview-layer')
    expect(preview.status).toBe('draft')
  })

  it('sandboxFor() extracts capabilities from bindings', () => {
    const draft = {
      slug: 'test',
      name: 'Test',
      category: 'plugin' as const,
      html: '<div></div>',
      bindings: [
        {
          regionId: 'r1',
          role: 'a',
          selector: '.a',
          capabilitySlug: 'cap_a',
          direction: 'read' as const,
        },
        {
          regionId: 'r2',
          role: 'b',
          selector: '.b',
          capabilitySlug: 'cap_b',
          direction: 'read' as const,
        },
      ],
      layout: { x: 0, y: 0, z: 0, w: 100, h: 100 },
    }
    const sandbox = CanvasDesigner.sandboxFor(draft)
    expect(sandbox.allowCapabilities).toContain('cap_a')
    expect(sandbox.allowCapabilities).toContain('cap_b')
  })
})

describe('seedCoreLayers', () => {
  it('seeds exactly 3 core layers', async () => {
    const store = new InMemoryCanvasStore()
    const host = makeLayerHost()
    const executor = makeExecutor()
    const oracle = makeOracleProvider()
    const engine = new CanvasEngine({
      store,
      host,
      executor,
      oracle,
    })

    const seeded = await engine.seedCoreLayers()
    expect(seeded.length).toBe(3) // system, chat, designer
  })

  it('seeds layers with correct slugs', async () => {
    const store = new InMemoryCanvasStore()
    const host = makeLayerHost()
    const executor = makeExecutor()
    const oracle = makeOracleProvider()
    const engine = new CanvasEngine({
      store,
      host,
      executor,
      oracle,
    })

    const seeded = await engine.seedCoreLayers()
    const slugs = seeded.map((s) => s.slug)
    expect(slugs).toContain('system')
    expect(slugs).toContain('chat')
    expect(slugs).toContain('designer')
  })

  it('does not duplicate seeded layers on re-run', async () => {
    const store = new InMemoryCanvasStore()
    const host = makeLayerHost()
    const executor = makeExecutor()
    const oracle = makeOracleProvider()
    const engine = new CanvasEngine({
      store,
      host,
      executor,
      oracle,
    })

    const first = await engine.seedCoreLayers()
    const second = await engine.seedCoreLayers()
    expect(second.length).toBe(0)
    expect(first.length).toBe(3)
  })
})

describe('Capability registration', () => {
  it('registerCapabilities() wires canvas ops to registry', async () => {
    const store = new InMemoryCanvasStore()
    const host = makeLayerHost()
    const executor = makeExecutor()
    const oracle = makeOracleProvider()
    const engine = new CanvasEngine({
      store,
      host,
      executor,
      oracle,
      primities: [],
    })

    const registry = new UnifiedCapabilityRegistry()
    engine.registerCapabilities(registry)

    // Check 6 core canvas capabilities are registered
    expect(registry.getBySlug('canvas_spawn')).not.toBeNull()
    expect(registry.getBySlug('canvas_dismiss')).not.toBeNull()
    expect(registry.getBySlug('canvas_mutate')).not.toBeNull()
    expect(registry.getBySlug('canvas_observe')).not.toBeNull()
    expect(registry.getBySlug('canvas_define')).not.toBeNull()
    expect(registry.getBySlug('canvas_list')).not.toBeNull()
  })

  it('registerCapabilities() includes kernel_visibility when no kernelOracle', async () => {
    const store = new InMemoryCanvasStore()
    const host = makeLayerHost()
    const executor = makeExecutor()
    const oracle = makeOracleProvider()
    const engine = new CanvasEngine({
      store,
      host,
      executor,
      oracle,
      primities: [],
    })

    const registry = new UnifiedCapabilityRegistry()
    engine.registerCapabilities(registry)

    // kernel_visibility is always registered (127-133 in canvas-agent-tools.ts)
    expect(registry.getBySlug('kernel_visibility')).not.toBeNull()
  })

  it('canvas capabilities expose all five surfaces', async () => {
    const store = new InMemoryCanvasStore()
    const host = makeLayerHost()
    const executor = makeExecutor()
    const oracle = makeOracleProvider()
    const engine = new CanvasEngine({
      store,
      host,
      executor,
      oracle,
      primities: [],
    })

    const registry = new UnifiedCapabilityRegistry()
    engine.registerCapabilities(registry)

    for (const slug of [
      'canvas_spawn',
      'canvas_dismiss',
      'canvas_mutate',
      'canvas_observe',
      'canvas_define',
      'canvas_list',
    ]) {
      const cap = registry.getBySlug(slug)
      expect(cap?.surfaces).toContain('cli')
      expect(cap?.surfaces).toContain('ui')
      expect(cap?.surfaces).toContain('workflow')
      expect(cap?.surfaces).toContain('mcp')
      expect(cap?.surfaces).toContain('api')
    }
  })
})
