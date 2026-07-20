// tests/unit/engines/memory/memory-oracle.test.ts
// Unit tests for MemoryOracle — recall / consolidate / prune / fork / inherit
// over the agent-scoped NodeStore (decision D11 / FR-003, FR-006, FR-007).

import { describe, expect, it } from 'bun:test'
import { MemoryOracle } from '../../../../src/engines/memory/memory-oracle.js'
import type { KnowledgeExtractorStore } from '../../../../src/storage/contracts/knowledge-extractor-store.js'
import type { NodeStoreContract } from '../../../../src/storage/contracts/node-store.js'
import type { SemanticSearchStore } from '../../../../src/storage/contracts/semantic-search-store.js'

class FakeNodeStore implements Partial<NodeStoreContract> {
  nodes = new Map<string, any>()
  async putNode(n: any) {
    this.nodes.set(n.id, {
      ...n,
      metaJson: JSON.stringify(n.meta ?? {}),
      dataJson: JSON.stringify(n.data),
      qualityJson: JSON.stringify(n.quality ?? {}),
      searchText: n.searchText ?? '',
      conversationId: n.conversationId ?? null,
      state: n.state,
      version: n.version,
      validUntil: n.validUntil ?? null,
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

const extractor = {
  async createDecision() {},
} as unknown as KnowledgeExtractorStore
const semantic = {
  async getEmbedding() {
    return null
  },
  async searchByEmbedding() {
    return []
  },
  async upsertEmbedding() {},
} as unknown as SemanticSearchStore

function makeOracle(agentId: string, sharedStore?: FakeNodeStore) {
  const nodeStore = (sharedStore ?? new FakeNodeStore()) as any
  const oracle = new MemoryOracle(agentId, {
    nodeStore,
    extractorStore: extractor,
    semanticStore: semantic,
  })
  return { nodeStore, oracle }
}

describe('MemoryOracle', () => {
  it('consolidate persists a scoped node with searchText + acl', async () => {
    const { nodeStore, oracle } = makeOracle('agentA')
    await oracle.consolidate({
      userContent: 'find the password',
      assistantContent: 'it is 123',
      sessionId: 's',
    })
    const rows = await nodeStore.listNodes({
      type: 'cap-store.memory',
      conversationId: 'agentMem:agentA',
    })
    expect(rows.length).toBe(1)
    expect(rows[0].searchText).toContain('find the password')
    expect(rows[0].meta.ownerAgentId).toBe('agentA')
    expect(rows[0].acl.sharingPolicy).toBe('agent')
  })

  it('recall returns agent-scoped text matches', async () => {
    const { oracle } = makeOracle('agentA')
    await oracle.consolidate({
      userContent: 'project neptune launches in Q3',
      assistantContent: 'ok',
      sessionId: 's',
    })
    const out = await oracle.recall('neptune')
    expect(out.some((t: string) => t.includes('neptune'))).toBe(true)
  })

  it('prune archives low-value / expired memories', async () => {
    const { nodeStore, oracle } = makeOracle('agentA')
    await oracle.consolidate({ userContent: 'keep me', assistantContent: 'ok', sessionId: 's' })
    const rows = await nodeStore.listNodes({
      type: 'cap-store.memory',
      conversationId: 'agentMem:agentA',
    })
    const id = rows[0].id
    // Force low quality
    await nodeStore.updateNode(id, { qualityJson: JSON.stringify({ overall: 0.1 }) })
    const removed = await oracle.prune({ minValue: 0.3 })
    expect(removed).toBe(1)
    const after = await nodeStore.getNode(id)
    expect(after.state).toBe('archived')
  })

  it('forkFrom clones parent memories into child scope (read-only copy)', async () => {
    const store = new FakeNodeStore()
    const parent = makeOracle('parent', store)
    await parent.oracle.consolidate({
      userContent: 'parent secret',
      assistantContent: 'x',
      sessionId: 's',
    })
    const child = makeOracle('child', store)
    const cloned = await child.oracle.forkFrom('parent')
    expect(cloned).toBe(1)
    const rows = await (child.nodeStore as any).listNodes({
      type: 'cap-store.memory',
      conversationId: 'agentMem:child',
    })
    expect(rows.length).toBe(1)
    expect(rows[0].meta.lineageKind).toBe('fork_of')
    expect(rows[0].meta.parentMemoryId).toBeTruthy()
  })

  it('inherit promotes chosen child memories into parent scope', async () => {
    const store = new FakeNodeStore()
    const parent = makeOracle('parent', store)
    const child = makeOracle('child', store)
    await child.oracle.consolidate({
      userContent: 'child insight',
      assistantContent: 'y',
      sessionId: 's',
    })
    const childRows = await (child.nodeStore as any).listNodes({
      type: 'cap-store.memory',
      conversationId: 'agentMem:child',
    })
    const promoted = await child.oracle.inherit('parent', [childRows[0].id])
    expect(promoted).toBe(1)
    const parentRows = await (parent.nodeStore as any).listNodes({
      type: 'cap-store.memory',
      conversationId: 'agentMem:parent',
    })
    expect(parentRows.length).toBe(1)
    expect(parentRows[0].meta.lineageKind).toBe('inherit_from')
  })

  it('snapshot returns cache-stable text block', async () => {
    const { oracle } = makeOracle('agentA')
    await oracle.consolidate({ userContent: 'alpha', assistantContent: 'a', sessionId: 's' })
    await oracle.consolidate({ userContent: 'beta', assistantContent: 'b', sessionId: 's' })
    const snap = await oracle.snapshot()
    expect(snap).toContain('alpha')
    expect(snap).toContain('beta')
  })
})
