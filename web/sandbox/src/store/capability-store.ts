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

export const useCapabilityStore = create<CapabilityState>()((set, get) => ({
  capabilities: [],
  selectedCapability: null,
  loading: false,
  error: null,

  loadCapabilities: async () => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/providers')
      const providers = await response.json()
      if (providers.length > 0) {
        const capsResponse = await fetch(`/api/providers/${providers[0].id}/capabilities?planTier=free`)
        const resolved = await capsResponse.json()
        const capabilities = resolved.capabilities || []
        set({ capabilities })
      }
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
      // Will be wired to ActionRegistry.dispatch in Phase 1.5
      const response = await fetch(`/api/conversations/1/capabilities/${slug}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await response.json()
      console.log('Capability executed:', result)
    } catch (err) {
      console.error('Execute failed:', err)
    }
  },
}))