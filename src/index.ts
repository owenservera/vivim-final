// src/index.ts
// vivim-final — public re-exports

export const VERSION = '1.0.0'
export { seedAutomation } from '../seeds/automation/automation.seed.js'
export { seedHarnessCommands } from '../seeds/harness/commands.seed.js'
// Alerting
export { Alerter } from './alerting/alerter.js'
// Automation
export { AutomationScheduler } from './automation/scheduler.js'
export type { HistoryInput, MutationServices, UndoInput } from './canvas/mutation-caps.js'
// Phase 26: Canvas NL Mutation
export { registerCanvasMutationCaps } from './canvas/mutation-caps.js'
export type {
  ActionNode,
  ActionPlan,
  CapabilityDefinition,
  CapabilityRisk,
  ExecutionEvidence,
  GroundedReference,
  VerifySpec,
  VerifyType,
} from './engines/action-plan.js'
// Phase 0: ActionPlan contract
export {
  ActionNodeSchema,
  ActionPlanSchema,
  ActionPlanValidationError,
  CapabilityRiskSchema,
  ExecutionEvidenceSchema,
  GroundedReferenceSchema,
  maxRiskTier,
  RISK_TIER,
  requiresConfirmation,
  topologicalOrder,
  VerifySpecSchema,
  validateActionPlan,
} from './engines/action-plan.js'
export type { PlanResult } from './engines/action-plan-bridge.js'
// Phase 2: ActionPlan bridge, reference grounding, plan validation
export { ActionPlanBridge } from './engines/action-plan-bridge.js'
export type {
  PlanCandidate,
  PlanCompilerInput,
} from './engines/action-plan-compiler.js'
// Phase 0: ActionPlan compiler
export { ActionPlanCompiler } from './engines/action-plan-compiler.js'
export type { PanelConfig, WorkspaceMode } from './engines/adaptive-workspace.js'
export { AdaptiveWorkspaceEngine } from './engines/adaptive-workspace.js'
export { AgentBuilderEngine } from './engines/agent-builder.js'
export type {
  AgenticGoal,
  AgenticLoopResult,
  EpisodeRecord,
  PlanningStrategy,
} from './engines/agentic-loop.js'
export { AgenticLoopEngine } from './engines/agentic-loop.js'
export type { AirGapConfig, AirGapStatus, LocalModelRouteResult } from './engines/airgap.js'
export { AirGapEngine } from './engines/airgap.js'
export type { ApiProviderConfig } from './engines/api-provider-adapter.js'
// Phase 5.3: API-direct providers
export { ApiProviderAdapter } from './engines/api-provider-adapter.js'
export type {
  ActionClassification,
  AutonomousGoal,
  AutonomousStep,
  AutonomousTask,
  HitlGate,
  PlannerResolution,
  StepStatus,
  TaskStatus,
} from './engines/autonomous-execution.js'
// Phase 19: Autonomous Execution
export { AutonomousExecutionEngine, resolvePlanner } from './engines/autonomous-execution.js'
export type {
  ReplayBranchOptions,
  ReplayResult,
  ReplayStepDiff,
  ReplayStepExecutor,
} from './engines/autonomous-replay.js'
export { ReplayController } from './engines/autonomous-replay.js'
export type {
  BackupCadence,
  BackupEntry,
  BackupScheduleConfig,
} from './engines/backup-scheduler.js'
export { BackupScheduler } from './engines/backup-scheduler.js'
export { BeliefStore } from './engines/belief-store.js'
export type {
  BrowserAction,
  BrowserGrounder,
  BrowserRef,
  BrowserSnapshot,
  GroundedElement,
} from './engines/browser-action-types.js'
// Phase 0: Browser action types
export {
  BrowserActionSchema,
  BrowserRefSchema,
  compactSnapshot,
} from './engines/browser-action-types.js'
export type { RunUsage, UsageLimits } from './engines/budget-engine.js'
export { BudgetEngine } from './engines/budget-engine.js'
export { CapabilityEngine } from './engines/capability.js'
export type { BoundCapability } from './engines/capability-binder.js'
export { CapabilityBinder } from './engines/capability-binder.js'
export type {
  CompositeCapability,
  CompositeCapabilityStore,
  CompositeEdge,
  CompositeNode,
} from './engines/capability-composer.js'
export { CapabilityComposer } from './engines/capability-composer.js'
// Engines
export { CapabilityEventBus } from './engines/capability-event-bus.js'
export { CapabilityMacroEngine } from './engines/capability-macro.js'
export type {
  ParityFinding,
  ParityReport,
  ParitySeverity,
} from './engines/capability-parity.js'
// Phase 1: Capability parity auditor
export { CapabilityParityAuditor } from './engines/capability-parity.js'
export { CapabilityResolutionEngine } from './engines/capability-resolution.js'
export type {
  CapabilityAdapter,
  CapabilityShape,
  DomIndicator,
} from './engines/capability-shape-registry.js'
export { CapabilityShapeRegistry } from './engines/capability-shape-registry.js'
export type { CapabilityTaxonomyEntry } from './engines/capability-taxonomy.js'
// Phase 5.4: Capability Taxonomy v2
export { CAPABILITY_TAXONOMY_V2 } from './engines/capability-taxonomy.js'
export { ChromeGovernor } from './engines/chrome-governor.js'
// LLM Agent-Driven Code Audit Engine
export { CodeAuditEngine } from './engines/code-audit/index.js'
export type {
  AgentOpinion,
  AuditPhase,
  AuditReport,
  CodeAuditOptions,
  CodebaseTopology,
  DebateConsensus,
  Finding,
  GraphEdge,
  GraphNode,
  IngestionStats,
  PhaseResult,
  SarifLog,
  SeverityLevel,
  TaintFlow,
  TaintStep,
} from './engines/code-audit/types.js'
export { ConfigManager } from './engines/config-manager.js'
export type {
  AssembledContext,
  ContextLayer,
  ContextLayerName,
} from './engines/context-assembly.js'
export { ContextAssemblyEngine } from './engines/context-assembly.js'
export { ConversationManager } from './engines/conversation-manager.js'
export { ConversationOrganizer } from './engines/conversation-organizer.js'
export { CostOptimizer } from './engines/cost-optimizer.js'
export type { EncryptedDbBlob } from './engines/db-encryption.js'
export { DbEncryptionEngine } from './engines/db-encryption.js'
export { MiniLmEmbeddingProvider } from './engines/embedding-minilm.js'
export { OllamaEmbeddingProvider } from './engines/embedding-ollama.js'
export type { EncryptedData, EncryptionConfig } from './engines/encryption.js'
// Phase 20: Sovereign Data
export { EncryptionEngine } from './engines/encryption.js'
export type { EventRecordInput, EventRecordRow, EventSource } from './engines/event-record-store.js'
export { EventRecordStore } from './engines/event-record-store.js'
// P0 Alpha Hardening — Execution Kernel
export type {
  ExecutionEvent,
  ExecutionKernelDeps,
  ExecutionResult,
  JournalSink,
  PolicyDecision,
  VerificationResult,
} from './engines/execution-kernel.js'
export { ExecutionKernel, MemoryJournal } from './engines/execution-kernel.js'
export { ExecutionMemoizer } from './engines/execution-memoizer.js'
export type {
  PolicyDecision as ExecutionPolicyDecision,
  PolicyRule,
} from './engines/execution-policy.js'
export { ExecutionPolicyEngine } from './engines/execution-policy.js'
export type {
  ExportFormat,
  ExportManifest,
  ExportOptions,
  ExportScope,
  ExportStore,
} from './engines/export.js'
export { ExportEngine } from './engines/export.js'
export type { AllocationCtx, EndStrategy, ResolvedRole } from './engines/governance-engine.js'
// ── Agentic Backbone (SOTA agentic system) ──
export { GovernanceEngine } from './engines/governance-engine.js'
export { HarnessCheckpointEngine } from './engines/harness-checkpoint.js'
export type { ResolvedCommand } from './engines/harness-command-registry.js'
// 017: Harness Command Registry
export { HarnessCommandRegistry } from './engines/harness-command-registry.js'
export type {
  FeedbackOutcome,
  FeedbackStrategy,
  FeedbackTurn,
} from './engines/harness-feedback-coordinator.js'
export { HarnessFeedbackCoordinator } from './engines/harness-feedback-coordinator.js'
export type { RepairInput, RepairResult } from './engines/harness-repair-engine.js'
export { HarnessRepairEngine } from './engines/harness-repair-engine.js'
export { HarnessRuntime } from './engines/harness-runtime.js'
export type {
  HealthDigestMetrics,
  HealthDigestMetricsProvider,
  HealthDigestOptions,
  HealthDigestRow,
  HealthDigestStore,
} from './engines/health-digest.js'
export { HealthDigestEngine, renderDigest } from './engines/health-digest.js'
export { generateImage, ImageGenBridge } from './engines/image-gen-bridge.js'
export type {
  KnowledgeEnvelope,
  VersionedKnowledgeEnvelope,
} from './engines/knowledge-envelope.js'
// Phase 0/4: Knowledge envelope + pipeline
export {
  KnowledgeEnvelopeSchema,
  normalizeKnowledge,
} from './engines/knowledge-envelope.js'
export type {
  KnowledgeChunk,
  KnowledgeExtraction,
  KnowledgePipelineDeps,
} from './engines/knowledge-index-pipeline.js'
export { KnowledgeIndexPipeline } from './engines/knowledge-index-pipeline.js'
export type {
  InferredManifest,
  ProviderManifest,
  ValidationResult,
} from './engines/manifest-inference.js'
export { ManifestInferenceEngine } from './engines/manifest-inference.js'
export { MemoryEngine } from './engines/memory-engine.js'
export type { MessagingArchetype, NormalizedMessage } from './engines/messaging-archetypes.js'
export { MESSAGING_ARCHETYPES } from './engines/messaging-archetypes.js'
export { getDefaultCommandPatterns } from './engines/nlcl/catalog.js'
export { CommandPatternRegistry } from './engines/nlcl/command-registry.js'
export {
  AppExecutor,
  BrowserExecutor,
  CapabilityExecutor,
  ConversationExecutor,
  EmailExecutor,
  FileExecutor,
  ProviderLLMExecutor,
  SystemExecutor,
} from './engines/nlcl/executors/index.js'
// Phase 25 additions
export {
  bindContext,
  coerceValues,
  extractParameters,
  LLMSlaveResolver,
  resolvePronouns,
  validateInput,
} from './engines/nlcl/index.js'
export type {
  LocalLLMAdapter,
  ProviderLLMAdapter,
} from './engines/nlcl/intent-resolver.js'
export {
  createResolver,
  DeterministicResolver,
  HybridResolver,
  LocalLLMResolver,
  ProviderLLMResolver,
} from './engines/nlcl/intent-resolver.js'
export { IntentRouter } from './engines/nlcl/intent-router.js'
export { NLCommandParser } from './engines/nlcl/nl-parser.js'
export type { NLCLEngineDeps } from './engines/nlcl/nlcl-engine.js'
// NLCL — Natural Language Command Layer (the "comms system")
export { NLCLEngine } from './engines/nlcl/nlcl-engine.js'
export type {
  CommandExecutor,
  CommandPattern,
  CommandResult,
  ExecutorId,
  IntentResolver,
  NLCContext,
  NLCLEngineConfig,
  NLPattern,
  ParsedIntent,
  ResolverConfig,
} from './engines/nlcl/types.js'
export { DEFAULT_NLCL_CONFIG } from './engines/nlcl/types.js'
export { ObjectiveEngine } from './engines/objective-engine.js'
// Phase 9: Observability
export * from './engines/observability/index.js'
export type { PlanValidationConfig, PlanValidationResult } from './engines/plan-validation-gate.js'
export { PlanValidationGate } from './engines/plan-validation-gate.js'
export type { ProviderPlugin } from './engines/plugin-hot-reload.js'
export { PluginHotReload } from './engines/plugin-hot-reload.js'
export type { P0PolicyEngineOptions } from './engines/policy-engine.js'
// P0 Alpha Hardening — Policy Engine (deterministic, kernel-scoped)
export { P0PolicyEngine } from './engines/policy-engine.js'
export type {
  AdapterErrorCode,
  AuthContext,
  ConversationArtifact,
  ConversationFull,
  ConversationHeader,
  ConversationMessage,
  PaginatedResult,
  ProviderConversationAdapter,
} from './engines/provider-conversation-adapter.js'
export { AdapterError } from './engines/provider-conversation-adapter.js'
export type {
  AccessibilityNode,
  DiscoveryOptions,
  DiscoverySession,
  DomMutationResult,
  DomSnapshot,
  InferredCapability,
  InteractiveElement,
  ManifestEdits,
  NetworkObservation,
  PageState,
  ProviderManifestDraft,
  RegisterResult,
  ShapeMatchResult,
} from './engines/provider-discovery.js'
export { ProviderDiscoveryEngine } from './engines/provider-discovery.js'
export { ProviderHealthKernel } from './engines/provider-health.js'
export { ProviderMuxEngine } from './engines/provider-mux.js'
export { ProviderRegistrar } from './engines/provider-registrar.js'
export type { HarnessOutcome } from './engines/provider-test-harness.js'
// Phase 6.10: Provider Test Harness
export { ProviderTestHarness } from './engines/provider-test-harness.js'
export type { ReferencePattern } from './engines/reference-grounding.js'
export { ReferenceGroundingEngine } from './engines/reference-grounding.js'
export { RegistrationAuditor } from './engines/registration-auditor.js'
export type { EmbeddingProvider } from './engines/semantic-search.js'
export { registerSendCaps } from './engines/send-capability.js'
export type { SessionDeps } from './engines/session-caps.js'
// Phase 29: Interactive Sessions
export { registerSessionCaps } from './engines/session-caps.js'
export { SessionCheckpointEngine } from './engines/session-checkpoint.js'
export type { DetectionInput, SituationSignal, TaskType } from './engines/situation-detector.js'
export { SituationDetector } from './engines/situation-detector.js'
export { StateTransitionEngine } from './engines/state-transition.js'
// Phase 11: Stealth Core
export * from './engines/stealth/index.js'
export { StreamBlockStore } from './engines/stream-block-store.js'
export { StreamParserEngine } from './engines/stream-parser.js'
// Phase 27: Streaming Channels
export { registerStreamingChannelCaps } from './engines/streaming-channel-caps.js'
export type { SyncConfig, SyncLogEntry, SyncPeer, SyncResult, SyncStore } from './engines/sync.js'
export { SyncEngine } from './engines/sync.js'
export { TelemetryAggregator } from './engines/telemetry-aggregator.js'
export type { AuditReport, NetworkCallRecord } from './engines/telemetry-audit.js'
export { TelemetryAudit } from './engines/telemetry-audit.js'
export type {
  CapabilityContext,
  CapabilitySurface,
  UnifiedCapability,
} from './engines/unified-registry.js'
// Phase 18: Composable Interface
export { UnifiedCapabilityRegistry } from './engines/unified-registry.js'
export { VersionManager } from './engines/version-manager.js'
export type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowExecution,
  WorkflowNode,
} from './engines/workflow-engine.js'
// Phase 28: Workflow Automation
export { WorkflowEngine } from './engines/workflow-engine.js'
export type { NewsletterOpts } from './engines/workflow-templates/newsletter.js'
export { buildNewsletterWorkflow } from './engines/workflow-templates/newsletter.js'
export type {
  BuiltinPanel,
  CanvasPanel,
  CanvasSpawner,
  PanelKind,
  PanelSpec,
  PresetId,
  WorkspaceLayoutRow,
  WorkspaceManager,
} from './engines/workspace-presets.js'
// Phase 4.2: Workspace Presets
export { WorkspacePresets } from './engines/workspace-presets.js'
export * from './errors.js'
// Executor
export { AsyncMutex } from './executor/async-mutex.js'
export { CircuitBreaker } from './executor/circuit-breaker.js'
export type { FleetConfig } from './executor/fleet-config.js'
export { deriveId, deriveSlaveId } from './executor/ids.js'
export * from './ids.js'
export { createDiscoveryMcpServer, DiscoveryMcpServer } from './mcp/server.js'
export type { DiscoveryServerContext } from './mcp/types.js'
// Router
export { Router } from './router/router.js'
export type { ActorRef, AgenticNodeType } from './schema/agentic.js'
export {
  AGENTIC_EDGE,
  AGENTIC_NODE_TYPES,
  actorDid,
  parseActorDid,
} from './schema/agentic.js'
// Schema barrel
export * from './schema/index.js'
export type { RepairMetadata } from './schema/repair-metadata.js'
export {
  getRepairMetadata,
  registerRepair,
  repairBoolean,
  repairNumber,
  repairString,
} from './schema/repair-metadata.js'
// ContentBlock re-exported from schema canon (executor/content-blocks is a compat shim)
export type { ContentBlock, ContentPart } from './schema/streaming.js'
export type { AgenticStoreContract } from './storage/contracts/agentic-store.js'
export type { Alert, AlertStore } from './storage/contracts/alert-store.js'
export type { Automation, AutomationStore } from './storage/contracts/automation-store.js'
export type { Channel, ChannelStore } from './storage/contracts/channel-store.js'
export type {
  DiscoveryObservationRow,
  DiscoverySessionRow,
  DiscoveryStore,
} from './storage/contracts/discovery-store.js'
export type {
  HarnessRepairStore,
  RepairSessionRow,
} from './storage/contracts/harness-repair-store.js'
export type { ShapeBindingRow, ShapeBindingStore } from './storage/contracts/shape-binding-store.js'
export type { CozoLayerOpts, CozoQueryResult, CozoScriptResult } from './storage/cozo/cozo-layer.js'
// Cozo graph + vector projection layer (ADR-014)
export {
  CozoLayer,
  CozoOpenError,
  GRAPH_TREES,
  getCozo,
  setCozo,
} from './storage/cozo/cozo-layer.js'
export { AgenticStoreImpl } from './storage/impl/agentic-store-impl.js'
export { AlertStoreImpl } from './storage/impl/alert-store-impl.js'
export { AutomationStoreImpl } from './storage/impl/automation-store-impl.js'
export { CapabilityMacroStoreImpl } from './storage/impl/capability-macro-store-impl.js'
export { InMemoryChannelStore } from './storage/impl/channel-store-impl.js'
// Phase 22: Agentic Discovery Tooling
export { DiscoveryStoreImpl } from './storage/impl/discovery-store-impl.js'
export { HarnessCheckpointStoreImpl } from './storage/impl/harness-checkpoint-store-impl.js'
export { HarnessRepairStoreImpl } from './storage/impl/harness-repair-store-impl.js'
export { HpeSessionStoreImpl } from './storage/impl/hpe-session-store-impl.js'
export { ShapeBindingStoreImpl } from './storage/impl/shape-binding-store-impl.js'
// Phase 21: Store Implementations
export { WorkflowStoreImpl } from './storage/impl/workflow-store-impl.js'
export { initPrismaWal } from './storage/prisma.js'
