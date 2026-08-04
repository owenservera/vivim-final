// src/engines/agent-builder.ts
// AgentBuilderEngine — agent construction subsystem (human_led + agent_led).
//
// A builder run is an AgentBuilderRun row; spawnFromBuilder emits a cap-store.agent
// + cap-store.agent_run (via the store). Agent-led recursion is triggered by an
// agent_step actionType='spawn', which calls spawnFromBuilder with an agent actor.

import { type ActorRef, actorDid } from '../schema/agentic.js'
import type { AgenticStoreContract } from '../storage/contracts/agentic-store.js'
import type { MemoryFabric } from './memory/memory-fabric.js'

export class AgentBuilderEngine {
  constructor(
    private readonly store: AgenticStoreContract,
    private readonly fabric?: MemoryFabric,
  ) {}

  async startBuilderRun(
    intent: Record<string, unknown>,
    mode: 'human_led' | 'agent_led',
    initiator: ActorRef,
  ): Promise<{ id: string }> {
    return this.store.startBuilderRun(intent, mode, initiator)
  }

  async spawnFromBuilder(builderRunId: string): Promise<{ agentId: string; runId: string }> {
    const { agentId, runId } = await this.store.spawnFromBuilder(builderRunId)
    // Auto-provision the per-agent memory subsystem (FR-001/FR-002).
    await this.fabric?.provisionAgentMemory(agentId, runId)
    return { agentId, runId }
  }

  /** Agent-led recursion: an agent step spawns a child builder run + agent. */
  async spawnChild(
    parentRunId: string,
    intent: Record<string, unknown>,
    spawningAgent: ActorRef,
  ): Promise<{ builderRunId: string; agentId: string; runId: string }> {
    const { id: builderRunId } = await this.store.startBuilderRun(
      intent,
      'agent_led',
      spawningAgent,
    )
    const { agentId, runId } = await this.store.spawnFromBuilder(builderRunId)
    // Auto-provision per-agent memory, forked from the spawning (parent) agent.
    await this.fabric?.provisionAgentMemory(agentId, runId, spawningAgent.id)
    // child run -> parent run edge (sub-agent tree)
    const parent = await this.store.nodes.getNode(parentRunId)
    if (parent) {
      const edges = JSON.parse(parent.edgesJson ?? '[]')
      edges.push({ type: 'child', targetId: runId })
      await this.store.nodes.updateNode(parentRunId, {
        dataJson: parent.dataJson,
        edgesJson: JSON.stringify(edges),
      })
    }
    void actorDid
    return { builderRunId, agentId, runId }
  }
}
