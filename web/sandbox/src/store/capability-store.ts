import { create } from 'zustand'
import { z } from 'zod'

export interface CapabilityUIContract {
  slug: string
  name: string
  description: string
  ui_component: string
  ui_position: string
  ui_group: string
  ui_order: number
  ui_state: string
  ui_states: Record<string, unknown>
  dependencies: string[]
  plan_tier: string
}

interface CapabilityState {
  capabilities: CapabilityUIContract[]
  selectedCapability: string | null
  loading: boolean
  error: string | null
  loadCapabilities: () => Promise<void>
  selectCapability: (slug: string | null) => void
  executeCapability: (slug: string) => Promise<void>
}

interface RawUiCapability {
  id: string
  slug: string
  name: string
  description: string
  ui?: {
    component?: string
    position?: string
    group?: string
    order?: number
    icon?: string
    shortcut?: string
    requiresConfirmation?: boolean
  }
  uiAction?: { component?: string }
  tags?: string[]
}

function mapToContract(cap: RawUiCapability): CapabilityUIContract {
  const uiComponent = cap.ui?.component ?? cap.uiAction?.component ?? cap.slug
  return {
    slug: cap.slug,
    name: cap.name,
    description: cap.description,
    ui_component: uiComponent,
    ui_position: cap.ui?.position ?? '—',
    ui_group: cap.ui?.group ?? '—',
    ui_order: cap.ui?.order ?? 0,
    ui_state: cap.ui?.icon ?? '',
    ui_states: {},
    dependencies: cap.tags ?? [],
    plan_tier: 'free',
  }
}

export const useCapabilityStore = create<CapabilityState>()((set, get) => ({
  capabilities: [],
  selectedCapability: null,
  loading: false,
  error: null,

  // Canonical frontend source: the unified registry's own `ui`-surface export.
  // Requires no provider to be present, so the catalog renders against the real
  // backend even before a slave is logged in (FRONTEND = BACKEND binding).
  loadCapabilities: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/capabilities?surface=ui')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const caps = (await res.json()) as RawUiCapability[]
      set({ capabilities: caps.map(mapToContract) })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      set({ loading: false })
    }
  },

  selectCapability: (slug) => set({ selectedCapability: slug }),

  executeCapability: async (slug: string) => {
    const { capabilities } = get()
    const capability = capabilities.find((c) => c.slug === slug)
    if (!capability) return

    try {
      const response = await fetch(`/api/capabilities/${encodeURIComponent(slug)}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: {} }),
      })
      const result = await response.json()
      console.log('Capability executed:', result)
    } catch (err) {
      console.error('Execute failed:', err)
    }
  },
}))