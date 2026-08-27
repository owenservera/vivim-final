/**
 * VIVIM AI Gateway — Public Surface
 *
 * Application code (UI, Automation, Agents) should import from this file
 * only. Everything re-exported here is stable contract; everything NOT
 * re-exported here (concrete adapters, the simulator, internal scoring
 * strategies) is implementation detail that can change without a VIVIM
 * Core code change — which is the entire point of this architecture.
 */

export * from './core/errors.js'
export * from './core/invariants.js'
export * from './core/types.js'
export type {
  AuditEvent,
  GatewayEvent,
  GatewayEventFilter,
  IEventBus,
  ProviderLifecycleEvent,
  ResourceEvent,
} from './events/bus.js'
export type { IExecutionManager } from './execution/manager.js'
export * from './execution/types.js'

export type { IVIVIMGateway, ModelFilter, ProviderFilter } from './gateway/gateway.js'
export type { IPluginManager, PluginPackageRef, PluginValidationResult } from './plugins/manager.js'

export type {
  CandidateInput,
  IPolicyEnforcer,
  IPolicyEvaluator,
  PolicyDecision,
} from './policy/policy.js'
export type {
  IProviderAdapter,
  ProviderAdapterFactory,
  ProviderConnection,
  ProviderTransport,
} from './protocol/adapter.js'
export type { IModelRegistry, IProviderRegistry } from './registry/registry.js'
export { canTransitionProvider, PROVIDER_TRANSITIONS } from './registry/registry.js'
export type {
  IRouter,
  IRoutingStrategy,
  RoutingDependencies,
  RoutingStrategyName,
} from './routing/router.js'
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

// --- Concrete implementations (re-exported for boot wiring; not part of the frozen contract) ---

export { InMemoryEventBus } from './events/in-memory-bus.js'
export { InMemoryExecutionManager } from './execution/in-memory-manager.js'
export type { IExecutionManagerInternal } from './execution/internal.js'
export type { CreateGatewayOptions } from './factory.js'
export { createGateway } from './factory.js'
export type { VivimAIGatewayOptions } from './gateway/vivim-ai-gateway.js'
export { VivimAIGateway } from './gateway/vivim-ai-gateway.js'
export { DefaultPolicyEnforcer, DefaultPolicyEvaluator } from './policy/default-policy.js'
export { OpenAICompatibleAdapter } from './protocol/openai-compatible/adapter.js'
export type {
  AuthMethod,
  ModelManifestEntry,
  OpenAICompatibleManifest,
} from './protocol/openai-compatible/manifest.js'
export { loadManifestFromFile, validateManifest } from './protocol/openai-compatible/manifest.js'
export {
  OPENCODE_DEFAULT_MODEL,
  OPENCODE_DEFAULT_MODEL_DESCRIPTOR,
  OPENCODE_MANIFEST,
  OPENCODE_PROVIDER_ID,
  OpenCodeAdapter,
} from './protocol/opencode-adapter.js'
export {
  SIMULATOR_MANIFEST,
  SIMULATOR_MODEL,
  SIMULATOR_MODEL_ID,
  SIMULATOR_PROVIDER_ID,
  SimulatorAdapter,
  simulatorAdapterFactory,
} from './protocol/simulator-adapter.js'
export { InMemoryModelRegistry } from './registry/in-memory-model-registry.js'
export { InMemoryProviderRegistry } from './registry/in-memory-provider-registry.js'
export { DefaultRouter } from './routing/default-router.js'
export { InMemoryResourceManager } from './runtime/in-memory-resource-manager.js'
export type { ISupervisorDelegate } from './runtime/ts-supervisor.js'
export { RemoteProviderDelegate, TSRuntimeSupervisor } from './runtime/ts-supervisor.js'
