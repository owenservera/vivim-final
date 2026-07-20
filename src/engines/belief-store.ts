// src/engines/belief-store.ts
// BeliefStore — versioned, mutable world-model (distinct from FSRS memory).
//
// Each belief is a cap-store.agent_belief node. putBelief writes v1; update
// bumps the Node version (time-travelable via getNodeAtVersion). retract flips
// the `retracted` flag. getBeliefs returns the live set for an owner.

import { AGENTIC_EDGE } from '../schema/agentic.js'
import type { AgenticStoreContract } from '../storage/contracts/agentic-store.js'

export class BeliefStore {
  constructor(private readonly store: AgenticStoreContract) {}

  async putBelief(spec: {
    ownerKind: 'agent' | 'objective'
    ownerId: string
    topic: string
    claim: string
    confidence?: number
    evidenceNodeIds?: string[]
    sourceStepId?: string
  }): Promise<{ id: string; version: number }> {
    const { id, version } = await this.store.putBelief(spec)
    // owner -> belief edge
    const owner = await this.store.nodes.getNode(spec.ownerId)
    if (owner) {
      const edges = JSON.parse((owner as any).edgesJson ?? '[]')
      edges.push({ type: AGENTIC_EDGE.BELIEVES, targetId: id })
      await this.store.nodes.updateNode(spec.ownerId, {
        dataJson: (owner as any).dataJson,
        edgesJson: JSON.stringify(edges),
      } as never)
    }
    return { id, version }
  }

  async updateBelief(
    beliefId: string,
    patch: { claim?: string; confidence?: number; evidenceNodeIds?: string[] },
  ): Promise<number> {
    const b = await this.store.nodes.getNode(beliefId)
    if (!b) return 0
    const data = JSON.parse((b as any).dataJson)
    if (patch.claim != null) data.claim = patch.claim
    if (patch.confidence != null) data.confidence = patch.confidence
    if (patch.evidenceNodeIds != null) data.evidenceNodeIds = patch.evidenceNodeIds
    await this.store.nodes.updateNode(beliefId, { dataJson: JSON.stringify(data) } as never)
    const versions = await this.store.nodes.getNodeHistory(beliefId)
    return versions.length
  }

  async retract(beliefId: string): Promise<void> {
    await this.store.retractBelief(beliefId)
  }

  async getBeliefs(ownerKind: 'agent' | 'objective', ownerId: string): Promise<unknown[]> {
    return this.store.getBeliefs(ownerKind, ownerId)
  }

  async getLiveBeliefs(ownerKind: 'agent' | 'objective', ownerId: string): Promise<unknown[]> {
    const all = await this.store.getBeliefs(ownerKind, ownerId)
    return all.filter((b: any) => !b.retracted)
  }
}
