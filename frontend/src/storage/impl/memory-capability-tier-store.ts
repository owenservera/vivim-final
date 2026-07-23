/**
 * storage/impl/memory-capability-tier-store.ts
 */

import type { PlanTier } from '../../shared/route-context';
import type {
  CapabilityTaxonomyRow,
  CapabilityTierRow,
  CapabilityTierStore,
} from '../contracts/capability-tier-store';

export class MemoryCapabilityTierStore implements CapabilityTierStore {
  private taxonomies = new Map<string, CapabilityTaxonomyRow>();
  private tiers = new Map<string, CapabilityTierRow>(); // key: `${capabilityId}|${planTier}`

  async getTaxonomy(capabilityId: string): Promise<CapabilityTaxonomyRow | null> {
    return this.taxonomies.get(capabilityId) ?? null;
  }

  async getTier(capabilityId: string, planTier: PlanTier): Promise<CapabilityTierRow | null> {
    return this.tiers.get(`${capabilityId}|${planTier}`) ?? null;
  }

  async upsertTaxonomy(row: CapabilityTaxonomyRow): Promise<CapabilityTaxonomyRow> {
    this.taxonomies.set(row.id, row);
    return row;
  }

  async upsertTier(row: CapabilityTierRow): Promise<CapabilityTierRow> {
    this.tiers.set(`${row.capabilityId}|${row.planTier}`, row);
    return row;
  }

  async listTaxonomies(): Promise<CapabilityTaxonomyRow[]> {
    return [...this.taxonomies.values()];
  }
}
