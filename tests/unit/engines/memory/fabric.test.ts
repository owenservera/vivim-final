// tests/unit/engines/memory/fabric.test.ts
// Unit tests for the federated per-agent memory subsystem:
// MemoryOracle (recall/consolidate/prune/fork/inherit), MemoryWarden
// (gating/quota/provenance), MemoryFabric (provision/dissolve/one-external/
// idempotent/isolation).

import { describe, expect, it } from 'bun:test'
import type { BeliefStore } from '../../../../src/engines/belief-store.js'
import { MemoryFabric } from '../../../../src/engines/memory/memory-fabric.js'
import { MemoryWarden } from '../../../../src/engines/memory/memory-warden.js'
import type { UnifiedCapabilityRegistry } from '../../../../src/engines/unified-registry.js'
import type { AgenticStoreContract } from '../../../../src/storage/contracts/agentic-store.js'
import type { KnowledgeExtractorStore } from '../../../../src/storage/contracts/knowledge-extractor-store.js'
import type { NodeStoreContract } from '../../../../src/storage/contracts/node-store.js'
import type { SemanticSearchStore } from '../../../../src/storage/contracts/semantic-search-store.js'

// ── In-memory fakes (store contracts) ───────────────────────────────────────

class FakeNodeStore implements Partial<NodeStoreContract> {
  nodes = new Map<string, any>()
  async putNode(n: any) {
    this.nodes.set(n.id, {
      ...n,
      metaJson: JSON.stringify(n.meta ?? {}),
      dataJson: JSON.stringify(n.data),
      qualityJson: JSON.stringify(n.quality ?? {}),
      searchText: n.searchText ?? JSON.stringify(n.data),
      conversationId: n.conversationId ?? null,
      validUntil: n.validUntil ?? null,
      version: n.version,
      state: n.state,
    })
  }
  async getNode(id: string) {
    return this.nodes.get(id) ?? null
  }
  async listNodes(opts: any) {
    return [...this.nodes.values()].filter(
      (n) =>
        (!opts?.type || n.type === opts.type) &&
        (!opts?.conversationId || n.conversationId === opts.conversationId),
    )
  }
  async updateNode(id: string, patch: any) {
    const n = this.nodes.get(id)
    if (n) Object.assign(n, patch)
  }
}

class FakeAgenticStore implements Partial<AgenticStoreContract> {
  bound: string[] = []
  async bindCapability(capId: string, _runId: string) {
    this.bound.push(capId)
  }
}

class FakeRegistry implements Partial<UnifiedCapabilityRegistry> {
  caps = new Map<string, any>()
  register(c: any) {
    this.caps.set(c.id, c)
  }
  unregister(id: string) {
    this.caps.delete(id)
  }
  get(id: string) {
    return this.caps.get(id) ?? null
  }
  getBySlug() {
    return null
  }
}

const fakeExtractor = {
  async createDecision() {},
  async createEntity() {},
  async createEntityMention() {},
  async createPattern() {},
} as unknown as KnowledgeExtractorStore
const fakeSemantic = {
  async getEmbedding() {
    return null
  },
  async searchByEmbedding() {
    return []
  },
  async upsertEmbedding() {},
} as unknown as SemanticSearchStore
const fakeBelief = {
  async putBelief() {
    return { id: 'b', version: 1 }
  },
} as unknown as BeliefStore

function makeFabric() {
  const nodeStore = new FakeNodeStore() as any
  const agenticStore = new FakeAgenticStore() as any
  const registry = new FakeRegistry() as any
  const fabric = new MemoryFabric({
    agenticStore,
    registry,
    nodeStore,
    extractorStore: fakeExtractor,
    semanticStore: fakeSemantic,
    beliefStore: fakeBelief,
  })
  return { fabric, nodeStore, agenticStore, registry }
}

describe('MemoryFabric', () => {
  it('provisions a per-agent subsystem and registers mem:* capabilities', async () => {
    const { fabric, agenticStore } = makeFabric()
    const sub = await fabric.provisionAgentMemory('agentA', 'runA')
    expect(sub).not.toBeNull()
    // 3 capabilities bound
    expect(agenticStore.bound).toContain('cap:mem:recall:agentA')
    expect(agenticStore.bound).toContain('cap:mem:consolidate:agentA')
    expect(agenticStore.bound).toContain('cap:mem:prune:agentA')
  })

  it('is idempotent (re-provision is a no-op)', async () => {
    const { fabric, agenticStore } = makeFabric()
    await fabric.provisionAgentMemory('agentA', 'runA')
    const before = agenticStore.bound.length
    await fabric.provisionAgentMemory('agentA', 'runA')
    expect(agenticStore.bound.length).toBe(before)
  })

  it('enforces one-external-backend guard per instance', () => {
    const { fabric } = makeFabric()
    const ext1: any = { name: 'mem0', isAvailable: () => true }
    const ext2: any = { name: 'hindsight', isAvailable: () => true }
    fabric.addBackend(ext1)
    expect(() => fabric.addBackend(ext2)).toThrow()
  })

  it('isolates memories between two agents', async () => {
    const { fabric, nodeStore } = makeFabric()
    await fabric.provisionAgentMemory('agentA', 'runA')
    await fabric.provisionAgentMemory('agentB', 'runB')
    const oa = fabric.getSubsystem('agentA')!.oracle
    const ob = fabric.getSubsystem('agentB')!.oracle
    await oa.consolidate({ userContent: 'secret A', assistantContent: 'reply A', sessionId: 's' })
    await ob.consolidate({ userContent: 'secret B', assistantContent: 'reply B', sessionId: 's' })
    const ra = await oa.recall('secret')
    const rb = await ob.recall('secret')
    expect(ra.some((t) => t.includes('secret A'))).toBe(true)
    expect(rb.some((t) => t.includes('secret B'))).toBe(true)
    expect(ra.some((t) => t.includes('secret B'))).toBe(false)
    expect(rb.some((t) => t.includes('secret A'))).toBe(false)
    void nodeStore
  })

  it('scopes memory nodes by conversationId (DB-layer isolation, FR-013)', async () => {
    const { fabric, nodeStore } = makeFabric()
    await fabric.provisionAgentMemory('agentA', 'runA')
    await fabric.provisionAgentMemory('agentB', 'runB')
    const oa = fabric.getSubsystem('agentA')!.oracle
    await oa.consolidate({ userContent: 'fact', assistantContent: 'r', sessionId: 's' })
    // The persisted node must carry conversationId = agentMem:agentA
    const scoped = await nodeStore.listNodes({
      type: 'cap-store.memory',
      conversationId: 'agentMem:agentA',
    })
    expect(scoped.length).toBe(1)
    expect(scoped[0].conversationId).toBe('agentMem:agentA')
    const bNodes = await nodeStore.listNodes({
      type: 'cap-store.memory',
      conversationId: 'agentMem:agentB',
    })
    expect(bNodes.length).toBe(0)
  })

  it('scrubs streaming deltas per-agent via the fabric scrubber', () => {
    const { fabric } = makeFabric()
    const d1 = fabric.scrubStreamingDelta('agentA', 'hi <memory-context>')
    const d2 = fabric.scrubStreamingDelta('agentA', 'SECRET</memory-context> tail')
    expect(d1).toBe('hi ')
    expect(d2).toContain('tail')
    expect(d2).not.toContain('SECRET')
  })

  it('forks parent memory into a sub-agent (frozen copy)', async () => {
    const { fabric } = makeFabric()
    await fabric.provisionAgentMemory('parent', 'runP')
    const op = fabric.getSubsystem('parent')!.oracle
    await op.consolidate({ userContent: 'parent fact', assistantContent: 'x', sessionId: 's' })
    const { agentId: child } = { agentId: 'child' }
    await fabric.provisionAgentMemory(child, 'runC', 'parent')
    const oc = fabric.getSubsystem(child)!.oracle
    const recalled = await oc.recall('parent fact')
    expect(recalled.some((t) => t.includes('parent fact'))).toBe(true)
  })

  it('dissolves a subsystem and unregisters capabilities', async () => {
    const { fabric, registry } = makeFabric()
    await fabric.provisionAgentMemory('agentA', 'runA')
    await fabric.dissolveAgentMemory('agentA')
    expect(fabric.getSubsystem('agentA')).toBeUndefined()
    expect(registry.caps.has('cap:mem:recall:agentA')).toBe(false)
  })
})

describe('MemoryWarden', () => {
  it('skips writes for non-primary execution context', () => {
    const w = new MemoryWarden('agentA', {})
    expect(w.gateWrite('content', { agentContext: 'subagent' })).toBeNull()
  })

  it('scrubs memory-context spans from streamed deltas', () => {
    const w = new MemoryWarden('agentA', {})
    const out = w.scrubStreaming('hello <memory-context>SECRET</memory-context> world')
    expect(out).toContain('hello')
    expect(out).toContain('world')
    expect(out).not.toContain('SECRET')
  })

  it('throws MemoryWardenQuotaError when quota breached', () => {
    const w = new MemoryWarden('agentA', { writeQuota: 1 })
    expect(w.gateWrite('a', { agentContext: 'primary' })).toBe('a')
    expect(() => w.gateWrite('b', { agentContext: 'primary' })).toThrow()
  })

  it('builds provenance metadata', () => {
    const w = new MemoryWarden('agentA', {})
    const p = w.buildProvenance('t', 'content', { sessionId: 's1' })
    expect(p.writeOrigin).toBe('memory-warden')
    expect(p.agentId).toBe('agentA')
    expect(p.contentHash).toMatch(/^h/)
  })
})
