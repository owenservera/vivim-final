/**
 * VIVIM AI Gateway — Concrete Implementation
 * @module ai/gateway/vivim-ai-gateway
 *
 * Wires IExecutionManager, IRouter, IEventBus, IProviderRegistry,
 * IModelRegistry, IPolicyEvaluator, IPolicyEnforcer, IRuntimeSupervisor,
 * and (optionally) IToolOrchestrator behind the IVIVIMGateway public API.
 */

import type {
  AIEvent,
  AIRequest,
  ModelDescriptor,
  ProviderHealth,
  ProviderId,
  ProviderManifest,
  RequestId,
  RoutingDecision,
} from '../core/types.js'
import type { PluginId } from '../core/types.js'
import type { GatewayEvent, GatewayEventFilter } from '../events/bus.js'
import type { IEventBus } from '../events/bus.js'
import type { IExecutionManagerInternal } from '../execution/internal.js'
import type { ExecutionHandle, ExecutionId } from '../execution/types.js'
import type { IPolicyEnforcer, IPolicyEvaluator } from '../policy/policy.js'
import type { IProviderAdapter } from '../protocol/adapter.js'
import type { IProviderRegistry } from '../registry/registry.js'
import type { IModelRegistry } from '../registry/registry.js'
import type { IRouter, RoutingDependencies } from '../routing/router.js'
import type { IResourceMonitor } from '../runtime/resources.js'
import type { IRuntimeSupervisor } from '../runtime/supervisor.js'
import type { IToolOrchestrator } from '../tools/orchestrator.js'
import type { IVIVIMGateway, ModelFilter, ProviderFilter } from './gateway.js'

import { AI_ERRORS } from '../core/errors.js'
import type { TSRuntimeSupervisor } from '../runtime/ts-supervisor.js'

export interface VivimAIGatewayOptions {
  readonly executionManager: IExecutionManagerInternal
  readonly router: IRouter
  readonly eventBus: IEventBus
  readonly providerRegistry: IProviderRegistry
  readonly modelRegistry: IModelRegistry
  readonly policyEvaluator: IPolicyEvaluator
  readonly policyEnforcer: IPolicyEnforcer
  readonly supervisor: IRuntimeSupervisor
  readonly resourceMonitor: IResourceMonitor
  readonly toolOrchestrator?: IToolOrchestrator
  /** Adapter factory registry: providerId → adapter instance. */
  readonly adapters?: ReadonlyMap<ProviderId, IProviderAdapter>
}

export class VivimAIGateway implements IVIVIMGateway {
  private readonly opts: VivimAIGatewayOptions
  private readonly adapters = new Map<ProviderId, IProviderAdapter>()

  constructor(opts: VivimAIGatewayOptions) {
    this.opts = opts
    if (opts.adapters) {
      for (const [id, adapter] of opts.adapters) {
        this.adapters.set(id, adapter)
      }
    }
  }

  /** Register an adapter for a provider (called during boot). */
  registerAdapter(providerId: ProviderId, adapter: IProviderAdapter): void {
    this.adapters.set(providerId, adapter)
  }

  /** Unregister an adapter. */
  unregisterAdapter(providerId: ProviderId): void {
    this.adapters.delete(providerId)
  }

  async *execute(request: AIRequest, signal?: AbortSignal): AsyncIterable<AIEvent> {
    const handle = await this.createExecution(request)
    try {
      for await (const event of handle.events) {
        if (signal?.aborted) {
          await handle.cancel('Caller aborted')
          return
        }
        if (event.type === 'execution.ai-event') {
          yield event.event
        } else if (event.type === 'execution.failed') {
          throw new VivimAIErrorFromExecution(event.error)
        } else if (event.type === 'execution.cancelled') {
          return
        } else if (event.type === 'execution.completed') {
          return
        }
      }
    } finally {
      // Ensure the handle's event iterator is closed
      if (typeof (handle.events as any)?.return === 'function') {
        await (handle.events as any).return()
      }
    }
  }

  async createExecution(request: AIRequest): Promise<ExecutionHandle> {
    // Enforce a quick policy pre-check
    const policy = request.policy ?? {}
    if (policy.allowToolExecution === false && request.tools && request.tools.length > 0) {
      throw AI_ERRORS.policyDenied('Tool execution disabled but request declares tools')
    }

    const handle = await this.opts.executionManager.create(request)

    // Route
    const routingDeps: RoutingDependencies = {
      providerRegistry: this.opts.providerRegistry,
      modelRegistry: this.opts.modelRegistry,
      policyEvaluator: this.opts.policyEvaluator,
      resourceMonitor: this.opts.resourceMonitor,
    }

    let decision: RoutingDecision
    try {
      // Transition: queued → routing
      await this.opts.executionManager.transition(handle.executionId, 'routing')

      decision = await this.opts.router.route(request, routingDeps)
    } catch (err) {
      await this.opts.executionManager.recordFailed(
        handle.executionId,
        err instanceof VivimAIErrorFromExecution
          ? (err as any).error
          : AI_ERRORS.unknown(String(err), err).toJSON(),
        false,
      )
      throw err
    }

    // Record provider selection
    await this.opts.executionManager.recordProviderSelection(
      handle.executionId,
      decision.providerId,
      decision.modelId,
      0,
    )

    // Transition: routing → starting
    await this.opts.executionManager.transition(handle.executionId, 'starting')

    // Get the adapter
    const adapter = this.adapters.get(decision.providerId)
    if (!adapter) {
      const err = AI_ERRORS.providerUnavailable(
        decision.providerId,
        new Error(`No adapter registered for provider ${decision.providerId}`),
      )
      await this.opts.executionManager.recordFailed(handle.executionId, err.toJSON(), false)
      throw err
    }

    // Ensure provider is started (get connection from supervisor)
    let connection = (this.opts.supervisor as TSRuntimeSupervisor).getConnection?.(
      decision.providerId,
    )
    if (!connection) {
      try {
        connection = await this.opts.supervisor.startProvider(decision.providerId)
        await adapter.initialize(connection)
      } catch (err) {
        const aiErr = AI_ERRORS.runtimeCrash(decision.providerId, err)
        await this.opts.executionManager.recordFailed(handle.executionId, aiErr.toJSON(), false)
        throw aiErr
      }
    }

    // Transition: starting → executing
    await this.opts.executionManager.transition(handle.executionId, 'executing')
    void (async () => {
      try {
        for await (const aiEvent of adapter.execute(request, undefined)) {
          this.opts.executionManager.recordAIEvent(handle.executionId, aiEvent)
          if (aiEvent.type === 'response.completed') {
            await this.opts.executionManager.recordCompleted(handle.executionId)
            return
          }
          if (aiEvent.type === 'response.failed') {
            await this.opts.executionManager.recordFailed(handle.executionId, aiEvent.error, false)
            return
          }
          if (aiEvent.type === 'response.cancelled') {
            await this.opts.executionManager.cancel(handle.executionId, aiEvent.reason)
            return
          }
        }
        // Stream ended without a terminal event — mark as completed
        await this.opts.executionManager.recordCompleted(handle.executionId)
      } catch (err) {
        const aiErr =
          err instanceof VivimAIErrorFromExecution
            ? (err as any).error
            : AI_ERRORS.unknown(String(err), err).toJSON()
        await this.opts.executionManager.recordFailed(handle.executionId, aiErr, false)
      }
    })()

    return handle
  }

  async cancel(requestId: RequestId): Promise<void> {
    const execution = await this.opts.executionManager.getByRequest(requestId)
    if (!execution) return
    await this.opts.executionManager.cancel(execution.id, 'Cancelled by caller')
  }

  async cancelExecution(executionId: ExecutionId, reason?: string): Promise<void> {
    await this.opts.executionManager.cancel(executionId, reason)
  }

  async listModels(filter?: ModelFilter): Promise<readonly ModelDescriptor[]> {
    const all = await this.opts.modelRegistry.list()
    if (!filter) return all
    return all.filter((m) => {
      if (filter.providerId && m.providerId !== filter.providerId) return false
      if (
        filter.capability &&
        m.capabilities[filter.capability as keyof typeof m.capabilities]?.supported !== true
      )
        return false
      return true
    })
  }

  async listProviders(filter?: ProviderFilter): Promise<readonly ProviderManifest[]> {
    const all = await this.opts.providerRegistry.list()
    if (!filter) return all
    return all.filter((p) => {
      if (filter.kind && p.kind !== filter.kind) return false
      return true
    })
  }

  async resolveRoute(request: AIRequest): Promise<RoutingDecision> {
    const routingDeps: RoutingDependencies = {
      providerRegistry: this.opts.providerRegistry,
      modelRegistry: this.opts.modelRegistry,
      policyEvaluator: this.opts.policyEvaluator,
      resourceMonitor: this.opts.resourceMonitor,
    }
    return this.opts.router.route(request, routingDeps)
  }

  async installProvider(pluginId: PluginId, _config?: unknown): Promise<ProviderId> {
    // #3: Delegate to the activated TrustedPluginManager (globalThis.__pluginManager).
    // The plugin manager handles load/hook registration + integrity verification + certify().
    const mgr = (globalThis as Record<string, unknown>).__pluginManager as
      | { install: (source: { source: string }) => Promise<{ manifest: { id: ProviderId } }> }
      | undefined
    if (!mgr) {
      throw AI_ERRORS.pluginInvalid(
        pluginId as string as ProviderId,
        'Plugin manager not activated (boot wiring missing)',
      )
    }
    const desc = await mgr.install({ source: pluginId as string })
    return desc.manifest.id
  }

  async removeProvider(providerId: ProviderId): Promise<void> {
    await this.opts.supervisor.stopProvider(providerId, true)
    await this.opts.providerRegistry.unregister(providerId)
    await this.opts.modelRegistry.unregisterByProvider(providerId)
    this.adapters.delete(providerId)
  }

  async enableProvider(providerId: ProviderId): Promise<void> {
    await this.opts.providerRegistry.setState(providerId, 'enabled')
  }

  async disableProvider(providerId: ProviderId): Promise<void> {
    await this.opts.providerRegistry.setState(providerId, 'disabled')
  }

  async startProvider(providerId: ProviderId): Promise<void> {
    await this.opts.providerRegistry.setState(providerId, 'starting')
    const connection = await this.opts.supervisor.startProvider(providerId)
    const adapter = this.adapters.get(providerId)
    if (adapter) {
      await adapter.initialize(connection)
    }
    await this.opts.providerRegistry.setState(providerId, 'ready')
    await this.opts.providerRegistry.setState(providerId, 'active')
  }

  async stopProvider(providerId: ProviderId, graceful?: boolean): Promise<void> {
    // Drain in-flight executions first
    await this.opts.executionManager.drainProvider(providerId)
    await this.opts.supervisor.stopProvider(providerId, graceful)
    const adapter = this.adapters.get(providerId)
    if (adapter) {
      await adapter.shutdown()
    }
    await this.opts.providerRegistry.setState(providerId, 'stopped')
  }

  async restartProvider(providerId: ProviderId): Promise<void> {
    await this.stopProvider(providerId, true)
    await this.startProvider(providerId)
  }

  async getProviderHealth(providerId: ProviderId): Promise<ProviderHealth> {
    return this.opts.supervisor.getHealth(providerId)
  }

  subscribe(filter?: GatewayEventFilter): AsyncIterable<GatewayEvent> {
    return this.opts.eventBus.subscribe(filter)
  }
}

/** Internal wrapper to carry an AIError through the async stream. */
class VivimAIErrorFromExecution extends Error {
  constructor(readonly error: import('../core/types.js').AIError) {
    super(error.message)
    this.name = 'VivimAIErrorFromExecution'
  }
}
