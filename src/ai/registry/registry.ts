/**
 * VIVIM AI Gateway — Registry Contracts
 * @module ai/registry/registry
 *
 * doc2's registries were plain CRUD collections. For hot-swappable local
 * engines that's insufficient — removing a provider mid-request is a
 * distributed-systems problem even on one machine. This file adds an
 * explicit, validated state machine so "draining before unregistering"
 * is enforced by the registry itself rather than by caller discipline.
 */

import type {
  ModelDescriptor,
  ModelId,
  ProviderId,
  ProviderManifest,
  ProviderState,
} from '../core/types.js'

/** Mirrors execution/types.ts's transition-table pattern, applied to providers instead of executions. */
export const PROVIDER_TRANSITIONS: Readonly<Record<ProviderState, readonly ProviderState[]>> = {
  discovered: ['installed', 'failed'],
  installed: ['validating', 'failed'],
  validating: ['enabled', 'failed'],
  enabled: ['starting', 'disabled'],
  starting: ['ready', 'failed'],
  ready: ['active', 'degraded', 'draining', 'stopped'],
  active: ['degraded', 'unhealthy', 'draining'],
  degraded: ['active', 'unhealthy', 'draining'],
  unhealthy: ['degraded', 'draining', 'failed'],
  draining: ['stopped', 'failed'],
  disabled: ['enabled', 'stopped'],
  stopped: ['starting', 'discovered'],
  failed: ['discovered'],
}

export function canTransitionProvider(from: ProviderState, to: ProviderState): boolean {
  return PROVIDER_TRANSITIONS[from].includes(to)
}

export interface IProviderRegistry {
  register(provider: ProviderManifest): Promise<void>
  unregister(providerId: ProviderId): Promise<void>

  get(providerId: ProviderId): Promise<ProviderManifest | undefined>
  list(): Promise<readonly ProviderManifest[]>
  has(providerId: ProviderId): Promise<boolean>

  /** Throws if `to` is not a legal transition from the current state per PROVIDER_TRANSITIONS. */
  setState(providerId: ProviderId, state: ProviderState): Promise<void>
  getState(providerId: ProviderId): Promise<ProviderState | undefined>

  /** Providers currently eligible to receive new work (state === 'active' or 'ready', per implementation policy). */
  listAvailable(): Promise<readonly ProviderManifest[]>
}

export interface IModelRegistry {
  register(model: ModelDescriptor): Promise<void>
  unregister(modelId: ModelId): Promise<void>

  get(modelId: ModelId): Promise<ModelDescriptor | undefined>
  list(): Promise<readonly ModelDescriptor[]>
  listByProvider(providerId: ProviderId): Promise<readonly ModelDescriptor[]>
  has(modelId: ModelId): Promise<boolean>

  /** Removes every model belonging to a provider — called during unregister() so the registries can never disagree about what still exists. */
  unregisterByProvider(providerId: ProviderId): Promise<void>
}
