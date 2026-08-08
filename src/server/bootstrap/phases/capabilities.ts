// src/server/bootstrap/phases/capabilities.ts
// Boot phase: capability registration + autonomous execution. Owns the whole
// (carefully contained) "everything alive" try/catch block from the original
// bootstrap — relocation engine, the default/provider/generated/LM-test/... cap
// sets, the harness program resolver, MCP server, per-agent memory fabric,
// OpenCode supervisor, and the CDP method registrars. A failure in any of these
// is non-fatal and skipped.
// Writes: registry, autonomousEngine, policyEngine, relocationEngine,
//         memoryFabric, agentBuilder on ctx.

import { connectCapabilityRegistry } from '../../../cli/index.js'
import { config } from '../../../config.js'
import { registerGeneratedCapabilities } from '../../../engines/capability-bootstrap-generated.js'
import { registerDefaultCapabilities } from '../../../engines/capability-bootstrap.js'
import {
  type CdpBindingStore,
  registerDiscoveredCdpMethods,
} from '../../../engines/cdp-capability-registrar.js'
import { CDP_PROTOCOL_CATALOG } from '../../../engines/cdp-discovery.js'
import { catchDebug } from '../../../lib/catch-logger.js'
import { getLogger } from '../../../lib/logger.js'
import type { BootstrapContext } from '../context.js'

const log = getLogger('bootstrap:capabilities')

export async function bootstrapCapabilitiesPhase(ctx: BootstrapContext): Promise<void> {
  const db = ctx.db!
  const eventBus = ctx.eventBus!
  const convStore = ctx.convStore!
  const governor = ctx.governor!
  const conversationManager = ctx.conversationManager!
  const streamBlocks = ctx.streamBlocks!
  const parserEngine = ctx.parserEngine!
  const capabilityStore = ctx.capabilityStore!
  const memoryEngine = ctx.memoryEngine!
  const semanticSearch = ctx.semanticSearch
  const knowledgeIngestion = ctx.knowledgeIngestion
  const synthesizer = ctx.synthesizer
  const providerStore = ctx.providerStore!

  // Autonomous execution (optional — wired if stores are available)
  let autonomousEngine:
    | import('../../../engines/autonomous-execution.js').AutonomousExecutionEngine
    | undefined
  let policyEngine: import('../../../engines/execution-policy.js').ExecutionPolicyEngine | undefined
  let registry: import('../../../engines/unified-registry.js').UnifiedCapabilityRegistry | undefined
  let relocationEngine:
    | import('../../../engines/storage-relocation-engine.js').StorageRelocationEngine
    | undefined
  let memoryFabric: import('../../../engines/memory/memory-fabric.js').MemoryFabric | undefined
  let agentBuilder: import('../../../engines/agent-builder.js').AgentBuilderEngine | undefined

  try {
    const { AutonomousExecutionEngine } = await import('../../../engines/autonomous-execution.js')
    const { ExecutionPolicyEngine } = await import('../../../engines/execution-policy.js')
    const { AutonomousStoreImpl } = await import('../../../storage/impl/autonomous-store-impl.js')
    const { PolicyStoreImpl } = await import('../../../storage/impl/policy-store-impl.js')
    const { ProfileAllocator } = await import('../../../executor/profile-allocator.js')
    const autonomousStore = new AutonomousStoreImpl()
    const pStore = new PolicyStoreImpl()
    const profileAllocator = new ProfileAllocator(config.profileBaseDir)
    registry = new (
      await import('../../../engines/unified-registry.js')
    ).UnifiedCapabilityRegistry()
    const { LocalAgentStoreImpl } = await import('../../../storage/impl/local-agent-store-impl.js')
    const { LocalAgentProviderExecutor } = await import(
      '../../../engines/local-agent/local-agent-executor.js'
    )
    const { OpenCodeModelSync } = await import(
      '../../../engines/local-agent/opencode-model-sync.js'
    )
    const localAgentStore = new LocalAgentStoreImpl(db)
    const localAgentExecutor = new LocalAgentProviderExecutor(localAgentStore, eventBus)
    const opencodeModelSync = new OpenCodeModelSync(localAgentStore, {
      intervalMs: config.opencodeModelSyncIntervalHours * 60 * 60 * 1000,
      refresh: config.opencodeModelSyncRefresh,
    })

    // ── Storage Relocation Engine ──────────────────────────────────────────
    const { StorageRelocationEngine } = await import(
      '../../../engines/storage-relocation-engine.js'
    )
    const relocationStore: import('../../../engines/storage-relocation-engine.js').RelocationStore =
      {
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
      opencodeModelSync,
      relocationEngine,
    })

    // Background daily opencode free-model refresh (feature: model sync). Non-blocking;
    // runs once at launch (skipping a fresh cache) then on the configured interval.
    if (config.opencodeModelSyncEnabled) {
      opencodeModelSync.start()
      log.info(
        { intervalHours: config.opencodeModelSyncIntervalHours, refresh: config.opencodeModelSyncRefresh },
        'opencode model sync daemon started',
      )
    }

    const { registerProviderCapabilities } = await import('../../../engines/provider-caps.js')
    registerProviderCapabilities(registry)

    // ── Phase 2.3 harness program resolver ──────────────────────────────────
    {
      const { ProgramStoreImpl } = await import('../../../storage/impl/program-store-impl.js')
      const { composeHarness } = await import('../../../engines/harness/index.js')
      const { configToProgram } = await import('../../../engines/harness/program-schema.js')
      const { programToCapability } = await import('../../../engines/cdp-capability-registrar.js')
      const { createGovernorSlaveResolver } = await import(
        '../../../engines/harness/fleet-lifecycle-adapter.js'
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
        ;(
          registry as import('../../../engines/unified-registry.js').UnifiedCapabilityRegistry
        ).register(cap)
        return cap
      })
    }

    // ── Spec 032: LLM-as-Human testing as a single UnifiedCapability ──────
    {
      const { registerLlmTestCapabilities } = await import(
        '../../../../devops/llm-testing/capabilities.js'
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
      const { McpServerAdapter } = await import('../../../engines/mcp-server-adapter.js')
      const mcpServer = new McpServerAdapter(governor, registry)
      const mcpStartPort = config.mcpPort ?? ctx.port + 1
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
      const { BeliefStore } = await import('../../../engines/belief-store.js')
      const { MemoryFabric } = await import('../../../engines/memory/memory-fabric.js')
      const { AgentBuilderEngine } = await import('../../../engines/agent-builder.js')
      const { AgenticStoreImpl } = await import('../../../storage/impl/agentic-store-impl.js')
      const { EventRecordStore } = await import('../../../engines/event-record-store.js')
      const { KnowledgeExtractorStoreImpl } = await import(
        '../../../storage/impl/knowledge-extractor-store-impl.js'
      )
      const { SemanticSearchStoreImpl } = await import(
        '../../../storage/impl/semantic-search-store-impl.js'
      )
      const { NodeStoreImpl } = await import('../../../storage/impl/node-store-impl.js')
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
          const { OpenCodeSupervisor } = await import(
            '../../../engines/opencode/opencode-supervisor.js'
          )
          const { OpenCodeClient } = await import('../../../engines/opencode/opencode-client.js')
          const { OpenCodeIngest } = await import('../../../engines/opencode/opencode-ingest.js')
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
          log.info(
            {
              port,
              pid: supervisor.getPid(),
              instanceId: supervisor.getInstanceId(),
            },
            'OpenCode serve supervisor started',
          )
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
      executeCdp: (method, params, ctx2) => {
        const ref = ctx2?.conversationId ?? ctx2?.providerId ?? 'generic'
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
    const { CapabilitySnapshot } = await import('../../../engines/capability-snapshot.js')
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

  ctx.registry = registry
  ctx.autonomousEngine = autonomousEngine
  ctx.policyEngine = policyEngine
  ctx.relocationEngine = relocationEngine
  ctx.memoryFabric = memoryFabric
  ctx.agentBuilder = agentBuilder
}
