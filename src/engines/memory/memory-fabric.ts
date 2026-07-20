// src/engines/memory/memory-fabric.ts
// MemoryFabric - host for the federated per-agent memory subsystem.
//
// On every agent spawn (AgentBuilderEngine.spawnFromBuilder / spawnChild) the
// fabric auto-provisions a per-agent subsystem: a cap-store.memory-agent scope
// Node + a MemoryOracle (mem:recall/consolidate/prune capabilities) bound to the
// run + a MemoryWarden (write-gating/quota/provenance).
//
// One-external-backend guard is per-fabric-instance (decision D3 / FR-009).
// provisionAgentMemory is idempotent (decision D12).

import { MemoryBackendLimitError, MemoryError } from '../../errors.js'
import { newId } from '../../ids.js'
import { createNode } from '../../schema/node.js'
import type { AgenticStoreContract } from '../../storage/contracts/agentic-store.js'
import type { KnowledgeExtractorStore } from '../../storage/contracts/knowledge-extractor-store.js'
import type { NodeStoreContract } from '../../storage/contracts/node-store.js'
import type { SemanticSearchStore } from '../../storage/contracts/semantic-search-store.js'
import type { BeliefStore } from '../belief-store.js'
import { makeCapability } from '../capability-bootstrap.js'
import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import type { MemoryBackend } from './memory-backend.js'
import { MemoryOracle, type MemoryOracleDeps } from './memory-oracle.js'
import { MemoryWarden, type MemoryWardenDeps } from './memory-warden.js'
import { NodeBackend, type NodeBackendDeps } from './node-backend.js'
import { StreamingContextScrubber } from './streaming-context-scrubber.js'

export interface MemoryFabricDeps {
  agenticStore: AgenticStoreContract
  registry: UnifiedCapabilityRegistry
  nodeStore: NodeStoreContract
  extractorStore: KnowledgeExtractorStore
  semanticStore: SemanticSearchStore
  beliefStore: BeliefStore
  /** Default per-agent write quota (0 = unlimited). */
  writeQuota?: number
}

interface Subsystem {
  agentId: string
  runId: string
  backend: MemoryBackend
  oracle: MemoryOracle
  warden: MemoryWarden
  parentAgentId?: string
}

export class MemoryFabric {
  private subsystems = new Map<string, Subsystem>()
  private externalBackend: MemoryBackend | null = null
  private scrubbers = new Map<string, StreamingContextScrubber>()

  constructor(private readonly deps: MemoryFabricDeps) {}

  /** Register an external memory backend; at most one per fabric (D3). */
  addBackend(backend: MemoryBackend): void {
    if (backend.name === 'node') {
      throw new MemoryError('node backend is built-in; do not register it')
    }
    if (this.externalBackend && this.externalBackend.name !== backend.name) {
      throw new MemoryBackendLimitError(this.externalBackend.name, backend.name)
    }
    this.externalBackend = backend
  }

  getExternalBackend(): MemoryBackend | null {
    return this.externalBackend
  }

  /** Idempotent provisioning (D12). Re-registering a live agent is a no-op. */
  async provisionAgentMemory(
    agentId: string,
    runId: string,
    parentAgentId?: string,
    opts: { memoryConfig?: 'auto' | 'none' } = {},
  ): Promise<Subsystem | null> {
    if (opts.memoryConfig === 'none') return null
    if (this.subsystems.has(agentId)) return this.subsystems.get(agentId) ?? null

    // Scope node for the subsystem itself.
    await this.deps.nodeStore.putNode(
      createNode(
        'cap-store.memory-agent',
        {
          agentId,
          runId,
          parentAgentId,
        },
        {
          id: newId(),
          version: 1,
          state: 'active',
          authorDid: agentId,
          acl: { sharingPolicy: 'agent', canView: true, canReshare: false },
          searchText: `memory subsystem ${agentId}`,
          conversationId: `agentMem:${agentId}`,
          meta: { ownerAgentId: agentId, scope: `agentMem:${agentId}` },
        },
      ),
    )

    const backendDeps: NodeBackendDeps = {
      nodeStore: this.deps.nodeStore,
      beliefStore: this.deps.beliefStore,
      extractorStore: this.deps.extractorStore,
      semanticStore: this.deps.semanticStore,
      curatedStore: this.curatedStoreShim(),
      writeQuota: this.deps.writeQuota,
    }
    const backend = new NodeBackend(backendDeps)
    backend.setAgent(agentId)
    backend.initialize(runId, {
      dataDir: '',
      profile: 'default',
      workspace: 'default',
      platform: 'cli',
      agentContext: 'primary',
    })

    const oracleDeps: MemoryOracleDeps = {
      nodeStore: this.deps.nodeStore,
      extractorStore: this.deps.extractorStore,
      semanticStore: this.deps.semanticStore,
    }
    const oracle = new MemoryOracle(agentId, oracleDeps)

    const wardenDeps: MemoryWardenDeps = {
      writeQuota: this.deps.writeQuota,
      mirrorToBelief: async (spec) => {
        await this.deps.beliefStore.putBelief({
          ownerKind: 'agent',
          ownerId: spec.ownerId,
          topic: spec.topic,
          claim: spec.claim,
          confidence: spec.confidence,
        })
      },
    }
    const warden = new MemoryWarden(agentId, wardenDeps)

    // Fork parent's memory if this is a sub-agent.
    if (parentAgentId) {
      await oracle.forkFrom(parentAgentId)
    }

    const subsystem: Subsystem = { agentId, runId, backend, oracle, warden, parentAgentId }
    this.subsystems.set(agentId, subsystem)

    // Register + bind per-agent capabilities.
    await this.registerOracleCapabilities(agentId, runId, oracle)
    return subsystem
  }

  private async registerOracleCapabilities(
    agentId: string,
    runId: string,
    oracle: MemoryOracle,
  ): Promise<void> {
    const caps: { id: string; slug: string; name: string; run: (args: any) => Promise<unknown> }[] =
      [
        {
          id: `cap:mem:recall:${agentId}`,
          slug: `mem_recall_${agentId}`,
          name: `Recall memory (${agentId})`,
          run: (args: { query: string; k?: number }) => oracle.recall(args.query, args.k ?? 5),
        },
        {
          id: `cap:mem:consolidate:${agentId}`,
          slug: `mem_consolidate_${agentId}`,
          name: `Consolidate memory (${agentId})`,
          run: (args: { userContent: string; assistantContent: string; sessionId: string }) =>
            oracle.consolidate(args),
        },
        {
          id: `cap:mem:prune:${agentId}`,
          slug: `mem_prune_${agentId}`,
          name: `Prune memory (${agentId})`,
          run: (args: { minValue?: number; expiredBefore?: number }) => oracle.prune(args),
        },
      ]
    for (const c of caps) {
      const surfaceId = c.slug.replace(/_/g, '-')
      const cap = makeCapability(
        {
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.name,
          category: 'memory',
          surfaces: ['cli', 'ui', 'workflow', 'mcp', 'api'],
          cliCommand: {
            name: `memory ${surfaceId}`,
            aliases: [c.slug],
            examples: [`memory ${surfaceId} --agent=${agentId}`],
          },
          mcpToolName: c.slug,
          apiEndpoint: { method: 'POST', path: `/api/memory/${c.slug}` },
          ui: { component: 'memory-action', position: 'chat.actionBar', order: 50 },
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
        },
        async (input: Record<string, unknown>) => c.run(input),
      )
      if (!this.deps.registry.get(c.id)) {
        this.deps.registry.register(cap)
      }
      await this.deps.agenticStore.bindCapability(c.id, runId).catch(() => undefined)
    }
  }

  /** Teardown a subsystem + unregister its capabilities (FR-011). */
  async dissolveAgentMemory(agentId: string): Promise<void> {
    const sub = this.subsystems.get(agentId)
    if (!sub) return
    for (const suffix of ['recall', 'consolidate', 'prune']) {
      this.deps.registry.unregister(`cap:mem:${suffix}:${agentId}`)
    }
    sub.backend.shutdown()
    this.scrubbers.delete(agentId)
    this.subsystems.delete(agentId)
  }

  getSubsystem(agentId: string): Subsystem | undefined {
    return this.subsystems.get(agentId)
  }

  /** Frozen cache-stable snapshot for context assembly (FR-005). */
  async snapshotForSession(agentId: string): Promise<string> {
    const sub = this.subsystems.get(agentId)
    if (!sub) return ''
    return sub.oracle.snapshot()
  }

  /** Selective inherit: promote child memories into parent's writable scope. */
  async inherit(parentAgentId: string, childAgentId: string, memoryIds: string[]): Promise<number> {
    const child = this.subsystems.get(childAgentId)
    if (!child) throw new MemoryError(`no subsystem for child ${childAgentId}`)
    return child.oracle.inherit(parentAgentId, memoryIds)
  }

  /**
   * Scrub a streamed delta for an agent, dropping <memory-context> spans so the
   * agent never sees its own injected memory echoed back (FR-004, decision D5).
   * Holds partial-tag state per agent across deltas.
   */
  scrubStreamingDelta(agentId: string, delta: string): string {
    let scrubber = this.scrubbers.get(agentId)
    if (!scrubber) {
      scrubber = new StreamingContextScrubber()
      this.scrubbers.set(agentId, scrubber)
    }
    return scrubber.feed(delta)
  }

  /** Reset a streaming scrubber (e.g. on new turn / context switch). */
  resetScrubber(agentId: string): void {
    this.scrubbers.delete(agentId)
  }

  /** In-memory curated store shim (NodeBackend lists pinned memories). */
  private curatedStoreShim() {
    const rows: {
      id: string
      memoryType: string
      memoryId: string
      isPinned: boolean
      isVerified: boolean
      note: string | null
    }[] = []
    return {
      upsert: async () => undefined,
      setPinned: async () => undefined,
      setVerified: async () => undefined,
      list: async () => rows,
    }
  }
}
