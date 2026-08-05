// src/server/bootstrap-engines.ts
// Engine wiring extracted from createServerWithEngines in index.ts.
// Creates all stores, engines, and capability registrations.

import { connectCapabilityRegistry } from '../cli/index.js'
import { config } from '../config.js'
import { registerGeneratedCapabilities } from '../engines/capability-bootstrap-generated.js'
import {
  registerDefaultCapabilities,
  registerNlInterpretCapability,
} from '../engines/capability-bootstrap.js'
import { CapabilityEventBus } from '../engines/capability-event-bus.js'
import type { CapabilityResolutionEngine } from '../engines/capability-resolution.js'
import {
  type CdpBindingStore,
  registerDiscoveredCdpMethods,
} from '../engines/cdp-capability-registrar.js'
import { CDP_PROTOCOL_CATALOG } from '../engines/cdp-discovery.js'
import type { ChromeGovernor } from '../engines/chrome-governor.js'
import type { ConceptualModelService } from '../engines/conceptual-model-service.js'
import type { ConversationManager } from '../engines/conversation-manager.js'
import type { CostOptimizer } from '../engines/cost-optimizer.js'
import type { CrossConversationSynthesizer } from '../engines/cross-conversation-synthesis.js'
import type { ExportEngine } from '../engines/export.js'
import type { IdempotencyGuard } from '../engines/idempotency-guard.js'
import { bootstrapKernel } from '../engines/kernel/kernel-bootstrap.js'
import type { Kernel } from '../engines/kernel/kernel-context.js'
import type { KnowledgeIngestionEngine } from '../engines/knowledge-ingestion.js'
import type { LockManager } from '../engines/lock-manager.js'
import { NLCLEngine } from '../engines/nlcl/nlcl-engine.js'
import type { ProviderHealthKernel } from '../engines/provider-health.js'
import type { ProviderMuxEngine } from '../engines/provider-mux.js'
import type { RetryEngine } from '../engines/retry-engine.js'
import type { EmbeddingProvider, SemanticSearchEngine } from '../engines/semantic-search.js'
import { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import type { UserIdentityEngine } from '../engines/user-identity.js'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import { type CapStoreDb, getDb } from '../storage/db.js'
import { runIndividualSeeds } from './bootstrap-seeds.js'
import { onShutdown } from './index.js'
import { bootOnboardingPipeline } from './onboarding-boot.js'

const log = getLogger('bootstrap-engines')

/** All engine instances created during bootstrap. */
export interface BootstrapEnginesResult {
  db: CapStoreDb
  eventBus: CapabilityEventBus
  convStore: import('../storage/impl/conversation-store-impl.js').ConversationStoreImpl
  governor: ChromeGovernor
  conversationManager: ConversationManager
  resolutionEngine: CapabilityResolutionEngine
  parserEngine: import('../engines/stream-parser.js').StreamParserEngine
  streamBlocks: import('../engines/stream-block-store.js').StreamBlockStore
  memoryEngine: import('../engines/memory-engine.js').MemoryEngine
  memoryFabric?: import('../engines/memory/memory-fabric.js').MemoryFabric
  agentBuilder?: import('../engines/agent-builder.js').AgentBuilderEngine
  knowledgeIngestion?: KnowledgeIngestionEngine
  semanticSearch?: SemanticSearchEngine
  synthesizer?: CrossConversationSynthesizer
  exportEngine?: ExportEngine
  providerMux?: ProviderMuxEngine
  costOptimizer?: CostOptimizer
  autonomousEngine?: import('../engines/autonomous-execution.js').AutonomousExecutionEngine
  policyEngine?: import('../engines/execution-policy.js').ExecutionPolicyEngine
  registry: UnifiedCapabilityRegistry
  nlclEngine: NLCLEngine
  automationOrchestrator: import('../engines/automation/orchestrator.js').AutomationOrchestrator
  kernel: Kernel
  healthKernel: ProviderHealthKernel
  lockManager: LockManager
  idempotencyGuard: IdempotencyGuard
  retryEngine: RetryEngine
  conceptualModel?: ConceptualModelService
  userIdentity?: UserIdentityEngine
  relocationEngine?: import('../engines/storage-relocation-engine.js').StorageRelocationEngine
  nodeStore: import('../storage/contracts/node-store.js').NodeStoreContract
  containerStore: import('../storage/impl/entity-container-store-impl.js').EntityContainerStoreImpl
  contentStore: import('../storage/impl/content-item-store-impl.js').ContentItemStoreImpl
  notificationStore: import('../storage/impl/notification-store-impl.js').NotificationStoreImpl
  contactStore: import('../storage/impl/contact-store-impl.js').ContactStoreImpl
  syncStore: import('../storage/impl/sync-store-impl.js').SyncStoreImpl
  mediaStore: import('../storage/impl/media-store-impl.js').MediaStoreImpl
}

/**
 * Bootstrap all engines — creates stores, engines, capability registrations,
 * and returns a fully-wired context ready for router mounting.
 */
export async function bootstrapEngines(port: number): Promise<BootstrapEnginesResult> {
  const db = getDb()
  const eventBus = CapabilityEventBus.getInstance()

  // Lazy-import engine classes to avoid circular deps at module load
  const { ConversationManager } = await import('../engines/conversation-manager.js')
  const { CapabilityResolutionEngine } = await import('../engines/capability-resolution.js')
  const { ChromeGovernor } = await import('../engines/chrome-governor.js')
  const { StreamParserEngine } = await import('../engines/stream-parser.js')
  const { SandboxRunner } = await import('../engines/sandbox-runner.js')
  const { SandboxAuditStoreImpl } = await import('../storage/impl/sandbox-audit-store-impl.js')
  const { StreamBlockStore } = await import('../engines/stream-block-store.js')
  const { NodeStoreImpl } = await import('../storage/impl/node-store-impl.js')
  const { ExecutionMemoizer } = await import('../engines/execution-memoizer.js')
  const { MemoryEngine } = await import('../engines/memory-engine.js')
  const { ConversationStoreImpl } = await import('../storage/impl/conversation-store-impl.js')
  const { GovernorStoreImpl } = await import('../storage/impl/governor-store-impl.js')
  const { CapabilityResolutionStoreImpl } = await import(
    '../storage/impl/capability-resolution-store-impl.js'
  )
  const { ParserStoreImpl } = await import('../storage/impl/parser-store-impl.js')
  const { ParserExecutionLogStoreImpl } = await import(
    '../storage/impl/parser-execution-log-store-impl.js'
  )
  const { ContentUnitStoreImpl } = await import('../storage/impl/content-unit-store-impl.js')
  const { CapabilityStoreImpl } = await import('../storage/impl/capability-store-impl.js')
  const { CapabilitySnapshot } = await import('../engines/capability-snapshot.js')
  const { EpisodicMemoryStoreImpl } = await import('../storage/impl/episodic-memory-store-impl.js')
  const { SemanticMemoryStoreImpl } = await import('../storage/impl/semantic-memory-store-impl.js')
  const { ProceduralMemoryStoreImpl } = await import(
    '../storage/impl/procedural-memory-store-impl.js'
  )

  // ── Boot seeds (skip if already seeded; FORCE_SEED env to re-run) ────
  const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
  const { ProviderRegistrar } = await import('../engines/provider-registrar.js')
  const providerStore = new ProviderStoreImpl(db)
  const registrar = new ProviderRegistrar(providerStore, undefined, eventBus)

  let needsSeed: boolean
  if (process.env.FORCE_SEED) {
    needsSeed = true
  } else {
    try {
      needsSeed = (await db.prisma.providerDefinition.count()) === 0
    } catch (err: unknown) {
      // P2021 = "no such table" — DB exists but schema wasn't applied
      const code = (err as { code?: string })?.code
      if (code === 'P2021') {
        log.warn('DB schema not applied (P2021) — will attempt snapshot restore')
        needsSeed = true
      } else {
        throw err
      }
    }
  }

  if (needsSeed) {
    // ── Snapshot auto-restore: if snapshot exists and FORCE_SEED is not set,
    //    copy snapshot → dbPath instead of running individual seeds ──────────
    const forceSeed = !!process.env.FORCE_SEED
    if (!forceSeed) {
      const { existsSync, copyFileSync, mkdirSync } = await import('node:fs')
      const { join, dirname } = await import('node:path')
      const snapshotPath = join(process.cwd(), 'seeds', 'seed-snapshot.db')
      const dbTarget = config.dbPath
      if (existsSync(snapshotPath)) {
        const { closePrisma } = await import('../storage/prisma.js')
        log.info('Restoring from seed snapshot — closing DB...')
        await closePrisma()
        // Ensure target directory exists
        mkdirSync(dirname(dbTarget), { recursive: true })
        copyFileSync(snapshotPath, dbTarget)
        log.info('Snapshot copied — reopening DB...')
        // Reopen DB: clear singleton and re-get
        const { setDb } = await import('../storage/db.js')
        setDb(null as never)
        const freshDb = getDb()
        // Re-initialize provider store with fresh DB connection
        const freshProviderStore = new ProviderStoreImpl(freshDb)
        const freshRegistrar = new ProviderRegistrar(freshProviderStore, undefined, eventBus)
        // Update local references for downstream use
        Object.assign(providerStore, freshProviderStore)
        Object.assign(registrar, freshRegistrar)
        // Update the db variable's prisma reference (readonly property override)
        Object.defineProperty(db, 'prisma', { value: freshDb.prisma, writable: false })
        log.info('DB restored from seed snapshot')
        // Skip individual seeds — snapshot is fully seeded
      } else {
        log.warn(`Snapshot not found at ${snapshotPath} — running individual seeds`)
        await runIndividualSeeds(db, registrar, providerStore, log)
      }
    } else {
      await runIndividualSeeds(db, registrar, providerStore, log)
    }
  } else {
    log.info('DB already seeded — skipping boot seeds (set FORCE_SEED=true to re-run)')
  }

  // Initialize provider registry cache (loads all provider data from DB)
  const { createProviderRegistry } = await import('../config/provider-registry.js')
  const providerRegistry = createProviderRegistry(db)
  await providerRegistry.initialize()
  log.info({ count: providerRegistry.getProviderList().length }, 'Provider registry initialized')

  // Store instances
  const convStore = new ConversationStoreImpl(db)
  const govStore = new GovernorStoreImpl(db)
  const resStore = new CapabilityResolutionStoreImpl(db.prisma as never)
  const parserStore = new ParserStoreImpl(db)
  const parserExecLogStore = new ParserExecutionLogStoreImpl(db.prisma as never)
  const contentUnitStore = new ContentUnitStoreImpl(db.prisma as never)
  const capabilityStore = new CapabilityStoreImpl(db)
  const episodicStore = new EpisodicMemoryStoreImpl(db)
  const semanticStore = new SemanticMemoryStoreImpl(db)
  const proceduralStore = new ProceduralMemoryStoreImpl(db)

  // Engine instances
  const resolutionEngine = new CapabilityResolutionEngine(resStore)
  const sandboxRunner = new SandboxRunner(new SandboxAuditStoreImpl(db))
  const parserEngine = new StreamParserEngine(
    parserStore,
    undefined,
    sandboxRunner,
    parserExecLogStore,
  )
  const streamBlocks = new StreamBlockStore(db)

  // Prime parser cache from the generated protocol so the hot parse path does
  // ZERO DB reads. Falls back to the DB resolver chain if a module is missing.
  try {
    const { loadProviderProtocol, normalizeProtocolSource } = await import(
      '../engines/provider-protocol-loader.js'
    )
    const source = normalizeProtocolSource(config.providerProtocolSource)
    const { protocol } = await loadProviderProtocol(source)
    await parserEngine.primeFromProtocol(protocol)
    log.info({ source }, 'Stream parser cache primed from protocol')
  } catch (err) {
    log.warn({ err }, 'Protocol parser priming skipped')
  }

  const memoizer = new ExecutionMemoizer()
  const memoryEngine = new MemoryEngine(episodicStore, semanticStore, proceduralStore, eventBus)

  // ── Stealth store (unified) ───────────────────────────────────────────
  const { PrismaStealthStore } = await import('../storage/impl/stealth-store-impl.js')
  const stealthStore = new PrismaStealthStore(db.prisma as never)

  const governor = new ChromeGovernor(
    govStore,
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
    stealthStore,
  )

  let memoryFabric: import('../engines/memory/memory-fabric.js').MemoryFabric | undefined
  let agentBuilder: import('../engines/agent-builder.js').AgentBuilderEngine | undefined

  const conversationManager = new ConversationManager(
    governor,
    resolutionEngine,
    parserEngine,
    streamBlocks,
    convStore,
    eventBus,
    memoizer,
    memoryEngine,
    undefined,
    undefined,
    new NodeStoreImpl(db.prisma as never),
    contentUnitStore,
    memoryFabric,
  )

  // Wire CDP transport, trace log, and health monitor into governor
  const { CdpTransportImpl } = await import('../executor/cdp-transport.js')
  const cdpTransport = new CdpTransportImpl()
  governor.setCdpTransport(cdpTransport)
  governor.setTraceLog(govStore)
  governor.setHealthMonitor(govStore)

  // Shutdown hook: disconnect CDP clients and kill Chrome instances
  onShutdown(async () => {
    await cdpTransport.disconnectAll()
    await governor.killAll()
  })

  // Boot governor (seeds accounts, starts fleet)
  await governor.boot()

  // Boot onboarding pipeline (non-blocking, attaches to service container)
  bootOnboardingPipeline(governor, db).catch((err: unknown) => {
    log.warn({ err }, 'Onboarding pipeline boot failed (non-fatal)')
  })

  // Knowledge engines (optional — wired if stores are available)
  let knowledgeIngestion:
    | import('../engines/knowledge-ingestion.js').KnowledgeIngestionEngine
    | undefined
  let semanticSearch: import('../engines/semantic-search.js').SemanticSearchEngine | undefined
  let synthesizer:
    | import('../engines/cross-conversation-synthesis.js').CrossConversationSynthesizer
    | undefined
  let exportEngine: import('../engines/export.js').ExportEngine | undefined

  try {
    const { KnowledgeIngestionEngine } = await import('../engines/knowledge-ingestion.js')
    const { KnowledgeIngestionStoreImpl } = await import(
      '../storage/impl/knowledge-ingestion-store-impl.js'
    )
    const { KnowledgeExtractor } = await import('../engines/knowledge-extractor.js')
    const { KnowledgeExtractorStoreImpl } = await import(
      '../storage/impl/knowledge-extractor-store-impl.js'
    )
    const kexStore = new KnowledgeExtractorStoreImpl(db)
    const extractor = new KnowledgeExtractor(kexStore, {
      batchSize: 50,
      confidenceThreshold: 0.3,
      enableEntityExtraction: true,
      enableDecisionExtraction: true,
      enablePatternMining: false,
    })
    const kiStore = new KnowledgeIngestionStoreImpl(db)
    knowledgeIngestion = new KnowledgeIngestionEngine(
      kiStore,
      convStore,
      streamBlocks,
      extractor,
      eventBus,
    )
  } catch (e) {
    catchDebug(e, 'bootstrap: knowledge ingestion not available')
  }

  try {
    const { SemanticSearchEngine } = await import('../engines/semantic-search.js')
    const { SemanticSearchStoreImpl } = await import(
      '../storage/impl/semantic-search-store-impl.js'
    )
    const ssStore = new SemanticSearchStoreImpl(db)

    let embedding: EmbeddingProvider
    try {
      const { OllamaEmbeddingProvider } = await import('../engines/embedding-ollama.js')
      const provider = new OllamaEmbeddingProvider()
      await provider.embed('ping')
      embedding = provider
    } catch (e) {
      catchDebug(e, 'bootstrap: embedding provider fallback to MiniLM')
      const { MiniLmEmbeddingProvider } = await import('../engines/embedding-minilm.js')
      embedding = new MiniLmEmbeddingProvider()
    }

    semanticSearch = new SemanticSearchEngine(ssStore, embedding, db)
  } catch (e) {
    catchDebug(e, 'bootstrap: semantic search not available')
  }

  try {
    const { CrossConversationSynthesizer } = await import(
      '../engines/cross-conversation-synthesis.js'
    )
    const { CrossConversationSynthesizerStoreImpl } = await import(
      '../storage/impl/cross-conversation-synth-store-impl.js'
    )
    const synthStore = new CrossConversationSynthesizerStoreImpl(db)
    const noopLlm = { synthesize: async () => ({ text: 'LLM not configured', confidence: 0 }) }
    if (semanticSearch)
      synthesizer = new CrossConversationSynthesizer(synthStore, semanticSearch, noopLlm)
  } catch (e) {
    catchDebug(e, 'bootstrap: synthesizer not available')
  }

  try {
    const { ExportEngine } = await import('../engines/export.js')
    exportEngine = new ExportEngine({
      async listConversations(opts) {
        return db.prisma.conversation.findMany({
          where:
            opts?.dateFrom || opts?.dateTo
              ? {
                  createdAt: {
                    ...(opts?.dateFrom ? { gte: opts.dateFrom } : {}),
                    ...(opts?.dateTo ? { lte: opts.dateTo } : {}),
                  },
                }
              : undefined,
          select: { id: true, state: true, title: true },
        })
      },
      async listMessages(conversationId) {
        const rows = await db.prisma.conversationMessage.findMany({
          where: { conversationId },
          select: { id: true, role: true, content: true, createdAt: true },
          orderBy: { sequenceIndex: 'asc' },
        })
        return rows.map((r) => ({
          id: r.id,
          role: r.role,
          content: r.content ?? '',
          ts: Number(r.createdAt),
        }))
      },
      async listMemory() {
        // Export episodic + semantic memory as combined memory records
        const episodic = await db.prisma.episodicMemory.findMany({
          select: { id: true, action: true, inputJson: true, timestamp: true },
        })
        const semantic = await db.prisma.semanticMemory.findMany({
          select: { id: true, subject: true, objectJson: true, timestamp: true },
        })
        const result: Array<{ id: string; key: string; value: string; namespace: string }> = []
        for (const e of episodic) {
          result.push({ id: e.id, key: e.action, value: e.inputJson, namespace: 'episodic' })
        }
        for (const s of semantic) {
          result.push({ id: s.id, key: s.subject, value: s.objectJson, namespace: 'semantic' })
        }
        return result
      },
      async listProviders() {
        return db.prisma.providerDefinition.findMany({
          select: { id: true, slug: true, displayName: true },
        })
      },
      async listConfig() {
        return db.prisma.configEntry.findMany({
          select: { id: true, engineId: true, configJson: true },
        })
      },
    })
  } catch (e) {
    catchDebug(e, 'bootstrap: export engine not available')
  }

  // Mux engines (optional — wired if stores are available)
  let providerMux: import('../engines/provider-mux.js').ProviderMuxEngine | undefined
  let costOptimizer: import('../engines/cost-optimizer.js').CostOptimizer | undefined

  try {
    const { CostOptimizer } = await import('../engines/cost-optimizer.js')
    const { CostStoreImpl } = await import('../storage/impl/cost-store-impl.js')
    const costStore = new CostStoreImpl(db)
    costOptimizer = new CostOptimizer(costStore)
  } catch (e) {
    catchDebug(e, 'bootstrap: cost optimizer not available')
  }

  try {
    const { ProviderMuxEngine } = await import('../engines/provider-mux.js')
    const { MuxStoreImpl } = await import('../storage/impl/mux-store-impl.js')
    const { Router } = await import('../router/router.js')
    const { RouterStoreImpl } = await import('../storage/impl/router-store-impl.js')

    const muxStore = new MuxStoreImpl(db)
    const routerStore = new RouterStoreImpl(db)

    // Real dispatcher for mux — creates transient conversations and routes to providers via ConversationManager
    const muxDispatcher = {
      async dispatchToProvider(
        providerId: string,
        message: string,
        conversationId?: string,
      ): Promise<{
        ok: boolean
        response: string
        latencyMs: number
        costCents: number
        error?: string
      }> {
        const start = Date.now()
        try {
          let convId = conversationId

          if (!convId) {
            // Create a transient conversation for this mux response
            const session = await convStore.ensureProviderSession({ providerId })
            const conv = await convStore.createConversation({
              providerSessionId: session.id,
              providerId,
              title: `Mux: ${message.slice(0, 50)}`,
            })
            convId = conv.id
          }

          const result = await conversationManager.send(convId, message)

          const latencyMs = Date.now() - start
          const estCost = await estimateCost(providerId, latencyMs)

          if (costOptimizer) {
            await costOptimizer.recordCost(providerId, estCost, 0, 0)
          }

          return {
            ok: result.ok,
            response: result.text || '',
            latencyMs,
            costCents: estCost,
            error: result.error,
          }
        } catch (err: unknown) {
          return {
            ok: false,
            response: '',
            latencyMs: Date.now() - start,
            costCents: 0,
            error: err instanceof Error ? err.message : String(err),
          }
        }
      },
    }

    async function estimateCost(providerId: string, _latencyMs: number): Promise<number> {
      if (costOptimizer) {
        return costOptimizer.estimateCost(providerId, 1000) // rough: 1000-char message
      }
      return 0
    }

    const noopDispatcher = { dispatch: async () => ({ ok: true }) }
    const router = new Router(routerStore, noopDispatcher)
    providerMux = new ProviderMuxEngine(muxStore, muxDispatcher, router, eventBus)
  } catch (e) {
    catchDebug(e, 'bootstrap: provider mux not available')
  }

  // Autonomous execution (optional — wired if stores are available)
  let autonomousEngine:
    | import('../engines/autonomous-execution.js').AutonomousExecutionEngine
    | undefined
  let policyEngine: import('../engines/execution-policy.js').ExecutionPolicyEngine | undefined
  let registry: UnifiedCapabilityRegistry | undefined
  let relocationEngine:
    | import('../engines/storage-relocation-engine.js').StorageRelocationEngine
    | undefined

  try {
    const { AutonomousExecutionEngine } = await import('../engines/autonomous-execution.js')
    const { ExecutionPolicyEngine } = await import('../engines/execution-policy.js')
    const { AutonomousStoreImpl } = await import('../storage/impl/autonomous-store-impl.js')
    const { PolicyStoreImpl } = await import('../storage/impl/policy-store-impl.js')
    const { ProfileAllocator } = await import('../executor/profile-allocator.js')
    const autonomousStore = new AutonomousStoreImpl()
    const pStore = new PolicyStoreImpl()
    const profileAllocator = new ProfileAllocator(config.profileBaseDir)
    registry = new UnifiedCapabilityRegistry()
    const { LocalAgentStoreImpl } = await import('../storage/impl/local-agent-store-impl.js')
    const { LocalAgentProviderExecutor } = await import(
      '../engines/local-agent/local-agent-executor.js'
    )
    const localAgentStore = new LocalAgentStoreImpl(db)
    const localAgentExecutor = new LocalAgentProviderExecutor(localAgentStore, eventBus)

    // ── Storage Relocation Engine ──────────────────────────────────────────
    const { StorageRelocationEngine } = await import('../engines/storage-relocation-engine.js')
    const relocationStore: import('../engines/storage-relocation-engine.js').RelocationStore = {
      async getStorageConfig() {
        const row = await db.prisma.configEntry.findUnique({
          where: {
            engineId_scopeType_scopeId: { engineId: 'storage', scopeType: 'global', scopeId: '' },
          },
        })
        if (!row) return null
        const parsed = JSON.parse(row.configJson) as Record<string, unknown>
        return {
          dataDir: (parsed.dataDir as string) ?? null,
          dbPath: (parsed.dbPath as string) ?? null,
          retainOldDays: (parsed.retainOldDays as number) ?? 7,
        }
      },
      async setStorageConfig(config) {
        const now = Date.now()
        await db.prisma.configEntry.upsert({
          where: {
            engineId_scopeType_scopeId: { engineId: 'storage', scopeType: 'global', scopeId: '' },
          },
          create: {
            id: 'storage:global',
            engineId: 'storage',
            scopeType: 'global',
            scopeId: '',
            configJson: JSON.stringify(config),
            schemaVersion: 1,
            createdAt: now,
            updatedAt: now,
          },
          update: {
            configJson: JSON.stringify(config),
            updatedAt: now,
          },
        })
      },
      async getArchivedLocations() {
        const row = await db.prisma.configEntry.findUnique({
          where: {
            engineId_scopeType_scopeId: { engineId: 'storage', scopeType: 'global', scopeId: '' },
          },
        })
        if (!row) return []
        const parsed = JSON.parse(row.configJson) as Record<string, unknown>
        const archived =
          (parsed.archivedLocations as Array<{
            path: string
            archivedAt: number
            sizeBytes: number
          }>) ?? []
        return archived
      },
      async markArchived(path, archivedAt, sizeBytes) {
        const row = await db.prisma.configEntry.findUnique({
          where: {
            engineId_scopeType_scopeId: { engineId: 'storage', scopeType: 'global', scopeId: '' },
          },
        })
        const parsed = row ? (JSON.parse(row.configJson) as Record<string, unknown>) : {}
        const archived =
          (parsed.archivedLocations as Array<{
            path: string
            archivedAt: number
            sizeBytes: number
          }>) ?? []
        archived.push({ path, archivedAt, sizeBytes })
        parsed.archivedLocations = archived
        const now = Date.now()
        await db.prisma.configEntry.upsert({
          where: {
            engineId_scopeType_scopeId: { engineId: 'storage', scopeType: 'global', scopeId: '' },
          },
          create: {
            id: 'storage:global',
            engineId: 'storage',
            scopeType: 'global',
            scopeId: '',
            configJson: JSON.stringify(parsed),
            schemaVersion: 1,
            createdAt: now,
            updatedAt: now,
          },
          update: { configJson: JSON.stringify(parsed), updatedAt: now },
        })
      },
      async removeArchived(path) {
        const row = await db.prisma.configEntry.findUnique({
          where: {
            engineId_scopeType_scopeId: { engineId: 'storage', scopeType: 'global', scopeId: '' },
          },
        })
        if (!row) return
        const parsed = JSON.parse(row.configJson) as Record<string, unknown>
        const archived =
          (parsed.archivedLocations as Array<{
            path: string
            archivedAt: number
            sizeBytes: number
          }>) ?? []
        parsed.archivedLocations = archived.filter((a) => a.path !== path)
        const now = Date.now()
        await db.prisma.configEntry.update({
          where: {
            engineId_scopeType_scopeId: { engineId: 'storage', scopeType: 'global', scopeId: '' },
          },
          data: { configJson: JSON.stringify(parsed), updatedAt: now },
        })
      },
    }
    relocationEngine = new StorageRelocationEngine(relocationStore)

    // Check for crash recovery on boot
    relocationEngine.checkCrashRecovery().catch((err: unknown) => {
      log.warn({ err }, 'Storage crash recovery check failed (non-fatal)')
    })

    registerDefaultCapabilities(registry, {
      db,
      conversationStore: convStore,
      governor,
      conversationManager,
      profileAllocator,
      memoryEngine,
      semanticSearch,
      knowledgeIngestion,
      synthesizer,
      localAgentStore,
      localAgentExecutor,
      relocationEngine,
    })

    const { registerProviderCapabilities } = await import('../engines/provider-caps.js')
    registerProviderCapabilities(registry)

    // ── Phase 2.3 harness program resolver ──────────────────────────────────
    {
      const { ProgramStoreImpl } = await import('../storage/impl/program-store-impl.js')
      const { composeHarness } = await import('../engines/harness/index.js')
      const { configToProgram } = await import('../engines/harness/program-schema.js')
      const { programToCapability } = await import('../engines/cdp-capability-registrar.js')
      const { createGovernorSlaveResolver } = await import(
        '../engines/harness/fleet-lifecycle-adapter.js'
      )

      const programStore = new ProgramStoreImpl(db)
      const _slaveResolver = createGovernorSlaveResolver(governor)
      const harness = composeHarness({
        governor,
        programStore,
        capabilityStore,
        blockStore: streamBlocks,
        eventBus,
        parser: parserEngine,
        registry,
        defaultTimeoutMs: 30_000,
      })

      registry.setProgramResolver(async (slug) => {
        const body = slug.startsWith('prog-') ? slug.slice(5) : slug
        const lastDash = body.lastIndexOf('-')
        if (lastDash <= 0) return null
        const capabilitySlug = body.slice(0, lastDash)
        const providerId = body.slice(lastDash + 1)
        const program = await programStore.getBestProgramByCapability(capabilitySlug, providerId)
        if (!program) return null
        const _recipe = configToProgram(program.configJson).recipe
        const cap = programToCapability(program, { executor: harness.executor })
        ;(registry as UnifiedCapabilityRegistry).register(cap)
        return cap
      })
    }

    // ── Spec 032: LLM-as-Human testing as a single UnifiedCapability ──────
    {
      const { registerLlmTestCapabilities } = await import(
        '../../devops/llm-testing/capabilities.js'
      )
      registerLlmTestCapabilities(registry, {
        db,
        conversationStore: convStore,
        governor,
        conversationManager,
        profileAllocator,
        memoryEngine,
        semanticSearch,
        knowledgeIngestion,
        synthesizer,
        localAgentStore,
        localAgentExecutor,
      })
    }

    // Register generated capabilities from the taxonomy pool (196 caps)
    registerGeneratedCapabilities(registry, {
      db,
      conversationStore: convStore,
      governor,
      conversationManager,
      profileAllocator,
      memoryEngine,
      semanticSearch,
      knowledgeIngestion,
      synthesizer,
    })

    // ── MCP server (Spec 032 cross-surface) ─────────────────────────────────
    try {
      const { McpServerAdapter } = await import('../engines/mcp-server-adapter.js')
      const mcpServer = new McpServerAdapter(governor, registry)
      const mcpStartPort = config.mcpPort ?? port + 1
      let mcpPort = mcpStartPort
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          await mcpServer.start({ port: mcpPort, hostname: '127.0.0.1' })
          break
        } catch (e) {
          catchDebug(e, `bootstrap: MCP port ${mcpPort} in use, trying next`)
          if (attempt === 19) throw new Error(`MCP port ${mcpStartPort} and next 19 ports in use`)
          mcpPort++
        }
      }
      ;(globalThis as Record<string, unknown>).__mcpServer = mcpServer
      log.info({ port: mcpPort, tools: mcpServer.getTools().length }, 'MCP server listening')
    } catch (err) {
      log.warn({ err }, 'MCP server skipped')
    }

    // ── Federated per-agent memory (spec 024) ───────────────────────────────
    try {
      const { BeliefStore } = await import('../engines/belief-store.js')
      const { MemoryFabric } = await import('../engines/memory/memory-fabric.js')
      const { AgentBuilderEngine } = await import('../engines/agent-builder.js')
      const { AgenticStoreImpl } = await import('../storage/impl/agentic-store-impl.js')
      const { EventRecordStore } = await import('../engines/event-record-store.js')
      const { KnowledgeExtractorStoreImpl } = await import(
        '../storage/impl/knowledge-extractor-store-impl.js'
      )
      const { SemanticSearchStoreImpl } = await import(
        '../storage/impl/semantic-search-store-impl.js'
      )
      const nodeStoreImpl = new NodeStoreImpl(db.prisma as never)
      const agenticStoreImpl = new AgenticStoreImpl(nodeStoreImpl, db.prisma as never)
      const eventStore = new EventRecordStore(db.prisma as never)
      // Expose memory stores globally so the LLM-testing orchestrator (Spec 032)
      // can project provider test results into agent memory (T16) without a
      // BootstrapServices change — the supervisor may not be enabled at boot.
      ;(globalThis as Record<string, unknown>).__capStoreMemory = {
        agenticStore: agenticStoreImpl,
        eventRecordStore: eventStore,
      }
      const kexStoreImpl = new KnowledgeExtractorStoreImpl(db)
      const ssStoreImpl = new SemanticSearchStoreImpl(db)
      const beliefStore = new BeliefStore(agenticStoreImpl)
      memoryFabric = new MemoryFabric({
        agenticStore: agenticStoreImpl,
        registry,
        nodeStore: nodeStoreImpl,
        extractorStore: kexStoreImpl,
        semanticStore: ssStoreImpl,
        beliefStore,
      })
      agentBuilder = new AgentBuilderEngine(agenticStoreImpl, memoryFabric)
      // Provision the host/system agent so a mem:* capability is live at boot
      await memoryFabric
        .provisionAgentMemory('system', 'system-run')
        .catch((e) => log.warn({ err: e }, 'System memory subsystem provision skipped'))
      log.info('MemoryFabric + AgentBuilderEngine wired (per-agent memory enabled)')

      // ── OpenCode `serve` supervisor (feature 027, ADDITIVE, OFF by default) ──
      if (config.opencodeServeEnabled) {
        try {
          const { OpenCodeSupervisor } = await import('../engines/opencode/opencode-supervisor.js')
          const { OpenCodeClient } = await import('../engines/opencode/opencode-client.js')
          const { OpenCodeIngest } = await import('../engines/opencode/opencode-ingest.js')
          const supervisor = new OpenCodeSupervisor({
            port: config.opencodeServePort,
            password: config.opencodeServerPassword,
          })
          const { port } = await supervisor.start()
          const client = new OpenCodeClient({
            port,
            password: config.opencodeServerPassword,
            username: config.opencodeServerUsername,
          })
          const ingest = new OpenCodeIngest({
            client,
            agenticStore: agenticStoreImpl,
            eventRecordStore: eventStore,
          })
          ;(globalThis as Record<string, unknown>).__opencodeServe = { supervisor, client, ingest }
          log.info({ port }, 'OpenCode serve supervisor started')
        } catch (err) {
          log.warn({ err }, 'OpenCode serve supervisor skipped')
        }
      }
    } catch (err) {
      log.warn({ err }, 'Memory fabric wiring skipped')
    }

    // ── G1/G2: Register discovered CDP methods as live capabilities ──────────
    const cdpBindingStore: CdpBindingStore = {
      async ensureCdpBinding(args) {
        const now = Date.now()
        // Relaxed persistence: ensure the canonical taxonomy row exists, then upsert the binding.
        await db.prisma.capabilityTaxonomy
          .upsert({
            where: { id: args.capabilityId },
            create: {
              id: args.capabilityId,
              slug: args.capabilityId.replace(/:/g, '-'),
              name: args.capabilityId,
              category: 'cdp',
              description: `Discovered CDP capability ${args.capabilityId}`,
              createdAt: now,
              updatedAt: now,
            },
            update: { updatedAt: now },
          })
          .catch(() => {})
        await db.prisma.capabilityBinding
          .upsert({
            where: {
              globalId_providerId: { globalId: args.capabilityId, providerId: args.providerId },
            },
            create: {
              id: `bind:${args.providerId}:${args.capabilityId}`,
              globalId: args.capabilityId,
              providerId: args.providerId,
              status: args.status,
              confidence: args.confidence,
              promotionHistoryJson: JSON.stringify([
                { ts: now, from: 'none', to: args.status, reason: args.reason ?? 'boot' },
              ]),
              createdAt: now,
              updatedAt: now,
            },
            update: {
              status: args.status,
              confidence: args.confidence,
              promotionHistoryJson: JSON.stringify([
                { ts: now, from: 'prospect', to: args.status, reason: args.reason ?? 'boot' },
              ]),
              updatedAt: now,
            },
          })
          .catch(() => {})
      },
    }

    const cdpResult = registerDiscoveredCdpMethods(registry, CDP_PROTOCOL_CATALOG, {
      executeCdp: (method, params, ctx) => {
        const ref = ctx?.conversationId ?? ctx?.providerId ?? 'generic'
        return governor.executeCdpMethod(ref, method, params)
      },
      providerId: 'generic',
      bindingStore: cdpBindingStore,
    })
    log.info(
      `[boot] CDP capabilities: registered=${cdpResult.registered.length} bound=${cdpResult.bound.length} skipped=${cdpResult.skipped.length}`,
    )

    // ── 019: DB-driven capability snapshot ──────────────────────────────────
    const registeredProviders = (await providerStore.listDefinitions({ isActive: true })).map(
      (d) => d.id,
    )
    const capabilitySnapshot = new CapabilitySnapshot(capabilityStore)
    const snapshotCount = await capabilitySnapshot.load(registeredProviders)
    governor.setCapabilitySnapshot(capabilitySnapshot)
    log.info(
      `[boot] Capability snapshot: loaded=${snapshotCount} for ${registeredProviders.length} providers`,
    )

    // Bridge: sync all cli-surface capabilities to the CLI CommandRegistry
    connectCapabilityRegistry(registry)
    policyEngine = new ExecutionPolicyEngine(pStore)
    await policyEngine.initialize()
    autonomousEngine = new AutonomousExecutionEngine(
      autonomousStore,
      registry,
      policyEngine,
      governor,
      eventBus,
    )
  } catch (e) {
    catchDebug(e, 'bootstrap: autonomous execution not available')
  }

  // NLCL — Natural Language Command Layer (the "comms system")
  const automationOrchestrator = new (
    await import('../engines/automation/orchestrator.js')
  ).AutomationOrchestrator(governor)
  const nlclEngine = new NLCLEngine({
    governor,
    automationOrchestrator,
    conversationManager,
    conversationStore: convStore,
    registry,
    db,
    opencodeClient: (globalThis as Record<string, unknown>).__opencodeServe
      ? (
          (globalThis as Record<string, unknown>).__opencodeServe as {
            client: import('../engines/opencode/opencode-client.js').OpenCodeClient
          }
        ).client
      : undefined,
    opencodeIngest: (globalThis as Record<string, unknown>).__opencodeServe
      ? (
          (globalThis as Record<string, unknown>).__opencodeServe as {
            ingest: import('../engines/opencode/opencode-ingest.js').OpenCodeIngest
          }
        ).ingest
      : undefined,
  })
  log.info(`[boot] NLCL engine initialized — ${nlclEngine.listCommands().length} command patterns`)

  // 24.7 — register NLCL itself as a capability on the unified registry
  if (registry) {
    registerNlInterpretCapability(registry, nlclEngine)
  }

  // ── Kernel bootstrap ──────────────────────────────────────────────────
  const kernel = bootstrapKernel({
    eventBus,
    governor,
    conversationManager,
    registry,
    nlclEngine,
    db,
  })

  const kctx = kernel.context()

  // Start kernel (marks all registered engines as running)
  await kernel.start()

  // Periodic topology snapshots every 60s
  const topologyTimer = setInterval(() => {
    const snapshot = kctx.registry.describe()
    kctx.logger.info('topology snapshot', { engines: snapshot.engines.length })
  }, 60_000)

  // Register kernel shutdown hook
  onShutdown(async () => {
    clearInterval(topologyTimer)
    await kernel.stop()
  })

  // ── Health Kernel (4.5) ───────────────────────────────────────────────
  const { ProviderHealthKernel } = await import('../engines/provider-health.js')
  const { HealthStoreImpl } = await import('../storage/impl/health-store-impl.js')
  const healthStore = new HealthStoreImpl(db)
  const healthKernel = new ProviderHealthKernel({
    governor,
    store: healthStore,
    eventBus,
    intervalMs: 30_000,
  })
  healthKernel.start()
  onShutdown(async () => {
    healthKernel.stop()
  })

  // ── Phase 7: Reliability engines ──────────────────────────────────────
  const { LockManager } = await import('../engines/lock-manager.js')
  const { IdempotencyGuard } = await import('../engines/idempotency-guard.js')
  const { RetryEngine } = await import('../engines/retry-engine.js')
  const { configurePrisma: configureDbPragmas } = await import('../storage/db.js')

  // Configure SQLite WAL mode for concurrent access
  await configureDbPragmas(db)

  const lockManager = new LockManager()
  const idempotencyGuard = new IdempotencyGuard()
  const retryEngine = new RetryEngine()

  // NodeStoreImpl — lightweight Prisma wrapper for the Universal Node Layer.
  const nodeStoreForRouter = new (await import('../storage/impl/node-store-impl.js')).NodeStoreImpl(
    db.prisma as never,
  )

  // Phase 1 stores — entity containers, content, notifications, contacts, sync, media
  const { EntityContainerStoreImpl: ECS } = await import(
    '../storage/impl/entity-container-store-impl.js'
  )
  const { ContentItemStoreImpl: CIS } = await import('../storage/impl/content-item-store-impl.js')
  const { NotificationStoreImpl: NS } = await import('../storage/impl/notification-store-impl.js')
  const { ContactStoreImpl: CS } = await import('../storage/impl/contact-store-impl.js')
  const { SyncStoreImpl: SS } = await import('../storage/impl/sync-store-impl.js')
  const { MediaStoreImpl: MS } = await import('../storage/impl/media-store-impl.js')

  return {
    db,
    eventBus,
    convStore,
    governor,
    conversationManager,
    resolutionEngine,
    parserEngine,
    streamBlocks,
    memoryEngine,
    memoryFabric,
    agentBuilder,
    knowledgeIngestion,
    semanticSearch,
    synthesizer,
    exportEngine,
    providerMux,
    costOptimizer,
    autonomousEngine,
    policyEngine,
    registry: registry ?? new UnifiedCapabilityRegistry(),
    nlclEngine,
    automationOrchestrator,
    kernel,
    healthKernel,
    lockManager,
    idempotencyGuard,
    retryEngine,
    relocationEngine,
    nodeStore: nodeStoreForRouter,
    containerStore: new ECS(db),
    contentStore: new CIS(db),
    notificationStore: new NS(db),
    contactStore: new CS(db),
    syncStore: new SS(db),
    mediaStore: new MS(db),
  }
}
