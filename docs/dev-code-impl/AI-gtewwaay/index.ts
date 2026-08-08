/**
 * VIVIM AI Gateway — Public Surface
 *
 * Application code (UI, Automation, Agents) should import from this file
 * only. Everything re-exported here is stable contract; everything NOT
 * re-exported here (concrete adapters, the simulator, internal scoring
 * strategies) is implementation detail that can change without a VIVIM
 * Core code change — which is the entire point of this architecture.
 */

export * from './core/types';
export * from './core/errors';
export * from './core/invariants';

export * from './execution/types';
export type { IExecutionManager } from './execution/manager';

export type { IProviderAdapter, ProviderAdapterFactory, ProviderConnection, ProviderTransport } from './protocol/adapter';

export type { IVIVIMGateway, ModelFilter, ProviderFilter } from './gateway/gateway';

export type { IRouter, IRoutingStrategy, RoutingDependencies, RoutingStrategyName } from './routing/router';

export type { CandidateInput, IPolicyEnforcer, IPolicyEvaluator, PolicyDecision } from './policy/policy';

export { PROVIDER_TRANSITIONS, canTransitionProvider } from './registry/registry';
export type { IModelRegistry, IProviderRegistry } from './registry/registry';

export type { IResourceManager, IResourceMonitor, ResourceKind, ResourceLease, ResourceRequest, ResourceSnapshot } from './runtime/resources';
export type { IRuntimeSupervisor } from './runtime/supervisor';

export type {
  ApprovalMode, AuthorizationContext, AuthorizationDecision,
  IApprovalManager, IToolAuditLog, IToolAuthorizer, IToolExecutor, IToolOrchestrator,
} from './tools/orchestrator';

export type { IPluginManager, PluginPackageRef, PluginValidationResult } from './plugins/manager';

export type { AuditEvent, GatewayEvent, GatewayEventFilter, IEventBus, ProviderLifecycleEvent, ResourceEvent } from './events/bus';
