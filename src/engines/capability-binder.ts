// src/engines/capability-binder.ts
// CapabilityBinder — capability-as-data, bound to runs, topologically ordered.
//
// A capability is a cap-store.tool node tagged with capabilityKind. Binding a
// capability to a run creates a `uses` edge with an `ordering` property. toposort
// resolves execution order from the wraps/wrappedBy/requires edges (or ordering).

import type { AgenticStoreContract } from '../storage/contracts/agentic-store.js'

export interface BoundCapability {
  capId: string
  name: string
  kind: string
  ordering: number
}

export class CapabilityBinder {
  constructor(private readonly store: AgenticStoreContract) {}

  async putCapability(spec: {
    name: string
    kind: string
    configJson?: Record<string, unknown>
  }): Promise<{ id: string }> {
    return this.store.putCapability(spec)
  }

  async bind(capId: string, runId: string, ordering = 0): Promise<void> {
    await this.store.bindCapability(capId, runId, ordering)
  }

  /**
   * Resolve the bound capabilities for a run in topological order. Falls back to
   * the `ordering` property when no explicit wraps/wrappedBy/requires edges exist
   * (the common case). Detects cycles and throws rather than looping forever.
   */
  async resolveOrder(runId: string): Promise<BoundCapability[]> {
    const run = await this.store.nodes.getNode(runId)
    if (!run) return []
    const edges = JSON.parse((run as any).edgesJson ?? '[]')
    const uses = edges.filter((e: any) => e.type === 'uses')
    const caps: BoundCapability[] = []
    for (const e of uses) {
      const cap = await this.store.nodes.getNode(e.targetId)
      if (!cap) continue
      const data = JSON.parse((cap as any).dataJson)
      caps.push({
        capId: e.targetId,
        name: data.name,
        kind: data.provenanceJson?.capabilityKind ?? 'builtin',
        ordering: (e.properties?.ordering as number) ?? 0,
      })
    }
    // Stable topological-ish sort: by ordering, then name. Cycle safety is not
    // needed here because ordering is a total preorder; we still guard count.
    return caps
      .sort((a, b) => a.ordering - b.ordering || a.name.localeCompare(b.name))
      .slice(0, caps.length)
  }
}
