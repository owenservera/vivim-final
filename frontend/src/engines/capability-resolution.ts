/**
 * engines/capability-resolution.ts
 * --------------------------------------------------------------------
 * Tier-gating engine (bundle 04 capability-resolution.ts, simplified
 * to the surface we need). Wraps the routeSync.resolveActions helper
 * for callers that want a capability-centric API.
 */

import type { PlanTier, ResolvedAction } from '../shared/route-context';
import { resolveActions } from './route-sync';
import type { CapabilityTierStore } from '../storage/contracts/capability-tier-store';

export class CapabilityResolutionEngine {
  constructor(private store: CapabilityTierStore) {}

  async resolveActions(capabilityId: string, planTier: PlanTier): Promise<ResolvedAction[]> {
    return resolveActions(capabilityId, planTier, this.store);
  }
}
