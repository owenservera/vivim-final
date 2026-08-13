import type { OutcomeTracker } from '../engines/outcome-tracker.js'
import type { ProviderId } from './core/types.js'
import { InMemoryEventBus } from './events/in-memory-bus.js'
import { InMemoryExecutionManager } from './execution/in-memory-manager.js'
import { VivimAIGateway } from './gateway/vivim-ai-gateway.js'
import { DefaultPolicyEnforcer, DefaultPolicyEvaluator } from './policy/default-policy.js'
import type { IProviderAdapter } from './protocol/adapter.js'
import { SIMULATOR_PROVIDER_ID, SimulatorAdapter } from './protocol/simulator-adapter.js'
import { InMemoryModelRegistry } from './registry/in-memory-model-registry.js'
import { InMemoryProviderRegistry } from './registry/in-memory-provider-registry.js'
import { DefaultRouter } from './routing/default-router.js'
import { InMemoryResourceManager } from './runtime/in-memory-resource-manager.js'
import { TSRuntimeSupervisor } from './runtime/ts-supervisor.js'

export interface CreateGatewayOptions {
  /** Additional adapters to register (e.g., OpenCodeAdapter, OpenAICompatibleAdapter). */
  readonly adapters?: ReadonlyArray<{
    readonly providerId: ProviderId
    readonly adapter: IProviderAdapter
  }>
  /** Disable the built-in simulator adapter (default: false = simulator enabled). */
  readonly disableSimulator?: boolean
  /** OutcomeTracker for learned routing — enables best-fit strategy + real scoring. */
  readonly outcomeTracker?: OutcomeTracker
}

/**
 * Create a fully-wired VivimAIGateway with in-memory defaults.
 *
 * Boot code typically:
 *   1. Calls createGateway() to get the default instance.
 *   2. Registers additional adapters via gateway.registerAdapter().
 *   3. Registers providers + models in the registries.
 *   4. Starts providers via supervisor.startProvider().
 */
export function createGateway(opts: CreateGatewayOptions = {}): {
  gateway: VivimAIGateway
  eventBus: InMemoryEventBus
  executionManager: InMemoryExecutionManager
  providerRegistry: InMemoryProviderRegistry
  modelRegistry: InMemoryModelRegistry
  router: DefaultRouter
  policyEvaluator: DefaultPolicyEvaluator
  policyEnforcer: DefaultPolicyEnforcer
  supervisor: TSRuntimeSupervisor
  resourceManager: InMemoryResourceManager
} {
  const eventBus = new InMemoryEventBus()
  const executionManager = new InMemoryExecutionManager()
  const providerRegistry = new InMemoryProviderRegistry(eventBus)
  const modelRegistry = new InMemoryModelRegistry()
  const router = new DefaultRouter(opts.outcomeTracker)
  const policyEvaluator = new DefaultPolicyEvaluator(opts.outcomeTracker)
  const policyEnforcer = new DefaultPolicyEnforcer()
  const resourceManager = new InMemoryResourceManager()
  const supervisor = new TSRuntimeSupervisor(resourceManager)

  const adapters = new Map<ProviderId, IProviderAdapter>()

  // Register simulator adapter by default (for testing without a GPU)
  if (!opts.disableSimulator) {
    const simulator = new SimulatorAdapter()
    adapters.set(SIMULATOR_PROVIDER_ID, simulator)
  }

  // Register user-provided adapters
  if (opts.adapters) {
    for (const { providerId: pid, adapter } of opts.adapters) {
      adapters.set(pid, adapter)
    }
  }

  const gateway = new VivimAIGateway({
    executionManager,
    router,
    eventBus,
    providerRegistry,
    modelRegistry,
    policyEvaluator,
    policyEnforcer,
    supervisor,
    resourceMonitor: resourceManager,
    adapters,
  })

  return {
    gateway,
    eventBus,
    executionManager,
    providerRegistry,
    modelRegistry,
    router,
    policyEvaluator,
    policyEnforcer,
    supervisor,
    resourceManager,
  }
}
