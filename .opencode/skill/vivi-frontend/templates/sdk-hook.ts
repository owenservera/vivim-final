// templates/sdk-hook.ts
// SDK HOOK — useResolvedCapabilities(surface): fetches resolved capabilities and
// returns them grouped by ui_position (the five panel slots), ready for the host.
//
// Copy into: web/ui/src/sdk/use-resolved-capabilities.ts  (and export from sdk/index.ts)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCapStore } from './CapStoreProvider.js'
import type { ResolvedCapability } from '../components/generic-capability-renderer.js'

const POSITIONS = ['composer', 'header', 'message', 'sidebar', 'inline'] as const
type Position = (typeof POSITIONS)[number]

export interface ResolvedSlots {
  composer: ResolvedCapability[]
  header: ResolvedCapability[]
  message: ResolvedCapability[]
  sidebar: ResolvedCapability[]
  inline: ResolvedCapability[]
}

export interface UseResolvedCapabilities {
  slots: ResolvedSlots
  loading: boolean
  error: Error | null
  reload: () => void
}

function group(caps: ResolvedCapability[]): ResolvedSlots {
  const slots: ResolvedSlots = { composer: [], header: [], message: [], sidebar: [], inline: [] }
  for (const c of caps) {
    const pos = (POSITIONS as readonly string[]).includes(c.uiPosition) ? (c.uiPosition as Position) : 'inline'
    slots[pos].push(c)
  }
  for (const key of POSITIONS) slots[key].sort((a, b) => a.uiGroup.localeCompare(b.uiGroup) || a.uiOrder - b.uiOrder)
  return slots
}

export function useResolvedCapabilities(surface = 'ui'): UseResolvedCapabilities {
  const sdk = useCapStore()
  const [caps, setCaps] = useState<ResolvedCapability[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    sdk
      .capabilities(surface)
      .then((data) => setCaps(data as ResolvedCapability[]))
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [sdk, surface])

  useEffect(() => {
    reload()
  }, [reload])

  const slots = useMemo(() => group(caps), [caps])
  return { slots, loading, error, reload }
}
