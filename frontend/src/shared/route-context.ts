/**
 * shared/route-context.ts
 * --------------------------------------------------------------------
 * RouteContext (bundle 02 §B.1) + ResolvedSurface shapes. These are the
 * exact contract types the routeSync engine emits and routers serialize.
 */

import type { ResolutionTier } from './conceptual-model';
import type { UiComponent } from './ui-component';
import type { Primitive } from './conceptual-model';

export type PlanTier = 'anonymous' | 'free' | 'trial' | 'pro' | 'enterprise';

export const TIER_RANK: Record<PlanTier, number> = {
  anonymous: -1,
  free: 0,
  trial: 0,
  pro: 1,
  enterprise: 2,
};

export interface AccountContext {
  accountId: string;
  providerId: string;
  planTier: PlanTier;
}

export interface RouteContext {
  traceId: string;
  workspaceId: string;
  userId: string;
  providerIds: string[];
  accounts: AccountContext[];
  slotIds: string[];
  variant?: string;
}

export interface ResolvedAction {
  capabilityId: string;
  label: string;
  enabled: boolean;
  tierOverride?: { maxFileSize?: number; maxOptions?: number; customConfig?: Record<string, unknown> };
}

export interface ResolvedSlot {
  providerId: string;
  slotId: string;
  primitive: Primitive;
  component: UiComponent | null;
  tier: ResolutionTier;
  fromSystemDefault: boolean;
  accountTier: PlanTier;
  actions: ResolvedAction[];
}

export interface ResolvedSurface {
  traceId: string;
  workspaceId: string;
  slots: ResolvedSlot[];
  resolvedAt: number;
  durationMs: number;
}
