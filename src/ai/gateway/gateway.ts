/**
 * VIVIM AI Gateway — Public API Contract
 * @module ai/gateway/gateway
 *
 * ARCHITECTURAL RULE (non-negotiable — see ARCHITECTURE.md Invariant 1):
 * VIVIM Core (UI, Canvas, Automation, Agents) imports ONLY this interface
 * from the AI subsystem. It never imports a provider adapter, the router,
 * the registries, or a provider SDK directly.
 *
 * doc2 shipped execute/cancel/listModels/listProviders/resolveRoute — a
 * clean data-plane API but no control plane, meaning hot-swap would have
 * been bolted on later as an afterthought. This version treats provider
 * lifecycle and event subscription as first-class from the start, per
 * doc3's critique — implemented in full rather than left as a bullet list.
 */

import type {
  AIEvent,
  AIRequest,
  ModelDescriptor,
  PluginId,
  ProviderHealth,
  ProviderId,
  ProviderManifest,
  RequestId,
  RoutingDecision,
} from '../core/types.js'
import type { GatewayEvent, GatewayEventFilter } from '../events/bus.js'
import type { ExecutionHandle, ExecutionId } from '../execution/types.js'

export interface ModelFilter {
  readonly providerId?: ProviderId
  readonly capability?: string
}

export interface ProviderFilter {
  readonly kind?: 'local' | 'remote' | 'hybrid' | 'embedded'
  readonly onlyAvailable?: boolean
}

export interface IVIVIMGateway {
  /* ---------------------------------------------------------------------
   * Data plane — request execution
   * ------------------------------------------------------------------- */

  /** Convenience path for simple fire-and-stream call sites. Internally creates an execution and forwards its AI events. */
  execute(request: AIRequest, signal?: AbortSignal): AsyncIterable<AIEvent>

  /** Full path for call sites that need the execution's lifecycle (progress UI, retry visibility, replay). */
  createExecution(request: AIRequest): Promise<ExecutionHandle>

  cancel(requestId: RequestId): Promise<void>
  cancelExecution(executionId: ExecutionId, reason?: string): Promise<void>

  /* ---------------------------------------------------------------------
   * Discovery
   * ------------------------------------------------------------------- */

  listModels(filter?: ModelFilter): Promise<readonly ModelDescriptor[]>
  listProviders(filter?: ProviderFilter): Promise<readonly ProviderManifest[]>

  /** Resolves routing WITHOUT executing — powers UI previews like "which model will handle this?". */
  resolveRoute(request: AIRequest): Promise<RoutingDecision>

  /* ---------------------------------------------------------------------
   * Control plane — provider lifecycle (hot swap is first-class, not bolted on)
   * ------------------------------------------------------------------- */

  installProvider(pluginId: PluginId, config?: unknown): Promise<ProviderId>
  removeProvider(providerId: ProviderId): Promise<void>

  enableProvider(providerId: ProviderId): Promise<void>
  disableProvider(providerId: ProviderId): Promise<void>

  startProvider(providerId: ProviderId): Promise<void>
  /** Internally calls IExecutionManager.drainProvider() before delegating to the Supervisor — callers never need to drain manually. */
  stopProvider(providerId: ProviderId, graceful?: boolean): Promise<void>
  restartProvider(providerId: ProviderId): Promise<void>

  getProviderHealth(providerId: ProviderId): Promise<ProviderHealth>

  /* ---------------------------------------------------------------------
   * Observability
   * ------------------------------------------------------------------- */

  subscribe(filter?: GatewayEventFilter): AsyncIterable<GatewayEvent>
}
