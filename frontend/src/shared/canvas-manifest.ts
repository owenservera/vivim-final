/**
 * shared/canvas-manifest.ts
 * --------------------------------------------------------------------
 * Types for the canvas manifest — describes all registered canvas layers,
 * their regions, and current status. Used by minimap, layer panel, debug HUD.
 *
 * Harvested from hooks/use-manifest.ts (2026-07-26) — the hook had zero
 * consumers but these types are reusable for any canvas layer consumer.
 */

export interface CanvasLayer {
  id: string
  name: string
  kind: string
  status: 'active' | 'inactive' | 'error'
  regions: Array<{ id: string; name: string }>
}

export interface CanvasManifest {
  layers: CanvasLayer[]
  activeLayerId: string | null
  updatedAt: string
}
