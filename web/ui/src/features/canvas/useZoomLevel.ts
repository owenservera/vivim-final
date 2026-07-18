// web/ui/src/features/canvas/useZoomLevel.ts
// Subscribes to React Flow's internal store to track the current zoom level.
// Used by nodes to decide whether to render as dot / title card / full content.

import { useStore } from '@xyflow/react'

export type ZoomTier = 'dot' | 'card' | 'full'

/** Zoom thresholds from PRD-C2 §3.3. */
const DOT_THRESHOLD = 0.3
const CARD_THRESHOLD = 0.8

function classifyZoom(zoom: number): ZoomTier {
  if (zoom < DOT_THRESHOLD) return 'dot'
  if (zoom < CARD_THRESHOLD) return 'card'
  return 'full'
}

/**
 * Returns the current zoom tier. Re-renders only when the tier changes
 * (not on every zoom pixel), keeping high-frequency pan/zoom cheap.
 */
export function useZoomTier(): ZoomTier {
  const zoom = useStore((s) => s.transform[2])
  return classifyZoom(zoom)
}

/**
 * Returns the raw zoom value for components that need precise thresholds.
 */
export function useZoom(): number {
  return useStore((s) => s.transform[2])
}
