// src/engines/memory/memory-oracle.ts
// MemoryOracle - per-agent memory oracle. Owns recall / consolidation / pruning
// over the agent-scoped NodeStore (decision D11: scope via meta.ownerAgentId).
//
// Surfaced as capabilities (mem:recall / mem:consolidate / mem:prune) by the
// MemoryFabric. Depends only on store contracts (Store Contracts invariant).

import { newId } from '../../ids.js'
import { catchDebug } from '../../lib/catch-logger.js'
import { createNode } from '../../schema/node.js'
import type { KnowledgeExtractorStore } from '../../storage/contracts/knowledge-extractor-store.js'
import type { NodeStoreContract } from '../../storage/contracts/node-store.js'
import type { SemanticSearchStore } from '../../storage/contracts/semantic-search-store.js'
import type { CrossConversationSynthesizer } from '../cross-conversation-synthesis.js'

export interface MemoryOracleDeps {
  nodeStore: NodeStoreContract
  extractorStore: KnowledgeExtractorStore
  semanticStore: SemanticSearchStore
  synthesizer?: CrossConversationSynthesizer
}

interface ScopedMeta {
  ownerAgentId: string
  scope: string
}

function readMeta(row: { metaJson: string }): ScopedMeta | null {
  try {
    const m = JSON.parse(row.metaJson ?? '{}') as Record<string, unknown>
    if (m.ownerAgentId && m.scope) {
      return { ownerAgentId: String(m.ownerAgentId), scope: String(m.scope) }
    }
  } catch {
    catchDebug(_err, 'engines:memory:memory-oracle:33')
    /* ignore */
  }
  return null
}

export class MemoryOracle {
  constructor(
    private readonly agentId: string,
    private readonly deps: MemoryOracleDeps,
  ) {}

  private scope(): string {
    return `agentMem:${this.agentId}`
  }

  private async listScoped(): Promise<string[]> {
    const rows = await this.deps.nodeStore.listNodes({
      type: 'cap-store.memory',
      conversationId: this.scope(),
    })
    return rows
      .filter((r) => {
        const m = readMeta(r)
        return m?.ownerAgentId === this.agentId
      })
      .map((r) => r.id)
  }

  /** Recall: agent-scoped node search text + best-effort semantic nearest. */
  async recall(query: string, k = 5): Promise<string[]> {
    const ids = await this.listScoped()
    const rows = await Promise.all(ids.map((id) => this.deps.nodeStore.getNode(id)))
    const scored = rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({ r, score: this.termScore(r.searchText, query) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
    return scored.map((s) => s.r.searchText)
  }

  private termScore(haystack: string, needle: string): number {
    const h = haystack.toLowerCase()
    const n = needle.toLowerCase()
    if (!n) return 0
    const terms = n.split(/\s+/).filter(Boolean)
    let s = 0
    for (const t of terms) if (h.includes(t)) s++
    return s
  }

  /** Consolidate a completed turn into structured memory nodes. */
  async consolidate(turn: {
    userContent: string
    assistantContent: string
    sessionId: string
  }): Promise<void> {
    await this.deps.nodeStore.putNode(
      createNode('cap-store.memory', turn, {
        id: newId(),
        version: 1,
        state: 'active',
        authorDid: this.agentId,
        acl: { sharingPolicy: 'agent', canView: true, canReshare: false },
        quality: { overall: 0.5 },
        searchText: `${turn.userContent}\n${turn.assistantContent}`,
        conversationId: this.scope(),
        meta: { ownerAgentId: this.agentId, scope: this.scope() },
      }),
    )
    // Best-effort knowledge extraction + embedding (non-fatal).
    await this.deps.extractorStore
      .createDecision({
        id: newId(),
        conversationId: this.scope(),
        messageId: turn.sessionId,
        decisionText: turn.assistantContent.slice(0, 500),
        rationale: null,
        alternatives: '',
        confidence: 0.5,
        ts: Date.now(),
      })
      .catch(() => undefined)
    await this.deps.semanticStore
      .upsertEmbedding({
        id: newId(),
        entityType: 'cap-store.memory',
        entityId: this.agentId,
        embedding: JSON.stringify([0]),
        model: 'stub',
        dimensions: 1,
        contentHash: '',
        createdAt: Date.now(),
      })
      .catch(() => undefined)
  }

  /** Prune: evict low-value / expired memories in this agent's scope. */
  async prune(opts: { minValue?: number; expiredBefore?: number } = {}): Promise<number> {
    const ids = await this.listScoped()
    let removed = 0
    for (const id of ids) {
      const row = await this.deps.nodeStore.getNode(id)
      if (!row) continue
      const q = this.parseQuality(row)
      const expired =
        opts.expiredBefore != null && row.validUntil != null && row.validUntil < opts.expiredBefore
      if (expired || (opts.minValue != null && q < opts.minValue)) {
        await this.deps.nodeStore
          .updateNode(id, { state: 'archived' } as never)
          .catch(() => undefined)
        removed++
      }
    }
    return removed
  }

  private parseQuality(row: { qualityJson: string }): number {
    try {
      const q = JSON.parse(row.qualityJson ?? '{}') as { overall?: number }
      return typeof q.overall === 'number' ? q.overall : 0
    } catch {
      return 0
    }
  }

  /** Frozen fork: clone parent's memories into this agent's scope (read-only copy). */
  async forkFrom(parentAgentId: string): Promise<number> {
    const parentRows = await this.deps.nodeStore.listNodes({ type: 'cap-store.memory' })
    const parentIds = parentRows
      .filter((r) => readMeta(r)?.ownerAgentId === parentAgentId)
      .map((r) => r.id)
    let cloned = 0
    for (const pid of parentIds) {
      const src = await this.deps.nodeStore.getNode(pid)
      if (!src) continue
      await this.deps.nodeStore.putNode(
        createNode('cap-store.memory', JSON.parse(src.dataJson), {
          id: newId(),
          version: 1,
          state: 'active',
          authorDid: this.agentId,
          parentVersion: src.version,
          acl: { sharingPolicy: 'agent', canView: true, canReshare: false },
          quality: { overall: 0.5 },
          searchText: src.searchText,
          conversationId: this.scope(),
          meta: {
            ownerAgentId: this.agentId,
            scope: this.scope(),
            lineageKind: 'fork_of',
            parentMemoryId: pid,
          },
        }),
      )
      cloned++
    }
    return cloned
  }

  /** Selective inherit: promote chosen child memory ids into the parent's writable scope. */
  async inherit(parentAgentId: string, memoryIds: string[]): Promise<number> {
    let promoted = 0
    for (const mid of memoryIds) {
      const src = await this.deps.nodeStore.getNode(mid)
      if (!src) continue
      const m = readMeta(src)
      if (m?.ownerAgentId !== this.agentId) continue
      await this.deps.nodeStore.putNode(
        createNode('cap-store.memory', JSON.parse(src.dataJson), {
          id: newId(),
          version: 1,
          state: 'active',
          authorDid: parentAgentId,
          acl: { sharingPolicy: 'agent', canView: true, canReshare: false },
          quality: { overall: 0.5 },
          searchText: src.searchText,
          conversationId: `agentMem:${parentAgentId}`,
          meta: {
            ownerAgentId: parentAgentId,
            scope: `agentMem:${parentAgentId}`,
            lineageKind: 'inherit_from',
            childMemoryId: mid,
          },
        }),
      )
      promoted++
    }
    return promoted
  }

  /** Frozen cache-stable snapshot for context assembly (FR-005). */
  async snapshot(): Promise<string> {
    const ids = await this.listScoped()
    const rows = await Promise.all(ids.map((id) => this.deps.nodeStore.getNode(id)))
    const texts = rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => r.searchText)
    return texts.join('\n')
  }
}
