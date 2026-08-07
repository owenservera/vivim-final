// src/engines/memory/node-backend.ts
// NodeBackend - the builtin MemoryBackend. Wraps vivim's Node-layer v2 store
// contracts, scoped per agent via conversationId = `agentMem:<agentId>`.
//
// Every memory artifact is a typed cap-store.memory.* Node. Isolation uses the
// existing ACU fields (decision D11) — no schema migration:
//   - conversationId = 'agentMem:<agentId>'
//   - aclJson = { ownerAgentId }
//   - acuType = 'cap-store.memory'

import { CapStoreError } from '../../errors.js'
import { newId } from '../../ids.js'
import { createNode } from '../../schema/node.js'
import type { KnowledgeExtractorStore } from '../../storage/contracts/knowledge-extractor-store.js'
import type { MemoryCuratedStore } from '../../storage/contracts/memory-curated-store.js'
import type { NodeStoreContract } from '../../storage/contracts/node-store.js'
import type { SemanticSearchStore } from '../../storage/contracts/semantic-search-store.js'
import type { BeliefStore } from '../belief-store.js'
import { BackgroundSyncQueue } from './background-sync.js'
import type {
  BackendInitContext,
  MemoryBackend,
  MemoryWriteMetadata,
  SyncTurnArgs,
  ToolSchema,
} from './memory-backend.js'
import { stripSkillScaffolding } from './skill-scaffolding.js'

export interface NodeBackendDeps {
  nodeStore: NodeStoreContract
  beliefStore: BeliefStore
  extractorStore: KnowledgeExtractorStore
  semanticStore: SemanticSearchStore
  curatedStore: MemoryCuratedStore
  /** Default per-agent write quota (0 = unlimited). */
  writeQuota?: number
}

export class NodeBackend implements MemoryBackend {
  readonly name = 'node'
  private agentId = ''
  private ctx: BackendInitContext | null = null
  private used = 0
  private sync = new BackgroundSyncQueue()

  constructor(private readonly deps: NodeBackendDeps) {}

  private scope(): string {
    return `agentMem:${this.agentId}`
  }

  isAvailable(): boolean {
    return true
  }

  initialize(_sessionId: string, ctx: BackendInitContext): void {
    this.ctx = ctx
    // agentId is carried on the backend via setAgent; ctx.profile scopes namespace
  }

  /** Fabric sets the owning agent before initialize. */
  setAgent(agentId: string): void {
    this.agentId = agentId
  }

  systemPromptBlock(): string {
    return ''
  }

  async prefetch(query: string): Promise<string> {
    const parts: string[] = []
    const pinned = await this.deps.curatedStore.list()
    for (const p of pinned) {
      if (p.memoryType.startsWith(this.scope())) parts.push(`[pinned] ${p.memoryId}`)
    }
    // Best-effort semantic recall: embedding is computed lazily by the semantic
    // engine; we attempt a recall via the agent-scoped node search text.
    const embedding = await this.deps.semanticStore
      .getEmbedding('cap-store.memory', this.agentId)
      .catch(() => null)
    if (embedding) {
      const hits = await this.deps.semanticStore.searchByEmbedding(
        JSON.parse(embedding.embedding, null as number[]) as number[],
        { entityType: 'cap-store.memory', limit: 5 },
      )
      for (const h of hits) parts.push(`[recall] ${h.entityId}`)
    }
    void query
    return parts.join('\n')
  }

  /** Persist a completed turn. Non-blocking: queued on the background FIFO. */
  async syncTurn(args: SyncTurnArgs): Promise<void> {
    // FR-012: recover real user instruction; skip bare skill-invocation turns.
    const instruction = stripSkillScaffolding(`${args.userContent}\n${args.assistantContent}`)
    if (instruction == null) return
    await this.sync.submit(async () => {
      await this.deps.nodeStore.putNode(
        createNode(
          'cap-store.memory',
          {
            user: args.userContent,
            assistant: args.assistantContent,
          },
          {
            id: newId(),
            version: 1,
            state: 'active',
            contentType: 'text/plain',
            authorDid: this.agentId,
            acl: { sharingPolicy: 'agent', canView: true, canReshare: false },
            quality: { overall: 0 },
            searchText: instruction,
            conversationId: this.scope(),
            meta: { ownerAgentId: this.agentId, scope: this.scope() },
          },
        ),
      )
      this.used++
    }, 'write')
  }

  getToolSchemas(): ToolSchema[] {
    return []
  }

  handleToolCall(_name: string, _args: Record<string, unknown>): never {
    throw new CapStoreError('ToolError', 'NodeBackend exposes no tools')
  }

  onMemoryWrite(
    _action: 'add' | 'replace' | 'remove',
    _target: string,
    _content: string,
    _metadata?: MemoryWriteMetadata,
  ): void {
    // builtin backend is the source of truth; no mirror needed
  }

  backupPaths(): string[] {
    return []
  }

  async shutdown(): Promise<void> {
    // Bounded: complete in-flight + queued writes, then stop accepting.
    await this.sync.flush()
    this.used = 0
  }
}
