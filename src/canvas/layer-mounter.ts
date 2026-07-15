// src/canvas/layer-mounter.ts
// LayerMounter — the on-demand lifecycle (P3): spawn → mount → bind → live
// → dismiss. The shell is *dumb* (P2); the mounter only coordinates
// instance records and asks a `LayerHost` (the HTML shell) to mount/unmount.
// Binding to capabilities is performed by the SandboxBridge; this engine owns
// the lifecycle and releases DOM + bindings on dismiss.

import { CanvasSpawnError } from '../errors.js'
import { newId } from '../ids.js'
import type { CanvasStore } from '../storage/contracts/canvas-store.js'
import type { CanvasDefinition, LayerAuthor, LayerInstance } from './types.js'

/** The dumb shell surface the canvas mounts layers into (P2). */
export interface LayerHost {
  /** Mount a layer definition into the infinite plane. Returns a host node id. */
  mount(instanceId: string, def: CanvasDefinition): Promise<{ hostNodeId: string }>
  /** Unmount + release DOM for a dismissed instance. */
  unmount(instanceId: string): Promise<void>
  /** True if the host currently holds the instance in the DOM. */
  isMounted(instanceId: string): boolean
}

export interface SpawnOptions {
  spawnedBy?: LayerAuthor
  hostNodeId?: string
}

export class LayerMounter {
  constructor(
    private store: CanvasStore,
    private host: LayerHost,
    private registry: { get(id: string): Promise<CanvasDefinition | null> },
  ) {}

  /**
   * Spawn a layer instance on demand. The definition is fetched, an instance
   * record is written (mounting), the host mounts it, and it flips to live.
   * Nothing all-at-once: only requested layers instantiate (P3).
   */
  async spawn(definitionId: string, opts: SpawnOptions = {}): Promise<LayerInstance> {
    const def = await this.registry.get(definitionId)
    if (!def) {
      throw new CanvasSpawnError(`definition ${definitionId} not found`)
    }
    if (def.status === 'deprecated') {
      throw new CanvasSpawnError(`definition ${definitionId} is deprecated`)
    }
    const instanceId = `inst:${def.slug}:${newId()}`
    const hostNodeId = opts.hostNodeId ?? instanceId
    await this.store.createInstance({
      instanceId,
      definitionId: def.id,
      slug: def.slug,
      category: def.category,
      status: 'mounting',
      hostNodeId,
      bindingsActiveJson: JSON.stringify([]),
      spawnedBy: opts.spawnedBy ?? 'system',
      mountedAt: Date.now(),
    })
    try {
      await this.host.mount(instanceId, def)
    } catch (err) {
      await this.store.updateInstance(instanceId, { status: 'error' })
      throw new CanvasSpawnError(
        `mount failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    const live = await this.store.updateInstance(instanceId, { status: 'live' })
    return rowToInstance(live)
  }

  /** List live/mounting instances (what is currently instantiated). */
  async list(opts?: { status?: LayerInstance['status'] }): Promise<LayerInstance[]> {
    const rows = await this.store.listInstances(opts ? { status: opts.status } : undefined)
    return rows.map(rowToInstance)
  }

  getInstance(instanceId: string): Promise<LayerInstance | null> {
    return this.store.getInstance(instanceId).then((r) => (r ? rowToInstance(r) : null))
  }

  /**
   * Record that a binding came alive for the instance (called by the bridge
   * once a region capability/primitive channel is established).
   */
  async markBindingActive(instanceId: string, regionId: string): Promise<void> {
    const inst = await this.store.getInstance(instanceId)
    if (!inst) return
    const active: string[] = JSON.parse(inst.bindingsActiveJson)
    if (!active.includes(regionId)) {
      active.push(regionId)
      await this.store.updateInstance(instanceId, {
        bindingsActiveJson: JSON.stringify(active),
      })
    }
  }

  /**
   * Dismiss an instance: release DOM + bindings, keep the definition. The
   * canvas can *describe* a thousand layers while *instantiating* three (P3).
   */
  async dismiss(instanceId: string): Promise<void> {
    const inst = await this.store.getInstance(instanceId)
    if (!inst) return
    await this.host.unmount(instanceId)
    await this.store.updateInstance(instanceId, {
      status: 'dismissed',
      dismissedAt: Date.now(),
    })
  }

  /** True if the host currently holds the instance. */
  isMounted(instanceId: string): boolean {
    return this.host.isMounted(instanceId)
  }
}

export function rowToInstance(row: {
  instanceId: string
  definitionId: string
  slug: string
  category: string
  status: 'mounting' | 'live' | 'dismissed' | 'error'
  hostNodeId: string
  bindingsActiveJson: string
  spawnedBy: 'system' | 'user' | 'agent'
  mountedAt: number
  dismissedAt: number | null
}): LayerInstance {
  return {
    instanceId: row.instanceId,
    definitionId: row.definitionId,
    slug: row.slug,
    category: row.category as LayerInstance['category'],
    status: row.status,
    hostNodeId: row.hostNodeId,
    bindingsActive: JSON.parse(row.bindingsActiveJson) as string[],
    spawnedBy: row.spawnedBy,
    mountedAt: row.mountedAt,
    dismissedAt: row.dismissedAt ?? undefined,
  }
}
