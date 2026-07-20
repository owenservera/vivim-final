// web/ui/src/features/canvas/useConceptualModel.ts
// Fetches a provider's conceptual surface (family + 4-tier resolved slots) from
// the backend and registers each resolved UiComponent into the global
// UIComponentRegistry (FRONTEND=BACKEND, data-driven hot-swaps). Exposes a
// `toNodes()` builder so CanvasSurface can render the family as canvas nodes
// instead of hardcoded chat seed nodes.

import { useCallback, useEffect, useState } from 'react'
import { registerUiComponent } from '../../ui/registry.js'
import type { UiComponentPayload } from '../../ui/ui-component-renderer.js'
import { isSlotId, SLOT_IDS, type SlotId } from '../../ui/slots.js'
import type { CanvasNode } from './CanvasSurface.js'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

/** A resolved slot as returned by GET /api/conceptual/surface. */
export interface SurfaceSlotDto {
  primitive: {
    id: string
    scope: string
    familyId: string | null
    providerId: string | null
    label: string
    description: string | null
    defaultRegion: { x: number; y: number; z: number; w: number; h: number } | null
    version: number
  }
  component: (UiComponentPayload & { id: string; scope: string; ownerId: string }) | null
  tier: 'provider' | 'family' | 'cross-type' | 'system'
  fromSystemDefault: boolean
}

export interface SurfaceDto {
  ok: boolean
  providerId: string
  family: string
  slots: SurfaceSlotDto[]
}

export interface ConceptualModelState {
  family: string | null
  slots: SurfaceSlotDto[]
  loading: boolean
  error: string | null
  /** Build canvas nodes from the resolved surface (family-driven, not hardcoded). */
  toNodes: () => CanvasNode[]
}

/**
 * Resolve a primitive id to a SlotId when it describes a known chat slot.
 * Primitives are namespaced (e.g. `ai-chat.entry`) but our slot catalog is
 * flat (`chat.entry`); we match on the sub-segment.
 */
function primitiveToSlotId(primitiveId: string): SlotId | null {
  const seg = primitiveId.includes('.') ? primitiveId.split('.').slice(1).join('.') : primitiveId
  const candidate = `chat.${seg}` as string
  return isSlotId(candidate) ? candidate : null
}

/** Default position for a node when the primitive carries no region hint. */
const SLOT_POSITIONS: Record<string, { x: number; y: number; z: number }> = {
  'chat.header': { x: 0, y: -60, z: 0 },
  'chat.sidebar': { x: -400, y: 0, z: 1 },
  'chat.entry': { x: 0, y: 0, z: 2 },
  'chat.thread': { x: 420, y: 0, z: 3 },
  'chat.composer': { x: 420, y: 400, z: 4 },
  'chat.actionBar': { x: 0, y: 600, z: 5 },
}

export function useConceptualModel(providerId: string): ConceptualModelState {
  const [family, setFamily] = useState<string | null>(null)
  const [slots, setSlots] = useState<SurfaceSlotDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!providerId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const resp = await fetch(
          `${BASE_URL}/api/conceptual/surface?providerId=${encodeURIComponent(providerId)}`,
          { headers: { 'X-Source': 'frontend' } },
        )
        if (!resp.ok) throw new Error(`Surface resolve failed: ${resp.status}`)
        const data = (await resp.json()) as SurfaceDto
        if (cancelled) return
        setFamily(data.family ?? null)

        // Hot-swap each resolved component into the registry under its slug.
        const fam = data.family ?? 'system'
        for (const slot of data.slots) {
          if (!slot.component) continue
          const slotId = primitiveToSlotId(slot.primitive.id)
          if (!slotId) continue
          registerUiComponent(slotId, fam, {
            componentKey: slot.component.componentKey,
            html: slot.component.html,
            css: slot.component.css,
            script: null,
          })
        }
        setSlots(data.slots)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [providerId])

  const toNodes = useCallback((): CanvasNode[] => {
    return slots.map((slot, idx) => {
      const slotId = primitiveToSlotId(slot.primitive.id)
      const type = slotId ?? 'conceptual'
      const region = slot.primitive.defaultRegion
      const pos = region
        ? { x: region.x, y: region.y }
        : { x: SLOT_POSITIONS[type]?.x ?? (idx % 3) * 420, y: SLOT_POSITIONS[type]?.y ?? Math.floor(idx / 3) * 400 }
      const z = region?.z ?? SLOT_POSITIONS[type]?.z ?? 0
      return {
        id: slot.primitive.id,
        type,
        position: pos,
        data: {
          overrideSlug: family ?? undefined,
          providerSlug: family ?? undefined,
          primitiveId: slot.primitive.id,
          slotId: slotId ?? undefined,
          componentKey: slot.component?.componentKey ?? undefined,
          fromSystemDefault: slot.fromSystemDefault,
          tier: slot.tier,
          z,
        },
      } as CanvasNode
    })
  }, [slots, family])

  return { family, slots, loading, error, toNodes }
}

// Re-export so consumers can extend nodeTypes with the conceptual type key.
export { SLOT_IDS }
