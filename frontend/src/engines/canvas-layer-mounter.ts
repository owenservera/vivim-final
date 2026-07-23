/**
 * engines/canvas-layer-mounter.ts
 * --------------------------------------------------------------------
 * Thin lifecycle emitter (bundle 04 canvas-layer-mounter.ts, verbatim
 * in spirit). Emits `canvas:layer:spawned` / `canvas:layer:dismissed`
 * on the CapabilityEventBus so frontend useCanvasEvents can react live.
 *
 * Governor Canon: NO DOM, NO CDP. This engine only emits events.
 */

import type { CapabilityEventBus } from './capability-event-bus';

export interface LayerDefinition {
  id: string;
  slug: string;
  category: string;
  layout: { x: number; y: number; z: number; w: number; h: number };
  sandbox?: { allowCapabilities: string[] };
  traceId?: string;
}

export interface MountedLayer {
  instanceId: string;
  definitionId: string;
  slug: string;
}

let instanceCounter = 0;

export class CanvasLayerMounter {
  private mounted = new Map<string, MountedLayer>();

  constructor(private eventBus: CapabilityEventBus) {}

  async spawn(def: LayerDefinition): Promise<MountedLayer> {
    instanceCounter += 1;
    const instanceId = `inst:${def.slug}:${instanceCounter.toString(36)}`;
    const layer: MountedLayer = {
      instanceId,
      definitionId: def.id,
      slug: def.slug,
    };
    this.mounted.set(instanceId, layer);

    this.eventBus.emit({
      type: 'canvas:layer:spawned',
      instanceId,
      definitionId: def.id,
      slug: def.slug,
      category: def.category,
      layout: def.layout,
      sandbox: def.sandbox,
      traceId: def.traceId,
    });

    return layer;
  }

  async dismiss(instanceId: string): Promise<boolean> {
    const layer = this.mounted.get(instanceId);
    if (!layer) return false;
    this.mounted.delete(instanceId);
    this.eventBus.emit({ type: 'canvas:layer:dismissed', instanceId });
    return true;
  }

  listMounted(): MountedLayer[] {
    return [...this.mounted.values()];
  }
}
