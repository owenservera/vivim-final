/**
 * shared/z-layer.ts
 * --------------------------------------------------------------------
 * E2 — Configurable Z layers.
 *
 * 6 canonical layers (depth stacks):
 *   background (z=-100)  base (z=0)  content (z=10)
 *   overlay (z=50)  modal (z=100)  cursor (z=1000)
 *
 * Each workspace can override layer visibility, opacity, and depth.
 * The canvas shell reads layer config from routeSyncWorkspace output
 * (data-driven, P2 invariant).
 */

export type ZLayerId = 'background' | 'base' | 'content' | 'overlay' | 'modal' | 'cursor'

export const Z_LAYER_DEFAULTS: Record<
  ZLayerId,
  { depth: number; label: string; icon: string; defaultVisible: boolean }
> = {
  background: { depth: -100, label: 'Background', icon: '', defaultVisible: true },
  base: { depth: 0, label: 'Base', icon: '⬜', defaultVisible: true },
  content: { depth: 10, label: 'Content', icon: '', defaultVisible: true },
  overlay: { depth: 50, label: 'Overlay', icon: '', defaultVisible: true },
  modal: { depth: 100, label: 'Modal', icon: 'layers', defaultVisible: true },
  cursor: { depth: 1000, label: 'Cursor', icon: 'arrow-right', defaultVisible: true },
}

export interface ZLayerConfig {
  id: ZLayerId
  /** Depth (z-index base for this layer). */
  depth: number
  /** Whether the layer is visible. */
  visible: boolean
  /** Opacity 0..1. */
  opacity: number
  /** Whether the layer is locked (no interactions). */
  locked: boolean
  /** Whether the layer is shown in the panel. */
  shown: boolean
  /** Custom label (overrides default). */
  label?: string
}

export interface WorkspaceZLayerConfig {
  workspaceId: string
  layers: Record<ZLayerId, ZLayerConfig>
  /** Active layer (new nodes default to this). */
  activeLayer: ZLayerId
  updatedAt: number
}

/** Build a default layer config for a workspace. */
export function defaultZLayerConfig(workspaceId: string): WorkspaceZLayerConfig {
  const layers = {} as Record<ZLayerId, ZLayerConfig>
  for (const [id, def] of Object.entries(Z_LAYER_DEFAULTS)) {
    layers[id as ZLayerId] = {
      id: id as ZLayerId,
      depth: def.depth,
      visible: def.defaultVisible,
      opacity: 1,
      locked: false,
      shown: true,
    }
  }
  return { workspaceId, layers, activeLayer: 'content', updatedAt: Date.now() }
}

/** Resolve a node's effective z-index from its layer + relative depth. */
export function resolveZIndex(layer: ZLayerId, relativeDepth = 0): number {
  return Z_LAYER_DEFAULTS[layer].depth + relativeDepth
}
