/**
 * shared/route-context.ts
 * --------------------------------------------------------------------
 * RouteContext (bundle 02 §B.1) + ResolvedSurface shapes. These are the
 * exact contract types the routeSync engine emits and routers serialize.
 */

import type { ResolutionTier } from './conceptual-model'
import type { Primitive } from './conceptual-model'
import type { UiComponent } from './ui-component'

export type PlanTier = 'anonymous' | 'free' | 'trial' | 'pro' | 'enterprise'

export const TIER_RANK: Record<PlanTier, number> = {
  anonymous: -1,
  free: 0,
  trial: 0,
  pro: 1,
  enterprise: 2,
}

/**
 * Normalized tier rank — mirrors backend capability-resolution.ts fix (H1+H3).
 * Lowercases + trims, fails CLOSED (Infinity) on unknown tier so gating denies.
 */
export function tierRank(tier: string): number {
  const normalized = tier.toLowerCase().trim() as PlanTier
  const rank = TIER_RANK[normalized]
  return rank ?? Number.POSITIVE_INFINITY
}

export interface AccountContext {
  accountId: string
  providerId: string
  planTier: PlanTier
}

export interface RouteContext {
  traceId: string
  workspaceId: string
  userId: string
  providerIds: string[]
  accounts: AccountContext[]
  slotIds: string[]
  variant?: string
}

export interface ResolvedAction {
  capabilityId: string
  label: string
  enabled: boolean
  tierOverride?: {
    maxFileSize?: number
    maxOptions?: number
    customConfig?: Record<string, unknown>
  }
}

export interface ResolvedSlot {
  providerId: string
  slotId: string
  primitive: Primitive
  component: UiComponent | null
  tier: ResolutionTier
  fromSystemDefault: boolean
  accountTier: PlanTier
  actions: ResolvedAction[]
}

export interface ResolvedSurface {
  traceId: string
  workspaceId: string
  slots: ResolvedSlot[]
  resolvedAt: number
  durationMs: number
}
