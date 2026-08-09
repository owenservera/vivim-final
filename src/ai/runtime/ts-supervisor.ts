/**
 * VIVIM AI Gateway — TS-Layer Runtime Supervisor
 * @module ai/runtime/ts-supervisor
 *
 * TypeScript-only IRuntimeSupervisor. Delegates to existing TS-layer
 * supervisors (OpenCodeSupervisor, etc.) for local providers. For remote
 * providers, returns a static ProviderConnection.
 *
 * NO Rust / Tauri boundary — everything is TS. Process spawning uses Bun.spawn
 * via the existing supervisor implementations.
 */

import type { ProviderHealth, ProviderId, ProviderState } from '../core/types.js'
import type { ProviderConnection } from '../protocol/adapter.js'
import type { IResourceManager } from './resources.js'
import type { IRuntimeSupervisor } from './supervisor.js'

/** A supervisor delegate that knows how to start/stop one specific provider. */
export interface ISupervisorDelegate {
  readonly providerId: ProviderId
  start(): Promise<ProviderConnection>
  stop(graceful?: boolean): Promise<void>
  restart(): Promise<ProviderConnection>
  getHealth(): Promise<ProviderHealth>
  getState(): Promise<ProviderState>
}

export class TSRuntimeSupervisor implements IRuntimeSupervisor {
  private readonly delegates = new Map<ProviderId, ISupervisorDelegate>()
  private readonly connections = new Map<ProviderId, ProviderConnection>()
  private readonly resourceManager: IResourceManager

  constructor(resourceManager: IResourceManager) {
    this.resourceManager = resourceManager
  }

  /** The read-only resource monitor view (for the Router). */
  get resources(): IResourceManager {
    return this.resourceManager
  }

  /** Register a delegate for a specific provider. */
  registerDelegate(delegate: ISupervisorDelegate): void {
    this.delegates.set(delegate.providerId, delegate)
  }

  /** Unregister a delegate. */
  unregisterDelegate(providerId: ProviderId): void {
    this.delegates.delete(providerId)
    this.connections.delete(providerId)
  }

  async startProvider(providerId: ProviderId): Promise<ProviderConnection> {
    const delegate = this.delegates.get(providerId)
    if (!delegate) {
      // For remote providers with no delegate, return a placeholder connection
      // (the adapter will supply the actual baseUrl)
      const placeholder: ProviderConnection = { transport: 'http' }
      this.connections.set(providerId, placeholder)
      return placeholder
    }
    const connection = await delegate.start()
    this.connections.set(providerId, connection)
    return connection
  }

  async stopProvider(providerId: ProviderId, graceful?: boolean): Promise<void> {
    const delegate = this.delegates.get(providerId)
    if (delegate) {
      await delegate.stop(graceful)
    }
    this.connections.delete(providerId)
    // Release all resources held by this provider
    await this.resourceManager.releaseAllForProvider(providerId)
  }

  async restartProvider(providerId: ProviderId): Promise<ProviderConnection> {
    const delegate = this.delegates.get(providerId)
    if (!delegate) {
      // For remote providers, just return the cached connection
      return this.connections.get(providerId) ?? { transport: 'http' }
    }
    const connection = await delegate.restart()
    this.connections.set(providerId, connection)
    return connection
  }

  async getHealth(providerId: ProviderId): Promise<ProviderHealth> {
    const delegate = this.delegates.get(providerId)
    if (!delegate) {
      return {
        status: 'unknown',
        state: 'discovered',
        checkedAt: new Date().toISOString(),
        message: 'No supervisor delegate registered',
      }
    }
    return delegate.getHealth()
  }

  async getState(providerId: ProviderId): Promise<ProviderState> {
    const delegate = this.delegates.get(providerId)
    if (!delegate) {
      return 'discovered'
    }
    return delegate.getState()
  }

  /** Get the cached connection for a provider (if started). */
  getConnection(providerId: ProviderId): ProviderConnection | undefined {
    return this.connections.get(providerId)
  }
}

/**
 * A no-op delegate for remote providers (cloud APIs). The adapter handles
 * HTTP directly; the supervisor just tracks lifecycle state.
 */
export class RemoteProviderDelegate implements ISupervisorDelegate {
  private state: ProviderState = 'discovered'
  private readonly connection: ProviderConnection

  constructor(
    readonly providerId: ProviderId,
    baseUrl: string,
  ) {
    this.connection = { transport: 'http', baseUrl }
  }

  async start(): Promise<ProviderConnection> {
    this.state = 'ready'
    return this.connection
  }
  async stop(): Promise<void> {
    this.state = 'stopped'
  }
  async restart(): Promise<ProviderConnection> {
    this.state = 'ready'
    return this.connection
  }
  async getHealth(): Promise<ProviderHealth> {
    return {
      status: this.state === 'ready' || this.state === 'active' ? 'healthy' : 'unknown',
      state: this.state,
      checkedAt: new Date().toISOString(),
    }
  }
  async getState(): Promise<ProviderState> {
    return this.state
  }
}
