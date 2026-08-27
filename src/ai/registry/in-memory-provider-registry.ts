/**
 * VIVIM AI Gateway — In-Memory Provider Registry
 * @module ai/registry/in-memory-provider-registry
 *
 * Validates transitions against PROVIDER_TRANSITIONS. listAvailable() returns
 * providers in state 'active' or 'ready'.
 */

import { AI_ERRORS } from '../core/errors.js'
import type { ProviderId, ProviderManifest, ProviderState } from '../core/types.js'
import type { GatewayEvent, IEventBus } from '../events/bus.js'
import type { IProviderRegistry } from './registry.js'
import { canTransitionProvider } from './registry.js'

export class InMemoryProviderRegistry implements IProviderRegistry {
  private readonly providers = new Map<ProviderId, ProviderManifest>()
  private readonly states = new Map<ProviderId, ProviderState>()
  private readonly eventBus?: IEventBus

  constructor(eventBus?: IEventBus) {
    this.eventBus = eventBus
  }

  async register(provider: ProviderManifest): Promise<void> {
    this.providers.set(provider.id, provider)
    if (!this.states.has(provider.id)) {
      this.states.set(provider.id, 'discovered')
    }
  }

  async unregister(providerId: ProviderId): Promise<void> {
    // Force-stop if currently active-ish
    this.states.delete(providerId)
    this.providers.delete(providerId)
  }

  async get(providerId: ProviderId): Promise<ProviderManifest | undefined> {
    return this.providers.get(providerId)
  }

  async list(): Promise<readonly ProviderManifest[]> {
    return Array.from(this.providers.values())
  }

  async has(providerId: ProviderId): Promise<boolean> {
    return this.providers.has(providerId)
  }

  async setState(providerId: ProviderId, state: ProviderState): Promise<void> {
    const current = this.states.get(providerId)
    if (current === undefined) {
      throw AI_ERRORS.providerUnavailable(
        providerId,
        new Error(`Cannot set state on unregistered provider ${providerId}`),
      )
    }
    if (current === state) return
    if (!canTransitionProvider(current, state)) {
      throw new Error(`Illegal provider state transition for ${providerId}: ${current} → ${state}`)
    }
    this.states.set(providerId, state)
    // Publish event if bus is wired
    if (this.eventBus) {
      this.eventBus.publish({
        type: 'provider.state-changed',
        providerId,
        from: current,
        to: state,
        at: new Date().toISOString(),
      } as GatewayEvent)
    }
  }

  async getState(providerId: ProviderId): Promise<ProviderState | undefined> {
    return this.states.get(providerId)
  }

  async listAvailable(): Promise<readonly ProviderManifest[]> {
    const out: ProviderManifest[] = []
    for (const [id, manifest] of this.providers) {
      const state = this.states.get(id)
      if (state === 'active' || state === 'ready') {
        out.push(manifest)
      }
    }
    return out
  }
}
