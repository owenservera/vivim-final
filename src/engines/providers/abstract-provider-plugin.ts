// src/engines/providers/abstract-provider-plugin.ts
// Base implementation for ProviderPlugin with common functionality.
// WP-03: Provides sensible defaults so new providers only override what they need.

import type {
  HealthCheckResult,
  ProviderCapabilityDescriptor,
  ProviderMetadata,
  ProviderPlugin,
  ProviderPluginContext,
} from './provider-plugin-interface.js'

export abstract class AbstractProviderPlugin implements ProviderPlugin {
  protected capabilities: ProviderCapabilityDescriptor[] = []
  protected context?: ProviderPluginContext
  protected _healthStatus: HealthCheckResult = {
    status: 'unknown',
    checkedAt: 0,
    latencyMs: 0,
  }

  abstract readonly metadata: ProviderMetadata

  async init(context: ProviderPluginContext): Promise<void> {
    this.context = context
    // Subclasses override to perform custom initialization:
    // - register capabilities via this.registerCapability()
    // - subscribe to event bus events
    // - initialize network clients, etc.
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // Default: return the last-known status.
    // Subclasses override for real connectivity checks.
    return this._healthStatus
  }

  getCapabilities(): ProviderCapabilityDescriptor[] {
    return [...this.capabilities]
  }

  /**
   * Register a capability during init(). Delegates to the context so the
   * registry is also informed.
   */
  protected registerCapability(descriptor: ProviderCapabilityDescriptor): void {
    // Prevent duplicate registrations within the same plugin
    if (this.capabilities.some((c) => c.capabilityId === descriptor.capabilityId)) {
      return
    }
    this.capabilities.push(descriptor)
    this.context?.registerCapability(descriptor)
  }

  /**
   * Unregister a capability. Removes from local list and notifies context.
   */
  protected unregisterCapability(capabilityId: string): void {
    this.capabilities = this.capabilities.filter((c) => c.capabilityId !== capabilityId)
    this.context?.unregisterCapability(capabilityId)
  }

  /**
   * Update the cached health status. Subclasses should call this after
   * performing a real health check so subsequent calls to healthCheck()
   * return the latest result.
   */
  protected setHealthStatus(result: HealthCheckResult): void {
    this._healthStatus = result
  }

  abstract stop(): Promise<void>
}
