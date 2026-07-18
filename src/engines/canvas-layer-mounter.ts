// src/engines/canvas-layer-mounter.ts
// CanvasLayerMounter — thin lifecycle emitter for the vivim-canvas shell (C7).
//
// The full Phase-03 canvas engine (3.1–3.13) is out of scope. This mounter is
// the minimal surface that bridges canvas layer spawn/dismiss to the
// CapabilityEventBus, so `useCanvasEvents` on the frontend can react live.
// The actual DOM/iframe mount is owned by the frontend SandboxedLayer; this
// engine only guarantees the EventBus contract is satisfied (Governor Canon:
// no CDP, no DOM — only events).

import type { CapabilityEventBus } from './capability-event-bus.js'

export interface LayerDefinition {
  id: string
  slug: string
  category: string
  layout: { x: number; y: number; z: number; w: number; h: number }
  sandbox?: { allowCapabilities: string[] }
}

export interface MountedLayer {
  instanceId: string
  definitionId: string
  slug: string
}

let instanceCounter = 0

export class CanvasLayerMounter {
  private mounted = new Map<string, MountedLayer>()

  constructor(private eventBus: CapabilityEventBus) {}

  /** Spawn a layer and emit `canvas:layer:spawned` for subscribed frontends. */
  async spawn(def: LayerDefinition): Promise<MountedLayer> {
    const instanceId = `inst:${def.slug}:${(++instanceCounter).toString(36)}`
    const layer: MountedLayer = {
      instanceId,
      definitionId: def.id,
      slug: def.slug,
    }
    this.mounted.set(instanceId, layer)

    this.eventBus.emit({
      type: 'canvas:layer:spawned',
      instanceId,
      definitionId: def.id,
      slug: def.slug,
      category: def.category,
      layout: def.layout,
      sandbox: def.sandbox,
    })

    return layer
  }

  /** Dismiss a layer and emit `canvas:layer:dismissed`. */
  async dismiss(instanceId: string): Promise<boolean> {
    const layer = this.mounted.get(instanceId)
    if (!layer) return false
    this.mounted.delete(instanceId)

    this.eventBus.emit({ type: 'canvas:layer:dismissed', instanceId })
    return true
  }

  listMounted(): MountedLayer[] {
    return [...this.mounted.values()]
  }
}
