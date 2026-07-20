// tests/unit/engines/memory/node-backend.test.ts
// Unit tests for NodeBackend — builtin per-agent MemoryBackend (FR-008, FR-012,
// decision D11). Verifies non-blocking syncTurn, scoping fields, skill-scaffold
// skip, and shutdown drain.

import { afterEach, describe, expect, it } from 'bun:test'
import type { BeliefStore } from '../../../../src/engines/belief-store.js'
import { NodeBackend, type NodeBackendDeps } from '../../../../src/engines/memory/node-backend.js'
import type { KnowledgeExtractorStore } from '../../../../src/storage/contracts/knowledge-extractor-store.js'
import type { MemoryCuratedStore } from '../../../../src/storage/contracts/memory-curated-store.js'
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
}

function makeBackend() {
  const nodeStore = new FakeNodeStore() as any
  const curated: MemoryCuratedStore = {
    async upsert() {},
    async setPinned() {},
    async setVerified() {},
    async list() {
      return []
    },
  }
  const deps: NodeBackendDeps = {
    nodeStore,
    beliefStore: { async putBelief() {} } as unknown as BeliefStore,
    extractorStore: { async createDecision() {} } as unknown as KnowledgeExtractorStore,
    semanticStore: {
      async getEmbedding() {
        return null
      },
      async searchByEmbedding() {
        return []
      },
      async upsertEmbedding() {},
    } as unknown as SemanticSearchStore,
    curatedStore: curated,
  }
  const backend = new NodeBackend(deps)
  backend.setAgent('agentA')
  backend.initialize('runA', {
    dataDir: '',
    profile: 'default',
    workspace: 'default',
    platform: 'cli',
    agentContext: 'primary',
  })
  return { nodeStore, backend }
}

describe('NodeBackend', () => {
  it('syncTurn persists a scoped node with conversationId + searchText', async () => {
    const { nodeStore, backend } = makeBackend()
    await backend.syncTurn({
      userContent: 'remember this',
      assistantContent: 'done',
      sessionId: 's',
    })
    const rows = await nodeStore.listNodes({
      type: 'cap-store.memory',
      conversationId: 'agentMem:agentA',
    })
    expect(rows.length).toBe(1)
    expect(rows[0].meta.ownerAgentId).toBe('agentA')
    expect(rows[0].searchText).toContain('remember this')
    expect(rows[0].acl.sharingPolicy).toBe('agent')
  })

  it('syncTurn skips bare skill-scaffolding turns (FR-012)', async () => {
    const { nodeStore, backend } = makeBackend()
    await backend.syncTurn({
      userContent: '<skill_scaffolding>use tool X</skill_scaffolding>',
      assistantContent: '',
      sessionId: 's',
    })
    // Background queue resolves after drain; allow microtasks
    await backend.shutdown()
    expect(nodeStore.nodes.size).toBe(0)
  })

  it('shutdown drains the background queue', async () => {
    const { nodeStore, backend } = makeBackend()
    backend.syncTurn({ userContent: 'a', assistantContent: 'b', sessionId: 's' })
    backend.syncTurn({ userContent: 'c', assistantContent: 'd', sessionId: 's' })
    await backend.shutdown()
    expect(nodeStore.nodes.size).toBe(2)
  })

  it('exposes no tool schemas and rejects tool calls', () => {
    const { backend } = makeBackend()
    expect(backend.getToolSchemas()).toEqual([])
    expect(() => backend.handleToolCall('x', {})).toThrow()
  })
})

afterEach(async () => {
  // no-op; backends drained per-test
})
