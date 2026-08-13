// src/server/bootstrap/context.ts
// Shared mutable context threaded through the boot phase pipeline. Each phase
// reads what it needs and writes what it creates; the orchestrator's phase list
// IS the dependency order. `BootstrapEnginesResult` is the fixed public shape
// returned once all phases complete.

import type { ProviderRegistry } from '../../config/provider-registry.js'
import { CapabilityEventBus } from '../../engines/capability-event-bus.js'
import type { CapabilityResolutionEngine } from '../../engines/capability-resolution.js'
import type { ChromeGovernor } from '../../engines/chrome-governor.js'
import type { ConceptualModelService } from '../../engines/conceptual-model-service.js'
import type { ConversationManager } from '../../engines/conversation-manager.js'
import type { CostOptimizer } from '../../engines/cost-optimizer.js'
import type { CrossConversationSynthesizer } from '../../engines/cross-conversation-synthesis.js'
import type { ExportEngine } from '../../engines/export.js'
import type { IdempotencyGuard } from '../../engines/idempotency-guard.js'
import type { Kernel } from '../../engines/kernel/kernel-context.js'
import type { KnowledgeIngestionEngine } from '../../engines/knowledge-ingestion.js'
import type { LockManager } from '../../engines/lock-manager.js'
import type { NLCLEngine } from '../../engines/nlcl/nlcl-engine.js'
import type { OutcomeTracker } from '../../engines/outcome-tracker.js'
import type { ProviderHealthKernel } from '../../engines/provider-health.js'
import type { ProviderMuxEngine } from '../../engines/provider-mux.js'
import type { ProviderRegistrar } from '../../engines/provider-registrar.js'
import type { RetryEngine } from '../../engines/retry-engine.js'
import type { SemanticSearchEngine } from '../../engines/semantic-search.js'
import type { UnifiedCapabilityRegistry } from '../../engines/unified-registry.js'
import type { UserIdentityEngine } from '../../engines/user-identity.js'
import type { CdpTransportImpl } from '../../executor/cdp-transport.js'
import type { CapStoreDb } from '../../storage/db.js'
import type { CapabilityStoreImpl } from '../../storage/impl/capability-store-impl.js'
import type { ConversationStoreImpl } from '../../storage/impl/conversation-store-impl.js'
import type { EntityContainerStoreImpl } from '../../storage/impl/entity-container-store-impl.js'
import type { ProviderStoreImpl } from '../../storage/impl/provider-store-impl.js'

/** Everything produced by any boot phase; phases fill in the fields they own. */
export interface BootstrapContext {
  port: number
  db: CapStoreDb
  eventBus: CapabilityEventBus

  // Phase: seeds
  providerStore?: ProviderStoreImpl
  registrar?: ProviderRegistrar
  providerRegistry?: ProviderRegistry

  // Phase: stores + core engines
  capabilityStore?: CapabilityStoreImpl
  convStore?: ConversationStoreImpl
  resolutionEngine?: CapabilityResolutionEngine
  parserEngine?: import('../../engines/stream-parser.js').StreamParserEngine
  streamBlocks?: import('../../engines/stream-block-store.js').StreamBlockStore
  memoryEngine?: import('../../engines/memory-engine.js').MemoryEngine

  // Phase: governor
  governor?: ChromeGovernor
  conversationManager?: ConversationManager
  cdpTransport?: CdpTransportImpl

  // Phase: knowledge/export (optional)
  knowledgeIngestion?: KnowledgeIngestionEngine
  semanticSearch?: SemanticSearchEngine
  synthesizer?: CrossConversationSynthesizer
  exportEngine?: ExportEngine
  /** #5: Embedding provider — constructed in knowledge phase, used by MemoryFabric. */
  embeddingProvider?: import('../../engines/semantic-search.js').EmbeddingProvider

  // Phase: mux/cost (optional)
  providerMux?: ProviderMuxEngine
  costOptimizer?: CostOptimizer

  // Phase: outcome tracking (§7 — adaptive scoring foundation)
  outcomeTracker?: OutcomeTracker

  // Phase: capabilities + autonomous
  autonomousEngine?: import('../../engines/autonomous-execution.js').AutonomousExecutionEngine
  policyEngine?: import('../../engines/execution-policy.js').ExecutionPolicyEngine
  registry?: UnifiedCapabilityRegistry
  relocationEngine?: import('../../engines/storage-relocation-engine.js').StorageRelocationEngine
  memoryFabric?: import('../../engines/memory/memory-fabric.js').MemoryFabric
  agentBuilder?: import('../../engines/agent-builder.js').AgentBuilderEngine
  /** #2: HarnessRepairEngine — Zod-aware JSON repair for LLM output. */
  harnessRepair?: import('../../engines/harness-repair-engine.js').HarnessRepairEngine

  // Phase: lifecycle
  nlclEngine?: NLCLEngine
  automationOrchestrator?: import('../../engines/automation/orchestrator.js').AutomationOrchestrator
  kernel?: Kernel
  healthKernel?: ProviderHealthKernel
  lockManager?: LockManager
  idempotencyGuard?: IdempotencyGuard
  retryEngine?: RetryEngine

  // Phase: routers-facing stores
  nodeStore?: import('../../storage/contracts/node-store.js').NodeStoreContract
  containerStore?: EntityContainerStoreImpl
  contentStore?: import('../../storage/impl/content-item-store-impl.js').ContentItemStoreImpl
  notificationStore?: import('../../storage/impl/notification-store-impl.js').NotificationStoreImpl
  contactStore?: import('../../storage/impl/contact-store-impl.js').ContactStoreImpl
  syncStore?: import('../../storage/impl/sync-store-impl.js').SyncStoreImpl
  mediaStore?: import('../../storage/impl/media-store-impl.js').MediaStoreImpl
  collectionEngine?: import('../../engines/collection-engine.js').CollectionEngine
  lifecycleEngine?: import('../../engines/lifecycle-engine.js').LifecycleEngine
  compactionManager?: import('../../engines/compaction-manager.js').CompactionManager
  backupManager?: import('../../engines/backup-manager.js').BackupManager

  // Optional engines surfaced on the result but not always present
  conceptualModel?: ConceptualModelService
  userIdentity?: UserIdentityEngine
}

/** The fixed public shape produced by a completed boot. */
export interface BootstrapEnginesResult {
  db: CapStoreDb
  eventBus: CapabilityEventBus
  convStore: ConversationStoreImpl
  governor: ChromeGovernor
  conversationManager: ConversationManager
  resolutionEngine: CapabilityResolutionEngine
  parserEngine: import('../../engines/stream-parser.js').StreamParserEngine
  streamBlocks: import('../../engines/stream-block-store.js').StreamBlockStore
  memoryEngine: import('../../engines/memory-engine.js').MemoryEngine
  memoryFabric?: import('../../engines/memory/memory-fabric.js').MemoryFabric
  agentBuilder?: import('../../engines/agent-builder.js').AgentBuilderEngine
  knowledgeIngestion?: KnowledgeIngestionEngine
  semanticSearch?: SemanticSearchEngine
  synthesizer?: CrossConversationSynthesizer
  exportEngine?: ExportEngine
  providerMux?: ProviderMuxEngine
  costOptimizer?: CostOptimizer
  outcomeTracker?: OutcomeTracker
  autonomousEngine?: import('../../engines/autonomous-execution.js').AutonomousExecutionEngine
  policyEngine?: import('../../engines/execution-policy.js').ExecutionPolicyEngine
  registry: UnifiedCapabilityRegistry
  nlclEngine: NLCLEngine
  automationOrchestrator: import('../../engines/automation/orchestrator.js').AutomationOrchestrator
  kernel: Kernel
  healthKernel: ProviderHealthKernel
  lockManager: LockManager
  idempotencyGuard: IdempotencyGuard
  retryEngine: RetryEngine
  conceptualModel?: ConceptualModelService
  userIdentity?: UserIdentityEngine
  relocationEngine?: import('../../engines/storage-relocation-engine.js').StorageRelocationEngine
  nodeStore: import('../../storage/contracts/node-store.js').NodeStoreContract
  containerStore: EntityContainerStoreImpl
  contentStore: import('../../storage/impl/content-item-store-impl.js').ContentItemStoreImpl
  notificationStore: import('../../storage/impl/notification-store-impl.js').NotificationStoreImpl
  contactStore: import('../../storage/impl/contact-store-impl.js').ContactStoreImpl
  syncStore: import('../../storage/impl/sync-store-impl.js').SyncStoreImpl
  mediaStore: import('../../storage/impl/media-store-impl.js').MediaStoreImpl
  collectionEngine?: import('../../engines/collection-engine.js').CollectionEngine
  lifecycleEngine?: import('../../engines/lifecycle-engine.js').LifecycleEngine
  compactionManager?: import('../../engines/compaction-manager.js').CompactionManager
  backupManager?: import('../../engines/backup-manager.js').BackupManager
}

/** Create an empty context. Phases fill it; the orchestrator resolves it. */
export function createBootstrapContext(port: number): BootstrapContext {
  // The event bus is a process-wide singleton and the one engine every phase
  // depends on — seed it here so `ctx.eventBus` is never undefined.
  return { port, eventBus: CapabilityEventBus.getInstance() } as BootstrapContext
}
