// src/server/engines-catalog.ts
// Centralized catalog of all engine module definitions.
//
// WP-02: Module Lifecycle & Dependency Injection Enhancement
// This provides a single place to see all modules, their dependencies,
// and their tags. The actual bootstrap still happens in bootstrap-engines.ts;
// this catalog is infrastructure for future migration to a fully declarative
// boot path.
//
// Modules are grouped into four layers:
// 1. infra  — foundational services (db, event bus, config)
// 2. stores — data access implementations
// 3. engines — core business logic engines
// 4. services — higher-level orchestration (kernel, health, nlcl)

import type { ModuleDefinition } from './module-registry.js'

// ── Engine module catalog ────────────────────────────────────────────────

/**
 * Complete list of all engine module definitions.
 * Each definition describes a single module that can be bootstrapped
 * into the ServiceContainer via the ModuleRegistry.
 *
 * NOTE: The `create` factories use dynamic imports to avoid circular
 * dependencies at module load time — same pattern as bootstrap-engines.ts.
 */
export const ENGINE_MODULES: ModuleDefinition[] = [
  // ── Layer 1: Infrastructure ──────────────────────────────────────────
  {
    name: 'db',
    tags: ['infra', 'core'],
    create: async () => {
      const { getDb } = await import('../storage/db.js')
      return getDb()
    },
  },
  {
    name: 'eventBus',
    tags: ['infra', 'core'],
    create: () => {
      const { CapabilityEventBus } = require('../engines/capability-event-bus.js')
      return CapabilityEventBus.getInstance()
    },
  },

  // ── Layer 2: Stores ─────────────────────────────────────────────────
  {
    name: 'conversationStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { ConversationStoreImpl } = await import('../storage/impl/conversation-store-impl.js')
      return new ConversationStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'governorStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { GovernorStoreImpl } = await import('../storage/impl/governor-store-impl.js')
      return new GovernorStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'capabilityResolutionStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { CapabilityResolutionStoreImpl } = await import(
        '../storage/impl/capability-resolution-store-impl.js'
      )
      return new CapabilityResolutionStoreImpl(
        (deps.db as import('../storage/db.js').CapStoreDb).prisma as never,
      )
    },
  },
  {
    name: 'parserStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { ParserStoreImpl } = await import('../storage/impl/parser-store-impl.js')
      return new ParserStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'parserExecutionLogStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { ParserExecutionLogStoreImpl } = await import(
        '../storage/impl/parser-execution-log-store-impl.js'
      )
      return new ParserExecutionLogStoreImpl(
        (deps.db as import('../storage/db.js').CapStoreDb).prisma as never,
      )
    },
  },
  {
    name: 'contentUnitStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { ContentUnitStoreImpl } = await import('../storage/impl/content-unit-store-impl.js')
      return new ContentUnitStoreImpl(
        (deps.db as import('../storage/db.js').CapStoreDb).prisma as never,
      )
    },
  },
  {
    name: 'capabilityStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { CapabilityStoreImpl } = await import('../storage/impl/capability-store-impl.js')
      return new CapabilityStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'episodicMemoryStore',
    tags: ['store', 'memory'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { EpisodicMemoryStoreImpl } = await import(
        '../storage/impl/episodic-memory-store-impl.js'
      )
      return new EpisodicMemoryStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'semanticMemoryStore',
    tags: ['store', 'memory'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { SemanticMemoryStoreImpl } = await import(
        '../storage/impl/semantic-memory-store-impl.js'
      )
      return new SemanticMemoryStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'proceduralMemoryStore',
    tags: ['store', 'memory'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { ProceduralMemoryStoreImpl } = await import(
        '../storage/impl/procedural-memory-store-impl.js'
      )
      return new ProceduralMemoryStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'healthStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { HealthStoreImpl } = await import('../storage/impl/health-store-impl.js')
      return new HealthStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'providerStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
      return new ProviderStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'streamBlockStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { StreamBlockStore } = await import('../engines/stream-block-store.js')
      return new StreamBlockStore(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'sandboxAuditStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { SandboxAuditStoreImpl } = await import('../storage/impl/sandbox-audit-store-impl.js')
      return new SandboxAuditStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'nodeStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { NodeStoreImpl } = await import('../storage/impl/node-store-impl.js')
      return new NodeStoreImpl((deps.db as import('../storage/db.js').CapStoreDb).prisma as never)
    },
  },
  {
    name: 'autonomousStore',
    tags: ['store'],
    create: async () => {
      const { AutonomousStoreImpl } = await import('../storage/impl/autonomous-store-impl.js')
      return new AutonomousStoreImpl()
    },
  },
  {
    name: 'policyStore',
    tags: ['store'],
    create: async () => {
      const { PolicyStoreImpl } = await import('../storage/impl/policy-store-impl.js')
      return new PolicyStoreImpl()
    },
  },
  {
    name: 'costStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { CostStoreImpl } = await import('../storage/impl/cost-store-impl.js')
      return new CostStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'muxStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { MuxStoreImpl } = await import('../storage/impl/mux-store-impl.js')
      return new MuxStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'routerStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { RouterStoreImpl } = await import('../storage/impl/router-store-impl.js')
      return new RouterStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'containerStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { EntityContainerStoreImpl } = await import(
        '../storage/impl/entity-container-store-impl.js'
      )
      return new EntityContainerStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'contentStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { ContentItemStoreImpl } = await import('../storage/impl/content-item-store-impl.js')
      return new ContentItemStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'notificationStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { NotificationStoreImpl } = await import('../storage/impl/notification-store-impl.js')
      return new NotificationStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'contactStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { ContactStoreImpl } = await import('../storage/impl/contact-store-impl.js')
      return new ContactStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'syncStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { SyncStoreImpl } = await import('../storage/impl/sync-store-impl.js')
      return new SyncStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'mediaStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { MediaStoreImpl } = await import('../storage/impl/media-store-impl.js')
      return new MediaStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'knowledgeIngestionStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { KnowledgeIngestionStoreImpl } = await import(
        '../storage/impl/knowledge-ingestion-store-impl.js'
      )
      return new KnowledgeIngestionStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'knowledgeExtractorStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { KnowledgeExtractorStoreImpl } = await import(
        '../storage/impl/knowledge-extractor-store-impl.js'
      )
      return new KnowledgeExtractorStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'semanticSearchStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { SemanticSearchStoreImpl } = await import(
        '../storage/impl/semantic-search-store-impl.js'
      )
      return new SemanticSearchStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'crossConversationSynthStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { CrossConversationSynthesizerStoreImpl } = await import(
        '../storage/impl/cross-conversation-synth-store-impl.js'
      )
      return new CrossConversationSynthesizerStoreImpl(
        deps.db as import('../storage/db.js').CapStoreDb,
      )
    },
  },
  {
    name: 'localAgentStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { LocalAgentStoreImpl } = await import('../storage/impl/local-agent-store-impl.js')
      return new LocalAgentStoreImpl(deps.db as import('../storage/db.js').CapStoreDb)
    },
  },
  {
    name: 'stealthStore',
    tags: ['store'],
    dependsOn: ['db'],
    create: async (deps) => {
      const { PrismaStealthStore } = await import('../storage/impl/stealth-store-impl.js')
      return new PrismaStealthStore(
        (deps.db as import('../storage/db.js').CapStoreDb).prisma as never,
      )
    },
  },

  // ── Layer 3: Engines ────────────────────────────────────────────────
  {
    name: 'resolutionEngine',
    tags: ['engine'],
    dependsOn: ['capabilityResolutionStore'],
    create: async (deps) => {
      const { CapabilityResolutionEngine } = await import('../engines/capability-resolution.js')
      return new CapabilityResolutionEngine(deps.capabilityResolutionStore)
    },
  },
  {
    name: 'sandboxRunner',
    tags: ['engine'],
    dependsOn: ['sandboxAuditStore'],
    create: async (deps) => {
      const { SandboxRunner } = await import('../engines/sandbox-runner.js')
      return new SandboxRunner(deps.sandboxAuditStore)
    },
  },
  {
    name: 'parserEngine',
    tags: ['engine'],
    dependsOn: ['parserStore', 'sandboxRunner', 'parserExecutionLogStore'],
    create: async (deps) => {
      const { StreamParserEngine } = await import('../engines/stream-parser.js')
      return new StreamParserEngine(
        deps.parserStore,
        undefined,
        deps.sandboxRunner,
        deps.parserExecutionLogStore,
      )
    },
  },
  {
    name: 'memoryEngine',
    tags: ['engine', 'memory'],
    dependsOn: ['episodicMemoryStore', 'semanticMemoryStore', 'proceduralMemoryStore', 'eventBus'],
    create: async (deps) => {
      const { MemoryEngine } = await import('../engines/memory-engine.js')
      return new MemoryEngine(
        deps.episodicMemoryStore,
        deps.semanticMemoryStore,
        deps.proceduralMemoryStore,
        deps.eventBus,
      )
    },
  },
  {
    name: 'governor',
    tags: ['engine', 'core'],
    dependsOn: ['governorStore', 'stealthStore'],
    create: async (deps) => {
      const { ChromeGovernor } = await import('../engines/chrome-governor.js')
      const { config } = await import('../config.js')
      return new ChromeGovernor(
        deps.governorStore,
        {
          portRange: [9300, 9400],
          healthProbeIntervalMs: 30_000,
          healthProbeTimeoutMs: 5_000,
          autoRestart: true,
          maxRestarts: 3,
          circuitBreakerThreshold: 5,
          circuitBreakerResetMs: 60_000,
          profileBaseDir: config.profileBaseDir,
        },
        undefined,
        undefined,
        undefined,
        deps.stealthStore,
      )
    },
    lifecycle: {
      start: async (instance) => {
        await (instance as import('../engines/chrome-governor.js').ChromeGovernor).boot()
      },
      stop: async (instance) => {
        await (instance as import('../engines/chrome-governor.js').ChromeGovernor).killAll()
      },
    },
  },
  {
    name: 'conversationManager',
    tags: ['engine', 'core'],
    dependsOn: [
      'governor',
      'resolutionEngine',
      'parserEngine',
      'streamBlockStore',
      'conversationStore',
      'eventBus',
      'memoryEngine',
      'nodeStore',
      'contentUnitStore',
    ],
    create: async (deps) => {
      const { ConversationManager } = await import('../engines/conversation-manager.js')
      return new ConversationManager(
        deps.governor,
        deps.resolutionEngine,
        deps.parserEngine,
        deps.streamBlockStore,
        deps.conversationStore,
        deps.eventBus,
        undefined as unknown as import('../engines/execution-memoizer.js').ExecutionMemoizer, // memoizer
        deps.memoryEngine,
        undefined,
        undefined,
        deps.nodeStore,
        deps.contentUnitStore,
        undefined, // memoryFabric
      )
    },
  },
  {
    name: 'knowledgeExtractor',
    tags: ['engine'],
    dependsOn: ['knowledgeExtractorStore'],
    create: async (deps) => {
      const { KnowledgeExtractor } = await import('../engines/knowledge-extractor.js')
      return new KnowledgeExtractor(deps.knowledgeExtractorStore, {
        batchSize: 50,
        confidenceThreshold: 0.3,
        enableEntityExtraction: true,
        enableDecisionExtraction: true,
        enablePatternMining: false,
      })
    },
  },
  {
    name: 'knowledgeIngestion',
    tags: ['engine'],
    dependsOn: [
      'knowledgeIngestionStore',
      'conversationStore',
      'streamBlockStore',
      'knowledgeExtractor',
      'eventBus',
    ],
    create: async (deps) => {
      const { KnowledgeIngestionEngine } = await import('../engines/knowledge-ingestion.js')
      return new KnowledgeIngestionEngine(
        deps.knowledgeIngestionStore,
        deps.conversationStore,
        deps.streamBlockStore,
        deps.knowledgeExtractor,
        deps.eventBus,
      )
    },
  },
  {
    name: 'costOptimizer',
    tags: ['engine'],
    dependsOn: ['costStore'],
    create: async (deps) => {
      const { CostOptimizer } = await import('../engines/cost-optimizer.js')
      return new CostOptimizer(deps.costStore)
    },
  },
  {
    name: 'providerMux',
    tags: ['engine'],
    dependsOn: ['muxStore', 'conversationManager', 'routerStore', 'eventBus'],
    create: async (deps) => {
      const { ProviderMuxEngine } = await import('../engines/provider-mux.js')
      const { Router } = await import('../router/router.js')
      const noopDispatcher = { dispatch: async () => ({ ok: true }) }
      const router = new Router(deps.routerStore, noopDispatcher)
      return new ProviderMuxEngine(
        deps.muxStore,
        undefined as unknown as import('../engines/provider-mux.js').MuxDispatcher,
        router,
        deps.eventBus,
      )
    },
  },
  {
    name: 'capabilityRegistry',
    tags: ['engine'],
    create: async () => {
      const { UnifiedCapabilityRegistry } = await import('../engines/unified-registry.js')
      return new UnifiedCapabilityRegistry()
    },
  },
  {
    name: 'policyEngine',
    tags: ['engine'],
    dependsOn: ['policyStore'],
    create: async (deps) => {
      const { ExecutionPolicyEngine } = await import('../engines/execution-policy.js')
      return new ExecutionPolicyEngine(deps.policyStore)
    },
    lifecycle: {
      init: async (instance) => {
        await (
          instance as import('../engines/execution-policy.js').ExecutionPolicyEngine
        ).initialize()
      },
    },
  },
  {
    name: 'autonomousEngine',
    tags: ['engine'],
    dependsOn: ['autonomousStore', 'capabilityRegistry', 'policyEngine', 'governor', 'eventBus'],
    create: async (deps) => {
      const { AutonomousExecutionEngine } = await import('../engines/autonomous-execution.js')
      return new AutonomousExecutionEngine(
        deps.autonomousStore,
        deps.capabilityRegistry,
        deps.policyEngine,
        deps.governor,
        deps.eventBus,
      )
    },
  },

  // ── Layer 4: Services ───────────────────────────────────────────────
  {
    name: 'automationOrchestrator',
    tags: ['service'],
    dependsOn: ['governor'],
    create: async (deps) => {
      const { AutomationOrchestrator } = await import('../engines/automation/orchestrator.js')
      return new AutomationOrchestrator(deps.governor)
    },
  },
  {
    name: 'nlclEngine',
    tags: ['service', 'core'],
    dependsOn: [
      'governor',
      'automationOrchestrator',
      'conversationManager',
      'conversationStore',
      'capabilityRegistry',
      'db',
    ],
    create: async (deps) => {
      const { NLCLEngine } = await import('../engines/nlcl/nlcl-engine.js')
      return new NLCLEngine({
        governor: deps.governor,
        automationOrchestrator: deps.automationOrchestrator,
        conversationManager: deps.conversationManager,
        conversationStore: deps.conversationStore,
        registry: deps.capabilityRegistry,
        db: deps.db,
      })
    },
  },
  {
    name: 'kernel',
    tags: ['service', 'core'],
    dependsOn: [
      'eventBus',
      'governor',
      'conversationManager',
      'capabilityRegistry',
      'nlclEngine',
      'db',
    ],
    create: async (deps) => {
      const { bootstrapKernel } = await import('../engines/kernel/kernel-bootstrap.js')
      return bootstrapKernel({
        eventBus: deps.eventBus,
        governor: deps.governor,
        conversationManager: deps.conversationManager,
        registry: deps.capabilityRegistry,
        nlclEngine: deps.nlclEngine,
        db: deps.db,
      })
    },
    lifecycle: {
      start: async (instance) => {
        await (instance as import('../engines/kernel/kernel-context.js').Kernel).start()
      },
      stop: async (instance) => {
        await (instance as import('../engines/kernel/kernel-context.js').Kernel).stop()
      },
    },
  },
  {
    name: 'healthKernel',
    tags: ['service'],
    dependsOn: ['governor', 'healthStore', 'eventBus'],
    create: async (deps) => {
      const { ProviderHealthKernel } = await import('../engines/provider-health.js')
      return new ProviderHealthKernel({
        governor: deps.governor,
        store: deps.healthStore,
        eventBus: deps.eventBus,
        intervalMs: 30_000,
      })
    },
    lifecycle: {
      start: async (instance) => {
        ;(instance as import('../engines/provider-health.js').ProviderHealthKernel).start()
      },
      stop: async (instance) => {
        ;(instance as import('../engines/provider-health.js').ProviderHealthKernel).stop()
      },
    },
  },
  {
    name: 'lockManager',
    tags: ['service', 'reliability'],
    create: async () => {
      const { LockManager } = await import('../engines/lock-manager.js')
      return new LockManager()
    },
  },
  {
    name: 'idempotencyGuard',
    tags: ['service', 'reliability'],
    create: async () => {
      const { IdempotencyGuard } = await import('../engines/idempotency-guard.js')
      return new IdempotencyGuard()
    },
  },
  {
    name: 'retryEngine',
    tags: ['service', 'reliability'],
    create: async () => {
      const { RetryEngine } = await import('../engines/retry-engine.js')
      return new RetryEngine()
    },
  },
  {
    name: 'onboardingOrchestrator',
    tags: ['service'],
    dependsOn: ['governor', 'db'],
    create: async (deps) => {
      const { ProviderOnboardingOrchestrator } = await import(
        '../engines/onboarding/provider-onboarding-orchestrator.js'
      )
      const governor = deps.governor as import('../engines/chrome-governor.js').ChromeGovernor
      const db = deps.db as import('../storage/db.js').CapStoreDb

      const { OnboardingSessionStoreImpl } = await import(
        '../storage/impl/onboarding/onboarding-session-store-impl.js'
      )
      const { WebAppTaxonomyStoreImpl } = await import(
        '../storage/impl/onboarding/webapp-taxonomy-store-impl.js'
      )
      const { ProtocolFingerprintStoreImpl } = await import(
        '../storage/impl/onboarding/protocol-fingerprint-store-impl.js'
      )
      const { DiscoveredDomEntityStoreImpl } = await import(
        '../storage/impl/onboarding/discovered-dom-entity-store-impl.js'
      )
      const { ParserCandidateStoreImpl } = await import(
        '../storage/impl/onboarding/parser-candidate-store-impl.js'
      )
      const { CapabilityBindingStoreImpl } = await import(
        '../storage/impl/onboarding/capability-binding-store-impl.js'
      )

      return new ProviderOnboardingOrchestrator({
        handleProvider: {
          getHandle: (slaveId: string) => ({
            slaveId,
            send: (method: string, params?: Record<string, unknown>) =>
              governor.cdp.send(slaveId, method, params),
            evaluate: async <T>(expression: string): Promise<T> => {
              const result = (await governor.cdp.send(slaveId, 'Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true,
              })) as { result?: { value?: T } }
              return result.result?.value as T
            },
          }),
        },
        sessions: new OnboardingSessionStoreImpl(db),
        taxonomyStore: new WebAppTaxonomyStoreImpl(db),
        protocolFingerprintStore: new ProtocolFingerprintStoreImpl(db),
        entityStore: new DiscoveredDomEntityStoreImpl(db),
        parserCandidateStore: new ParserCandidateStoreImpl(db),
        bindingStore: new CapabilityBindingStoreImpl(db),
        captureEvents: () =>
          Promise.resolve(
            [] as import('../engines/onboarding/webapp-fingerprint.js').NetworkEvent[],
          ),
      })
    },
  },
]

// ── Tag-based helpers ────────────────────────────────────────────────────

/**
 * Get all module definitions that have the given tag.
 */
export function getModulesByTag(tag: string): ModuleDefinition[] {
  return ENGINE_MODULES.filter((m) => m.tags.includes(tag))
}

/**
 * Get module names grouped by their primary layer tag.
 * Useful for debugging and health-check endpoints.
 */
export function getModulesByLayer(): Record<string, string[]> {
  const layers: Record<string, string[]> = {}
  for (const def of ENGINE_MODULES) {
    // Use the first non-'core' tag as the layer, or fall back to the first tag
    const layer = def.tags.find((t) => t !== 'core') ?? def.tags[0]!
    if (!layers[layer]) layers[layer] = []
    layers[layer]?.push(def.name)
  }
  return layers
}
