// templates/capability-surface.tsx
// CONTRACT-INTERPRETER HOST — the reusable backbone of the frontend.
//
// Copy into: web/ui/src/features/capability-surface.tsx
//
// Fetches resolved capabilities for a surface, groups them by `uiPosition`
// into the five panel slots, and renders each capability with its bespoke
// renderer (if registered in CapabilityRegistry) or the GenericCapabilityRenderer.
// No per-capability routing — the contract decides placement.
//
// Mount in App.tsx inside CapStoreProvider:
//   <CapStoreProvider client={client}><CapabilitySurface surface="ui" /></CapStoreProvider>

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { CapabilityRegistry, type CapabilityRenderProps } from '../registry/index.js'
import { ActionRegistry } from '../actions/registry.js'
import { autoPopulateActions } from '../actions/auto-populate.js'
import { GenericCapabilityRenderer, type ResolvedCapability } from '../components/generic-capability-renderer.js'

const POSITIONS = ['composer', 'header', 'message', 'sidebar', 'inline'] as const
type Position = (typeof POSITIONS)[number]

interface SlotMap {
  composer: ResolvedCapability[]
  header: ResolvedCapability[]
  message: ResolvedCapability[]
  sidebar: ResolvedCapability[]
  inline: ResolvedCapability[]
}

function groupByPosition(caps: ResolvedCapability[]): SlotMap {
  const slots: SlotMap = { composer: [], header: [], message: [], sidebar: [], inline: [] }
  for (const c of caps) {
    const pos = (POSITIONS as readonly string[]).includes(c.uiPosition) ? c.uiPosition : 'inline'
    slots[pos as Position].push(c)
  }
  for (const key of POSITIONS) {
    slots[key].sort((a, b) => a.uiGroup.localeCompare(b.uiGroup) || a.uiOrder - b.uiOrder)
  }
  return slots
}

export interface CapabilitySurfaceProps {
  surface?: string
  providerId?: string
  conversationId?: string
  /** Override the action dispatcher (e.g. route through AgentBridge). */
  onAction?: (slug: string, params: Record<string, unknown>) => void
}

export function CapabilitySurface({ surface = 'ui', providerId, conversationId, onAction }: CapabilitySurfaceProps) {
  const [caps, setCaps] = useState<ResolvedCapability[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const dispatch = useMemo(
    () =>
      onAction ??
      ((slug: string, params: Record<string, unknown>) => {
        void ActionRegistry.dispatch(slug, params)
      }),
    [onAction],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // Keep the ActionRegistry in sync with the server (invariant B8 enabler).
    void autoPopulateActions('/api').catch(() => {})
    const qs = new URLSearchParams({ surface })
    if (providerId) qs.set('providerId', providerId)
    fetch(`/api/capabilities?${qs.toString()}`, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return
        const list = (Array.isArray(data) ? data : (data as { capabilities?: unknown[] }).capabilities ?? []) as ResolvedCapability[]
        setCaps(list)
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [surface, providerId, conversationId])

  const slots = useMemo(() => groupByPosition(caps), [caps])

  const renderCap = (cap: ResolvedCapability) => {
    const entry = CapabilityRegistry.get(cap.slug)
    const Comp: ComponentType<CapabilityRenderProps> | undefined = entry?.component
    const props: CapabilityRenderProps = { slug: cap.slug, contract: cap as unknown as Record<string, unknown>, onAction: dispatch }
    return Comp ? <Comp key={cap.id} {...props} /> : <GenericCapabilityRenderer key={cap.id} {...props} />
  }

  if (loading) return <div className="cap-surface cap-surface--loading">Loading capabilities…</div>
  if (error) return <div className="cap-surface cap-surface--error">{error.message}</div>

  return (
    <div className="cap-surface" data-surface={surface}>
      {POSITIONS.map((pos) => {
        const items = slots[pos]
        if (items.length === 0) return null
        return (
          <section key={pos} className={`cap-slot cap-slot--${pos}`} data-position={pos}>
            {items.map(renderCap)}
          </section>
        )
      })}
    </div>
  )
}
