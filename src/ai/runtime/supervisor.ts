/**
 * VIVIM AI Gateway — Runtime Supervisor Contract
 * @module ai/runtime/supervisor
 *
 * ARCHITECTURAL RULE: the TypeScript layer never spawns or kills OS
 * processes directly. It delegates to the Rust supervisor via Tauri IPC,
 * which is the only thing that gets crash isolation, GPU resource
 * ownership, and OS-level security boundaries right on Windows.
 *
 * This is a TypeScript-side contract for that Rust boundary — the actual
 * process spawning lives in the Tauri command handlers, not here.
 */

import type { ProviderHealth, ProviderId, ProviderState } from '../core/types.js'
import type { ProviderConnection } from '../protocol/adapter.js'
import type { IResourceManager } from './resources.js'

export interface IRuntimeSupervisor {
  /** Starts the OS process/runtime for a provider and returns how to reach it. Does NOT initialize the adapter — the Gateway does that next. */
  startProvider(providerId: ProviderId): Promise<ProviderConnection>
  stopProvider(providerId: ProviderId, graceful?: boolean): Promise<void>
  restartProvider(providerId: ProviderId): Promise<ProviderConnection>

  getHealth(providerId: ProviderId): Promise<ProviderHealth>
  getState(providerId: ProviderId): Promise<ProviderState>

  /** Resource leasing is delegated rather than duplicated — the Supervisor is the natural owner of OS-level resource truth. */
  readonly resources: IResourceManager
}
