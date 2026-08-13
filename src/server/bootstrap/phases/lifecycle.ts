// src/server/bootstrap/phases/lifecycle.ts
// Boot phase: NLCL engine, kernel bootstrap, health kernel, reliability
// engines (lock/idempotency/retry), and the router-facing stores. These always
// run — they are the last thing booted and never optional.
// Writes: automationOrchestrator, nlclEngine, kernel, healthKernel,
//         lockManager, idempotencyGuard, retryEngine, nodeStore, containerStore,
//         contentStore, notificationStore, contactStore, syncStore, mediaStore
//         on ctx.

import { config } from '../../../config.js'
import { bootstrapKernel } from '../../../engines/kernel/kernel-bootstrap.js'
import { NLCLEngine } from '../../../engines/nlcl/nlcl-engine.js'
import { getLogger } from '../../../lib/logger.js'
import { onShutdown } from '../../index.js'
import type { BootstrapContext } from '../context.js'

const log = getLogger('bootstrap:lifecycle')

export async function bootstrapLifecyclePhase(ctx: BootstrapContext): Promise<void> {
  const db = ctx.db!
  const eventBus = ctx.eventBus!
  const governor = ctx.governor!
  const conversationManager = ctx.conversationManager!
  const convStore = ctx.convStore!
  const registry = ctx.registry

  // NLCL — Natural Language Command Layer (the "comms system")
  const automationOrchestrator = new (
    await import('../../../engines/automation/orchestrator.js')
  ).AutomationOrchestrator(governor)
  const nlclEngine = new NLCLEngine({
    governor,
    automationOrchestrator,
    conversationManager,
    conversationStore: convStore,
    registry,
    db,
    embeddingProvider: ctx.embeddingProvider,
    // #1: Wire the AI Gateway as the NLCL Tier-3 LLM provider (was: never passed → dead code).
    // When the gateway is disabled, the adapter returns a stub message and the Tier-3 path
    // gracefully falls through to lower tiers.
    providerLLM: (
      await import('../../../engines/gateway-provider-llm-adapter.js')
    ).getGatewayProviderLLMAdapter({ providerId: 'simulator' }),
    opencodeClient: (globalThis as Record<string, unknown>).__opencodeServe
      ? (
          (globalThis as Record<string, unknown>).__opencodeServe as {
            client: import('../../../engines/opencode/opencode-client.js').OpenCodeClient
          }
        ).client
      : undefined,
    opencodeIngest: (globalThis as Record<string, unknown>).__opencodeServe
      ? (
          (globalThis as Record<string, unknown>).__opencodeServe as {
            ingest: import('../../../engines/opencode/opencode-ingest.js').OpenCodeIngest
          }
        ).ingest
      : undefined,
  })
  log.info(`[boot] NLCL engine initialized — ${nlclEngine.listCommands().length} command patterns`)

  // P0 ExecutionKernel — hardened, observable NLCL execution lifecycle (alpha-gated, OFF by default).
  // When VIVIM_EXECUTION_KERNEL=1, every NLCL capability execution routes through ExecutionKernel:
  // P0PolicyEngine tier-blocking (default-deny for destructive/communication/financial/security-sensitive)
  // -> execute -> verify -> MemoryJournal. The kernel is the execution primitive only; the NLCL confirmation
  // gate (minted/verified upstream) marks already-confirmed plans engine-authorized so they are not re-gated.
  if (config.executionKernel.enabled) {
    const { ExecutionKernel, MemoryJournal } = await import('../../../engines/execution-kernel.js')
    const { P0PolicyEngine } = await import('../../../engines/policy-engine.js')
    const ek = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: config.executionKernel.allowDestructive,
        allowFinancial: config.executionKernel.allowFinancial,
        allowCommunication: config.executionKernel.allowCommunication,
        allowSecuritySensitive: config.executionKernel.allowSecuritySensitive,
        maxRiskTier: config.executionKernel.maxRiskTier,
      }),
      journal: new MemoryJournal(),
    })
    nlclEngine.setExecutionKernel(ek)
    log.info(
      `[boot] P0 ExecutionKernel wired into NLCL (hardened lifecycle ON; maxRiskTier=${config.executionKernel.maxRiskTier})`,
    )
  }

  // F2: Register NLCL tools (nl_command, nl_list_commands, nl_help) on the MCP server.
  // McpServerAdapter is constructed in capabilities.ts (earlier phase) and exposed
  // as globalThis.__mcpServer. NLCLEngine is constructed here. This is the earliest
  // point where both exist.
  const mcpServer = (globalThis as Record<string, unknown>).__mcpServer as
    | {
        tool?: (
          name: string,
          desc: string,
          schema: Record<string, unknown>,
          handler: (args: Record<string, unknown>) => Promise<unknown>,
        ) => void
      }
    | undefined
  if (mcpServer?.tool) {
    try {
      const { registerNLCLTools } = await import('../../../mcp/nlcl-tools.js')
      registerNLCLTools(mcpServer as never, nlclEngine)
      log.info('[boot] NLCL MCP tools registered (nl_command, nl_list_commands, nl_help)')
    } catch (err) {
      log.warn({ err }, '[boot] NLCL MCP tool registration failed (non-fatal)')
    }
  }

  // 24.7 — register NLCL itself as a capability on the unified registry
  if (registry) {
    const { registerNlInterpretCapability } = await import(
      '../../../engines/capability-bootstrap.js'
    )
    registerNlInterpretCapability(registry, nlclEngine)
  }

  // Phase 1 — Capability parity audit.
  // Runs after NLCL engine and registry are both populated.
  // Logs warnings; errors are non-fatal in this phase (visibility, not enforcement).
  try {
    const { CapabilityParityAuditor } = await import('../../../engines/capability-parity.js')
    const auditor = new CapabilityParityAuditor()
    const nlclPatterns = nlclEngine.listCommands()
    const report = auditor.audit(nlclPatterns, registry!)
    log.info(
      `[boot] capability parity: ${report.nlclPatternCount} NLCL patterns, ${report.capabilityCount} capabilities, ${report.errorCount} errors, ${report.warningCount} warnings`,
    )
    if (report.errorCount > 0) {
      log.warn(`[boot] parity audit ERRORS:\n${auditor.formatReport(report)}`)
    }
    // Attach to globalThis for devops introspection
    ;(globalThis as Record<string, unknown>).__capabilityParityReport = report
  } catch (err) {
    log.warn({ err }, '[boot] capability parity audit failed (non-fatal)')
  }

  // #1 + #2: Construct LLMSlaveResolver (BM25+MiniLM+RRF RAG pipeline) — the advanced
  // catalog-grounded intent resolver. Was: never instantiated (rg "new LLMSlaveResolver" = 0).
  // Now: constructed with the GatewayProviderLLMAdapter (#1) + HarnessRepairEngine (#2)
  // and exposed as globalThis.__llmSlaveResolver for the NLCL engine to use as a Layer-4 fallback.
  try {
    const { LLMSlaveResolver } = await import('../../../engines/nlcl/llm-slave-resolver.js')
    const { getGatewayProviderLLMAdapter } = await import(
      '../../../engines/gateway-provider-llm-adapter.js'
    )
    const harnessRepair = (globalThis as Record<string, unknown>).__harnessRepair as
      | {
          repair: (input: {
            content: string
            schema: { parse: (v: unknown) => { success: boolean; data?: unknown } }
          }) => Promise<{ ok: boolean; data?: unknown; repairs: string[]; errors: string[] }>
        }
      | undefined

    const slaveResolver = new LLMSlaveResolver({
      providerLLM: getGatewayProviderLLMAdapter({ providerId: 'simulator' }),
      catalog: () =>
        registry
          ?.list()
          ?.map(
            (c: {
              id: string
              slug: string
              name: string
              description?: string
              inputSchema?: unknown
            }) => ({
              id: c.id,
              intent: c.slug,
              description: c.name ?? c.id,
              inputSchema: c.inputSchema,
            }),
          ) ?? [],
      repairEngine: harnessRepair,
      embeddingProvider: ctx.embeddingProvider,
    })
    ;(globalThis as Record<string, unknown>).__llmSlaveResolver = slaveResolver
    log.info('[boot] LLMSlaveResolver constructed (BM25+MiniLM+RRF RAG, gateway-backed)')
  } catch (err) {
    log.warn({ err }, '[boot] LLMSlaveResolver construction failed (non-fatal)')
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
  const { ProviderHealthKernel } = await import('../../../engines/provider-health.js')
  const { HealthStoreImpl } = await import('../../../storage/impl/health-store-impl.js')
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
  const { LockManager } = await import('../../../engines/lock-manager.js')
  const { IdempotencyGuard } = await import('../../../engines/idempotency-guard.js')
  const { RetryEngine } = await import('../../../engines/retry-engine.js')
  const { configurePrisma: configureDbPragmas } = await import('../../../storage/db.js')

  // Configure SQLite WAL mode for concurrent access
  await configureDbPragmas(db)

  const lockManager = new LockManager()
  const idempotencyGuard = new IdempotencyGuard()
  const retryEngine = new RetryEngine()

  // NodeStoreImpl — lightweight Prisma wrapper for the Universal Node Layer.
  const nodeStoreForRouter = new (
    await import('../../../storage/impl/node-store-impl.js')
  ).NodeStoreImpl(db.prisma as never)

  // Phase 1 stores — entity containers, content, notifications, contacts, sync, media
  const { EntityContainerStoreImpl: ECS } = await import(
    '../../../storage/impl/entity-container-store-impl.js'
  )
  const { ContentItemStoreImpl: CIS } = await import(
    '../../../storage/impl/content-item-store-impl.js'
  )
  const { NotificationStoreImpl: NS } = await import(
    '../../../storage/impl/notification-store-impl.js'
  )
  const { ContactStoreImpl: CS } = await import('../../../storage/impl/contact-store-impl.js')
  const { SyncStoreImpl: SS } = await import('../../../storage/impl/sync-store-impl.js')
  const { MediaStoreImpl: MS } = await import('../../../storage/impl/media-store-impl.js')

  ctx.automationOrchestrator = automationOrchestrator
  ctx.nlclEngine = nlclEngine
  ctx.kernel = kernel
  ctx.healthKernel = healthKernel
  ctx.lockManager = lockManager
  ctx.idempotencyGuard = idempotencyGuard
  ctx.retryEngine = retryEngine
  ctx.nodeStore = nodeStoreForRouter
  ctx.containerStore = new ECS(db)
  ctx.contentStore = new CIS(db)
  ctx.notificationStore = new NS(db)
  ctx.contactStore = new CS(db)
  ctx.syncStore = new SS(db)
  ctx.mediaStore = new MS(db)
}
