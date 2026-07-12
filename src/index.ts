// src/index.ts
// vivim-final — public re-exports

export const VERSION = '1.0.0'
export * from './errors.js'
export * from './ids.js'

// Schema barrel
export * from './schema/index.js'

// Engines
export { CapabilityEventBus } from './engines/capability-event-bus.js'
export { ChromeGovernor } from './engines/chrome-governor.js'
export { ConversationManager } from './engines/conversation-manager.js'
export { StreamParserEngine } from './engines/stream-parser.js'
export { CapabilityEngine } from './engines/capability.js'
export { ProviderRegistrar } from './engines/provider-registrar.js'
export { CapabilityResolutionEngine } from './engines/capability-resolution.js'
export { ProviderHealthKernel } from './engines/provider-health.js'
export { StreamBlockStore } from './engines/stream-block-store.js'
export { RegistrationAuditor } from './engines/registration-auditor.js'
export { VersionManager } from './engines/version-manager.js'
export { TelemetryAggregator } from './engines/telemetry-aggregator.js'
export { ConfigManager } from './engines/config-manager.js'
export { ExecutionMemoizer } from './engines/execution-memoizer.js'
export { HarnessRuntime } from './engines/harness-runtime.js'
export { HarnessCheckpointEngine } from './engines/harness-checkpoint.js'
export { CapabilityMacroEngine } from './engines/capability-macro.js'
export { SessionCheckpointEngine } from './engines/session-checkpoint.js'
export { StateTransitionEngine } from './engines/state-transition.js'
export { MemoryEngine } from './engines/memory-engine.js'
export { ProviderMuxEngine } from './engines/provider-mux.js'
export { CostOptimizer } from './engines/cost-optimizer.js'
export { SituationDetector } from './engines/situation-detector.js'
export type { TaskType, SituationSignal, DetectionInput } from './engines/situation-detector.js'
export { ContextAssemblyEngine } from './engines/context-assembly.js'
export type {
  ContextLayerName,
  ContextLayer,
  AssembledContext,
} from './engines/context-assembly.js'

// Phase 18: Composable Interface
export { UnifiedCapabilityRegistry } from './engines/unified-registry.js'
export type {
  CapabilitySurface,
  UnifiedCapability,
  CapabilityContext,
} from './engines/unified-registry.js'
export { PluginHotReload } from './engines/plugin-hot-reload.js'
export type { ProviderPlugin } from './engines/plugin-hot-reload.js'
export { AdaptiveWorkspaceEngine } from './engines/adaptive-workspace.js'
export type { WorkspaceMode, PanelConfig } from './engines/adaptive-workspace.js'
export { ConversationOrganizer } from './engines/conversation-organizer.js'

// Phase 19: Autonomous Execution
export { AutonomousExecutionEngine } from './engines/autonomous-execution.js'
export type {
  AutonomousGoal,
  AutonomousTask,
  AutonomousStep,
  HitlGate,
  TaskStatus,
  StepStatus,
  ActionClassification,
} from './engines/autonomous-execution.js'
export { ExecutionPolicyEngine } from './engines/execution-policy.js'
export type { PolicyRule, PolicyDecision } from './engines/execution-policy.js'
export { AgenticLoopEngine } from './engines/agentic-loop.js'
export type {
  AgenticGoal,
  AgenticLoopResult,
  PlanningStrategy,
  EpisodeRecord,
} from './engines/agentic-loop.js'

// Executor
export { AsyncMutex } from './executor/async-mutex.js'
export { CircuitBreaker } from './executor/circuit-breaker.js'
export type { FleetConfig } from './executor/fleet-config.js'
export type { ContentBlock } from './executor/content-blocks.js'
export { deriveId, deriveSlaveId } from './executor/ids.js'

// Alerting
export { Alerter } from './alerting/alerter.js'

// Automation
export { AutomationScheduler } from './automation/scheduler.js'

// Router
export { Router } from './router/router.js'

// Phase 20: Sovereign Data
export { EncryptionEngine } from './engines/encryption.js'
export type { EncryptionConfig, EncryptedData } from './engines/encryption.js'
export { ExportEngine } from './engines/export.js'
export type {
  ExportFormat,
  ExportScope,
  ExportOptions,
  ExportManifest,
  ExportStore,
} from './engines/export.js'
export { AirGapEngine } from './engines/airgap.js'
export type { AirGapConfig, AirGapStatus, LocalModelRouteResult } from './engines/airgap.js'
export { LocalModelAdapter } from './engines/local-model-adapter.js'
export type {
  LocalModelProvider,
  LocalModelConfig,
  LocalModelResponse,
} from './engines/local-model-adapter.js'
export { SyncEngine } from './engines/sync.js'
export type { SyncConfig, SyncPeer, SyncLogEntry, SyncStore, SyncResult } from './engines/sync.js'
export { TelemetryAudit } from './engines/telemetry-audit.js'
export type { NetworkCallRecord, AuditReport } from './engines/telemetry-audit.js'
export { initPrismaWal } from './storage/prisma.js'

// Phase 21: Store Implementations
export { WorkflowStoreImpl } from './storage/impl/workflow-store-impl.js'
export { CapabilityMacroStoreImpl } from './storage/impl/capability-macro-store-impl.js'
export { HarnessCheckpointStoreImpl } from './storage/impl/harness-checkpoint-store-impl.js'
export { AlertStoreImpl } from './storage/impl/alert-store-impl.js'
export type { Alert, AlertStore } from './storage/contracts/alert-store.js'
export { AutomationStoreImpl } from './storage/impl/automation-store-impl.js'
export type { Automation, AutomationStore } from './storage/contracts/automation-store.js'
export { HpeSessionStoreImpl } from './storage/impl/hpe-session-store-impl.js'

// Phase 22: Agentic Discovery Tooling
export { DiscoveryStoreImpl } from './storage/impl/discovery-store-impl.js'
export type {
  DiscoveryStore,
  DiscoverySessionRow,
  DiscoveryObservationRow,
} from './storage/contracts/discovery-store.js'
export { ShapeBindingStoreImpl } from './storage/impl/shape-binding-store-impl.js'
export type { ShapeBindingStore, ShapeBindingRow } from './storage/contracts/shape-binding-store.js'
export { ProviderDiscoveryEngine } from './engines/provider-discovery.js'
export type {
  DiscoverySession,
  DiscoveryOptions,
  DomSnapshot,
  ShapeMatchResult,
  InferredCapability,
  NetworkObservation,
  ProviderManifestDraft,
  ManifestEdits,
  RegisterResult,
  PageState,
  DomMutationResult,
  InteractiveElement,
  AccessibilityNode,
} from './engines/provider-discovery.js'
export { ManifestInferenceEngine } from './engines/manifest-inference.js'
export type {
  ProviderManifest,
  InferredManifest,
  ValidationResult,
} from './engines/manifest-inference.js'
export { CapabilityShapeRegistry } from './engines/capability-shape-registry.js'
export type {
  CapabilityShape,
  CapabilityAdapter,
  DomIndicator,
} from './engines/capability-shape-registry.js'
export { DiscoveryMcpServer, createDiscoveryMcpServer } from './mcp/server.js'
export type { DiscoveryServerContext } from './mcp/types.js'

// NLCL — Natural Language Command Layer (the "comms system")
export { NLCLEngine } from './engines/nlcl/nlcl-engine.js'
export type { NLCLEngineDeps } from './engines/nlcl/nlcl-engine.js'
export { CommandPatternRegistry } from './engines/nlcl/command-registry.js'
export { NLCommandParser } from './engines/nlcl/nl-parser.js'
export {
  DeterministicResolver,
  LocalLLMResolver,
  ProviderLLMResolver,
  HybridResolver,
  createResolver,
} from './engines/nlcl/intent-resolver.js'
export type {
  LocalLLMAdapter,
  ProviderLLMAdapter,
} from './engines/nlcl/intent-resolver.js'
export { IntentRouter } from './engines/nlcl/intent-router.js'
export { getDefaultCommandPatterns } from './engines/nlcl/catalog.js'
export {
  FileExecutor,
  BrowserExecutor,
  ProviderLLMExecutor,
  SystemExecutor,
  ConversationExecutor,
  CapabilityExecutor,
  EmailExecutor,
  AppExecutor,
} from './engines/nlcl/executors/index.js'
export type {
  CommandPattern,
  ParsedIntent,
  CommandResult,
  NLCContext,
  NLCLEngineConfig,
  IntentResolver,
  ResolverConfig,
  CommandExecutor,
  ExecutorId,
  NLPattern,
} from './engines/nlcl/types.js'
export { DEFAULT_NLCL_CONFIG } from './engines/nlcl/types.js'

// Phase 9: Observability
export * from './engines/observability/index.js'

// Phase 11: Stealth Core
export * from './engines/stealth/index.js'
