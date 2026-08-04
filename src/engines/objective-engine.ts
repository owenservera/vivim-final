// src/engines/objective-engine.ts
// ObjectiveEngine — durable cross-run intent (sleep / wake / re-plan).
//
// An objective is a cap-store.objective node with an agenda (task / wait_for_event
// / human_check / sleep_until / review). It survives across many runs; advances
// cursor by cursor; sleeps until a wake time; wakes to active.

import { AGENTIC_EDGE, type ActorRef, actorDid } from '../schema/agentic.js'
import type { AgenticStoreContract } from '../storage/contracts/agentic-store.js'
import { safeJsonParse } from '../lib/safe-json.js'

export class ObjectiveEngine {
  constructor(private readonly store: AgenticStoreContract) {}

  async putObjective(spec: {
    title: string
    description?: string
    goalJson?: Record<string, unknown>
    agenda?: Array<{
      id: string
      kind: 'task' | 'wait_for_event' | 'human_check' | 'sleep_until' | 'review'
      payloadJson?: Record<string, unknown>
    }>
    ownerActor: ActorRef
    parentObjectiveId?: string
    successCriteriaJson?: Record<string, unknown>
  }): Promise<{ id: string }> {
    return this.store.putObjective(spec)
  }

  /** Advance the agenda cursor, marking the previous item done. */
  async advance(objectiveId: string): Promise<{ current: string | null; done: boolean }> {
    return this.store.advanceAgenda(objectiveId)
  }

  async sleep(objectiveId: string, until: number): Promise<void> {
    await this.store.sleepObjective(objectiveId, until)
  }

  async wake(objectiveId: string): Promise<void> {
    await this.store.wakeObjective(objectiveId)
  }

  /** Link an agent to the objective it pursues (causal edge). */
  async pursue(agentId: string, objectiveId: string): Promise<void> {
    const agent = await this.store.nodes.getNode(agentId)
    if (!agent) return
    const edges = safeJsonParse(agent.edgesJson ?? '[]', [] as Array<{ type: string; targetId: string }>)
    edges.push({ type: AGENTIC_EDGE.PURSUES, targetId: objectiveId })
    await this.store.nodes.updateNode(agentId, {
      dataJson: agent.dataJson,
      edgesJson: JSON.stringify(edges),
    })
    void actorDid
  }
}
