/**
 * VIVIM AI Gateway — Provider Adapter Contract
 * @module ai/protocol/adapter
 *
 * This is the ONLY behavioral contract a provider integration implements.
 * There is deliberately no separate `AIProvider` interface for it to
 * `extend` — v1.0 of this file did that (mirroring core/types.ts's now-
 * removed inline AIProvider contract) and it created two slightly
 * different definitions of "how do you run a request" with no clear
 * owner. One contract, one owner.
 *
 * Separation of concerns across the three files that together make a
 * working provider integration:
 *
 *   ProviderManifest (core/types.ts)  — WHO the provider is (identity, capabilities)
 *   IProviderAdapter  (this file)     — HOW to translate IR ⇄ provider-native calls
 *   IRuntimeSupervisor (runtime/supervisor.ts) — WHERE it runs (OS process, GPU, lifecycle)
 *
 * The Supervisor starts the OS process and hands the adapter a
 * ProviderConnection. The adapter never spawns or kills processes itself.
 */

import type {
  AIEvent,
  AIRequest,
  ModelDescriptor,
  ProviderHealth,
  ProviderId,
  ProviderManifest,
  RequestId,
} from '../core/types.js'

export type ProviderTransport = 'http' | 'unix-socket' | 'named-pipe' | 'in-process'

export interface ProviderConnection {
  readonly transport: ProviderTransport
  readonly baseUrl?: string
  readonly socketPath?: string
  /** OS process id, when the Supervisor manages this as an external process. Absent for in-process/remote adapters. */
  readonly processId?: number
}

export interface IProviderAdapter {
  readonly providerId: ProviderId
  readonly manifest: ProviderManifest

  /**
   * Wires the adapter to an already-running provider process/endpoint.
   * The Supervisor calls this after startProvider() succeeds — the
   * adapter must not attempt to start anything itself.
   */
  initialize(connection: ProviderConnection, config?: unknown): Promise<void>

  health(signal?: AbortSignal): Promise<ProviderHealth>

  listModels(signal?: AbortSignal): Promise<readonly ModelDescriptor[]>

  /**
   * Translates a canonical AIRequest into provider-native calls and
   * yields canonical AIEvents. Provider-native exceptions must be caught
   * here and re-thrown as VivimAIError (see core/errors.ts) — nothing
   * provider-specific may cross this return boundary.
   */
  execute(request: AIRequest, signal?: AbortSignal): AsyncIterable<AIEvent>

  /** Optional: providers that can cancel server-side (not just stop reading the stream) should implement this. */
  cancel?(requestId: RequestId): Promise<void>

  /** Closes the adapter's connection. Does NOT stop the OS process — that's the Supervisor's job. */
  shutdown(): Promise<void>
}

/**
 * Factory signature every provider plugin's entry point must export.
 * Kept tiny and synchronous-friendly so plugin loading stays simple
 * regardless of the plugin's implementation language.
 */
export type ProviderAdapterFactory = (manifest: ProviderManifest) => IProviderAdapter
