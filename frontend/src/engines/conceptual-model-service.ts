/**
 * engines/conceptual-model-service.ts
 * --------------------------------------------------------------------
 * Resolution brain (bundle 04 conceptual-model-service.ts, adapted).
 * Exposes the surface-level resolveSurface used by the canvas router.
 * Internally delegates to the routeSync engine for the 6-level walk.
 */

import type { Primitive, ProviderType } from '../shared/conceptual-model';
import type { PlanTier, ResolvedSurface, RouteContext } from '../shared/route-context';
import type { AccountStore } from '../storage/contracts/account-store';
import type { CapabilityTierStore } from '../storage/contracts/capability-tier-store';
import type { PrimitiveStore } from '../storage/contracts/primitive-store';
import type { ProviderStore } from '../storage/contracts/provider-store';
import type { ProviderTypeStore } from '../storage/contracts/provider-type-store';
import type { UiComponentStore } from '../storage/contracts/ui-component-store';
import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import { routeSync, type RouteSyncDeps } from './route-sync';

export interface ResolvedSlot {
  primitive: Primitive;
  component: UiComponent | null;
  tier: 'provider' | 'family' | 'cross-type' | 'system';
  fromSystemDefault: boolean;
}

import type { UiComponent } from '../shared/ui-component';

export class ConceptualModelService {
  constructor(
    private providerTypes: ProviderTypeStore,
    private primitives: PrimitiveStore,
    private components: UiComponentStore,
    private providers?: ProviderStore,
  ) {}

  async resolveFamilyForProvider(providerId: string): Promise<ProviderType | null> {
    if (!this.providers) return null;
    const def = await this.providers.getDefinition(providerId);
    if (!def?.providerTypeId) return null;
    const row = await this.providerTypes.get(def.providerTypeId);
    return row ? this.providerTypes.toDomain(row) : null;
  }

  async listFamilies(): Promise<ProviderType[]> {
    const rows = await this.providerTypes.list();
    return rows.map((r) => this.providerTypes.toDomain(r));
  }

  async getFamilyBySlug(slug: string): Promise<ProviderType | null> {
    const row = await this.providerTypes.getBySlug(slug as Parameters<ProviderTypeStore['getBySlug']>[0]);
    return row ? this.providerTypes.toDomain(row) : null;
  }
}

/**
 * Build a RouteSyncDeps bag from individual stores. Used by the canvas
 * router to wire everything together with one call.
 */
export function buildRouteSyncDeps(args: {
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
  uiComponentStore: UiComponentStore;
  providerTypeStore: ProviderTypeStore;
  primitiveStore: PrimitiveStore;
  providerStore: ProviderStore;
  accountStore: AccountStore;
  capabilityTierStore: CapabilityTierStore;
}): RouteSyncDeps {
  return args;
}

export { routeSync };
export type { ResolvedSurface, RouteContext, PlanTier };
