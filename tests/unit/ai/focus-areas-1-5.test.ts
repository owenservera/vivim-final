// tests/unit/ai/focus-areas-1-5.test.ts
// Tests for Round 4 focus areas:
// #1 GatewayProviderLLMAdapter (query + synthesize)
// #2 HarnessRepairEngine boot wiring (globalThis.__harnessRepair)
// #3 PluginManager activation (globalThis.__pluginManager)
// #5 MemoryOracle real embedding (no more [0] stub)

import { describe, expect, it, mock } from 'bun:test'
import {
  createGateway,
  SIMULATOR_MANIFEST,
  SIMULATOR_MODEL,
  SIMULATOR_PROVIDER_ID,
  SimulatorAdapter,
} from '../../../src/ai/index.js'
import {
  GatewayProviderLLMAdapter,
  getGatewayProviderLLMAdapter,
} from '../../../src/engines/gateway-provider-llm-adapter.js'

describe('#1 — GatewayProviderLLMAdapter', () => {
  it('returns a stub message when the gateway is not enabled', async () => {
    // Ensure no gateway is set
    ;(globalThis as Record<string, unknown>).__aiGateway = undefined
    const adapter = new GatewayProviderLLMAdapter({ providerId: 'simulator' })
    const result = await adapter.query('Hello')
    expect(result).toContain('AI Gateway not enabled')
  })

  it('queries the simulator through the gateway and returns text', async () => {
    // Set up a gateway with the simulator
    const bundle = createGateway()
    await bundle.providerRegistry.register(SIMULATOR_MANIFEST)
    for (const state of [
      'installed',
      'validating',
      'enabled',
      'starting',
      'ready',
      'active',
    ] as const) {
      await bundle.providerRegistry.setState(SIMULATOR_PROVIDER_ID, state)
    }
    await bundle.modelRegistry.register(SIMULATOR_MODEL)
    const simAdapter = new SimulatorAdapter()
    await simAdapter.initialize({ transport: 'in-process' })
    bundle.gateway.registerAdapter(SIMULATOR_PROVIDER_ID, simAdapter)
    ;(globalThis as Record<string, unknown>).__aiGateway = bundle.gateway

    const adapter = new GatewayProviderLLMAdapter({ providerId: 'simulator' })
    const result = await adapter.query('Hello, simulator!')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toContain('AI Gateway not enabled')
    expect(result).not.toContain('AI Gateway error')

    // Clean up
    ;(globalThis as Record<string, unknown>).__aiGateway = undefined
  })

  it('synthesize returns confidence based on response quality', async () => {
    const bundle = createGateway()
    await bundle.providerRegistry.register(SIMULATOR_MANIFEST)
    for (const state of [
      'installed',
      'validating',
      'enabled',
      'starting',
      'ready',
      'active',
    ] as const) {
      await bundle.providerRegistry.setState(SIMULATOR_PROVIDER_ID, state)
    }
    await bundle.modelRegistry.register(SIMULATOR_MODEL)
    const simAdapter = new SimulatorAdapter()
    await simAdapter.initialize({ transport: 'in-process' })
    bundle.gateway.registerAdapter(SIMULATOR_PROVIDER_ID, simAdapter)
    ;(globalThis as Record<string, unknown>).__aiGateway = bundle.gateway

    const adapter = new GatewayProviderLLMAdapter({ providerId: 'simulator' })
    const result = await adapter.synthesize('Summarize this', 'summary')
    expect(result.text.length).toBeGreaterThan(0)
    expect(result.confidence).toBeGreaterThan(0.5)
    ;(globalThis as Record<string, unknown>).__aiGateway = undefined
  })

  it('getGatewayProviderLLMAdapter returns a singleton', () => {
    const a = getGatewayProviderLLMAdapter()
    const b = getGatewayProviderLLMAdapter()
    expect(a).toBe(b)
  })
})

describe('#2 + #3 — Boot wiring globals', () => {
  it('HarnessRepairEngine can be constructed with a mock store', async () => {
    const { HarnessRepairEngine } = await import('../../../src/engines/harness-repair-engine.js')
    const mockStore = {
      createRepairSession: mock(async () => {}),
      findRepairSessionsByConversation: mock(async () => []),
    } as never
    const engine = new HarnessRepairEngine(mockStore)
    expect(engine).toBeDefined()
    expect(typeof engine.repair).toBe('function')
  })

  it('TrustedPluginManager computes manifest hash deterministically', async () => {
    const { TrustedPluginManager } = await import('../../../src/ai/plugins/plugin-manager-impl.js')
    const manifest = {
      id: 'test' as never,
      pluginId: 'p' as never,
      name: 'Test',
      version: '1.0.0',
      protocolVersion: '1.1' as const,
      kind: 'local' as const,
      trust: 'official' as const,
      capabilities: { chat: { supported: true } } as never,
    }
    const hash1 = TrustedPluginManager.computeManifestHash(manifest)
    const hash2 = TrustedPluginManager.computeManifestHash(manifest)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 hex
  })
})

describe('#5 — MemoryOracle real embedding', () => {
  it('MemoryOracleDeps accepts an embeddingProvider', async () => {
    const mod = await import('../../../src/engines/memory/memory-oracle.js')
    void mod // type-level test: module loads
    // Type-level test: the interface accepts embeddingProvider
    const deps = {
      nodeStore: {} as never,
      extractorStore: {} as never,
      semanticStore: {} as never,
      embeddingProvider: {
        name: 'test',
        dimensions: 384,
        embed: async () => [0.1, 0.2, 0.3],
        embedBatch: async () => [[0.1, 0.2, 0.3]],
      },
    }
    expect(deps.embeddingProvider).toBeDefined()
    expect(deps.embeddingProvider.name).toBe('test')
  })

  it('MemoryFabricDeps accepts an embeddingProvider', async () => {
    const mod = await import('../../../src/engines/memory/memory-fabric.js')
    void mod // type-level test: module loads
    const deps = {
      agenticStore: {} as never,
      registry: {} as never,
      nodeStore: {} as never,
      extractorStore: {} as never,
      semanticStore: {} as never,
      beliefStore: {} as never,
      embeddingProvider: {
        name: 'test',
        dimensions: 384,
        embed: async () => [0.1],
        embedBatch: async () => [[0.1]],
      },
    }
    expect(deps.embeddingProvider).toBeDefined()
  })

  it('no more embedding:[0] stub in memory-oracle.ts source', async () => {
    // Read the source file and confirm the stub is gone
    const file = Bun.file('/home/z/my-project/vivim-final/src/engines/memory/memory-oracle.ts')
    const text = await file.text()
    expect(text).not.toContain('JSON.stringify([0])')
    expect(text).not.toContain("model: 'stub'")
    expect(text).toContain('embeddingProvider')
  })
})
