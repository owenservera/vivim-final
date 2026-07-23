/**
 * storage/contracts/capability-tier-store.ts
 * --------------------------------------------------------------------
 * CapabilityTier + CapabilityTaxonomy store (bundle 02 §B.4).
 * Used by CapabilityResolutionEngine to gate actions by `minPlanTier`
 * and apply per-tier overrides (maxFileSize, customConfig, etc.).
 */

import type { PlanTier } from '../../shared/route-context';

export interface CapabilityTaxonomyRow {
  id: string;
  slug: string;
  displayName: string;
  minPlanTier: PlanTier;
  baseActionsJson: string; // ResolvedAction[] (serialized)
}

export interface CapabilityTierRow {
  capabilityId: string;
  planTier: PlanTier;
  uiComponentOverride?: string;
  maxFileSize?: number;
  maxOptions?: number;
  customConfigJson?: string;
}

export interface CapabilityTierStore {
  getTaxonomy(capabilityId: string): Promise<CapabilityTaxonomyRow | null>;
  getTier(capabilityId: string, planTier: PlanTier): Promise<CapabilityTierRow | null>;
  upsertTaxonomy(row: CapabilityTaxonomyRow): Promise<CapabilityTaxonomyRow>;
  upsertTier(row: CapabilityTierRow): Promise<CapabilityTierRow>;
  listTaxonomies(): Promise<CapabilityTaxonomyRow[]>;
}
