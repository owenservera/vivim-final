/**
 * VIVIM AI Gateway — Public Surface
 *
 * Application code (UI, Automation, Agents) should import from this file
 * only. Everything re-exported here is stable contract; everything NOT
 * re-exported here (concrete adapters, the simulator, internal scoring
 * strategies) is implementation detail that can change without a VIVIM
 * Core code change — which is the entire point of this architecture.
 */

export * from './core/types.js'
export * from './core/errors.js'
export * from './core/invariants.js'

export * from './execution/types.js'
export type { IExecutionManager } from './execution/manager.js'

export type {
  IProviderAdapter,
  ProviderAdapterFactory,
  ProviderConnection,
  ProviderTransport,
} from './protocol/adapter.js'

export type { IVIVIMGateway, ModelFilter, ProviderFilter } from './gateway/gateway.js'

export type {
  IRouter,
  IRoutingStrategy,
  RoutingDependencies,
  RoutingStrategyName,
} from './routing/router.js'

export type {
  CandidateInput,
  IPolicyEnforcer,
  IPolicyEvaluator,
  PolicyDecision,
} from './policy/policy.js'

export { PROVIDER_TRANSITIONS, canTransitionProvider } from './registry/registry.js'
export type { IModelRegistry, IProviderRegistry } from './registry/registry.js'

export type {
  IResourceManager,
  IResourceMonitor,
  ResourceKind,
  ResourceLease,
  ResourceRequest,
  ResourceSnapshot,
} from './runtime/resources.js'
export type { IRuntimeSupervisor } from './runtime/supervisor.js'

export type {
  ApprovalMode,
  AuthorizationContext,
  AuthorizationDecision,
  IApprovalManager,
  IToolAuditLog,
  IToolAuthorizer,
  IToolExecutor,
  IToolOrchestrator,
} from './tools/orchestrator.js'

export type { IPluginManager, PluginPackageRef, PluginValidationResult } from './plugins/manager.js'

export type {
  AuditEvent,
  GatewayEvent,
  GatewayEventFilter,
  IEventBus,
  ProviderLifecycleEvent,
  ResourceEvent,
} from './events/bus.js'

// --- Concrete implementations (re-exported for boot wiring; not part of the frozen contract) ---

export { VivimAIGateway } from './gateway/vivim-ai-gateway.js'
export type { VivimAIGatewayOptions } from './gateway/vivim-ai-gateway.js'

export { createGateway } from './factory.js'
export type { CreateGatewayOptions } from './factory.js'

export { InMemoryEventBus } from './events/in-memory-bus.js'
export { InMemoryExecutionManager } from './execution/in-memory-manager.js'
export type { IExecutionManagerInternal } from './execution/internal.js'
export { InMemoryProviderRegistry } from './registry/in-memory-provider-registry.js'
export { InMemoryModelRegistry } from './registry/in-memory-model-registry.js'
export { DefaultRouter } from './routing/default-router.js'
export { DefaultPolicyEvaluator, DefaultPolicyEnforcer } from './policy/default-policy.js'
export { InMemoryResourceManager } from './runtime/in-memory-resource-manager.js'
export { TSRuntimeSupervisor, RemoteProviderDelegate } from './runtime/ts-supervisor.js'
export type { ISupervisorDelegate } from './runtime/ts-supervisor.js'

export {
  SimulatorAdapter,
  simulatorAdapterFactory,
  SIMULATOR_PROVIDER_ID,
  SIMULATOR_MODEL_ID,
  SIMULATOR_MANIFEST,
  SIMULATOR_MODEL,
} from './protocol/simulator-adapter.js'
export {
  OpenCodeAdapter,
  OPENCODE_PROVIDER_ID,
  OPENCODE_DEFAULT_MODEL,
  OPENCODE_MANIFEST,
  OPENCODE_DEFAULT_MODEL_DESCRIPTOR,
} from './protocol/opencode-adapter.js'
export { OpenAICompatibleAdapter } from './protocol/openai-compatible/adapter.js'
export type {
  OpenAICompatibleManifest,
  ModelManifestEntry,
  AuthMethod,
} from './protocol/openai-compatible/manifest.js'
export { validateManifest, loadManifestFromFile } from './protocol/openai-compatible/manifest.js'
