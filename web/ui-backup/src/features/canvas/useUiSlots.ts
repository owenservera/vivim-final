// web/ui/src/features/canvas/useUiSlots.ts
// Fetches capabilities from the backend and applies their uiSlots claims
// to the UIComponentRegistry. This is the frontend half of the
// FRONTEND=BACKEND invariant for data-driven slot overrides (PRD-C5).

import { useEffect, useState } from 'react'
import { applyClaim } from '../../ui/registry.js'
import { isSlotId, type SlotId } from '../../ui/slots.js'

interface UiSlotClaim {
  component?: string
  sandbox?: string[]
}

interface ResolvedCapability {
  slug: string
  uiSlots?: Record<string, UiSlotClaim>
}

interface UseUiSlotsResult {
  applied: number
  loading: boolean
  error: string | null
}

/**
 * Fetches capabilities from /api/capabilities and applies their uiSlots
 * claims to the registry. Runs once on mount; re-runs if conversationId changes.
 */
export function useUiSlots(conversationId?: string): UseUiSlotsResult {
  const [result, setResult] = useState<UseUiSlotsResult>({
    applied: 0,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function apply() {
      try {
        const url = conversationId
          ? `/api/conversations/${conversationId}/capabilities`
          : '/api/capabilities?surface=ui'
        const res = await fetch(url)
        if (!res.ok) {
          if (!cancelled) setResult({ applied: 0, loading: false, error: `HTTP ${res.status}` })
          return
        }
        const data = (await res.json()) as { capabilities?: ResolvedCapability[] }
        const capabilities = data.capabilities ?? []

        let count = 0
        for (const cap of capabilities) {
          if (!cap.uiSlots) continue
          for (const [slotId, claim] of Object.entries(cap.uiSlots)) {
            if (!isSlotId(slotId)) continue
            if (!claim.component) continue
            applyClaim(slotId as SlotId, cap.slug, { slot: slotId as SlotId, ...claim })
            count++
          }
        }

        if (!cancelled) setResult({ applied: count, loading: false, error: null })
      } catch (err) {
        if (!cancelled) setResult({ applied: 0, loading: false, error: String(err) })
      }
    }

    apply()
    return () => { cancelled = true }
  }, [conversationId])

  return result
}
