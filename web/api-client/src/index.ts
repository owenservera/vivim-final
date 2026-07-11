import { z } from 'zod'

export const CapabilityUIContractSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  ui_component: z.string(),
  ui_position: z.string(),
  ui_group: z.string(),
  ui_order: z.number(),
  ui_state: z.string(),
  ui_states: z.record(z.unknown()),
  dependencies: z.array(z.string()),
  plan_tier: z.string(),
})

export type CapabilityUIContract = z.infer<typeof CapabilityUIContractSchema>

export const ResolvedCapabilitiesSchema = z.object({
  capabilities: z.array(CapabilityUIContractSchema),
  providerId: z.string(),
  planTier: z.string(),
})

export type ResolvedCapabilities = z.infer<typeof ResolvedCapabilitiesSchema>

export const ProviderSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean(),
})

export type ProviderSummary = z.infer<typeof ProviderSummarySchema>

const API_BASE = '/api'

export const ApiClient = {
  async listProviders(): Promise<ProviderSummary[]> {
    const res = await fetch(`${API_BASE}/providers`)
    return ProviderSummarySchema.array().parse(await res.json())
  },

  async listCapabilities(providerId: string, planTier = 'free'): Promise<ResolvedCapabilities> {
    const res = await fetch(`${API_BASE}/providers/${providerId}/capabilities?planTier=${planTier}`)
    return ResolvedCapabilitiesSchema.parse(await res.json())
  },

  async conversationCapabilities(conversationId: string, planTier = 'free'): Promise<ResolvedCapabilities> {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/capabilities?planTier=${planTier}`)
    return ResolvedCapabilitiesSchema.parse(await res.json())
  },

  async createConversation(providerId: string, title?: string): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, title }),
    })
    return res.json()
  },

  async sendMessage(conversationId: string, message: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    return res.json()
  },
}