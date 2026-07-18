// web/ui/src/features/canvas/useManifest.ts
// Generates and maintains a live CanvasManifest from current React Flow nodes (PRD-C7).
// The manifest updates whenever nodes change, providing oracle visibility.

import { useMemo } from 'react'
import type { CanvasNode } from './CanvasSurface.js'
import type { LayerCategory } from 'shared/canvas-types.js'

interface ManifestRegion {
  regionId: string
  role: string
  selector: string
  boundPrimitive?: string
  boundCapability?: string
  readScope: 'scoped' | 'oracle'
}

interface ManifestEntry {
  definitionId: string
  slug: string
  category: LayerCategory
  regions: ManifestRegion[]
}

export interface CanvasManifest {
  version: number
  generatedAt: number
  definitions: ManifestEntry[]
}

/**
 * Derive a live manifest from the current node state.
 * Recomputes only when nodes change (memoized).
 */
export function useManifest(nodes: CanvasNode[]): CanvasManifest {
  return useMemo(() => {
    const definitions: ManifestEntry[] = nodes.map((node) => ({
      definitionId: node.data.definitionId ?? node.id,
      slug: typeof node.type === 'string' ? node.type : node.id,
      category: (typeof node.type === 'string' ? node.type.split('.')[0] : 'chat') as LayerCategory,
      regions: [], // regions populated from node.data.bindings when available
    }))

    return {
      version: Date.now(),
      generatedAt: Date.now(),
      definitions,
    }
  }, [nodes])
}
