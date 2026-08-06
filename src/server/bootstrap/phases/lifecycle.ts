// src/server/bootstrap/phases/lifecycle.ts
// Boot phase: NLCL engine, kernel bootstrap, health kernel, reliability
// engines (lock/idempotency/retry), and the router-facing stores. These always
// run — they are the last thing booted and never optional.
// Writes: automationOrchestrator, nlclEngine, kernel, healthKernel,
//         lockManager, idempotencyGuard, retryEngine, nodeStore, containerStore,
//         contentStore, notificationStore, contactStore, syncStore, mediaStore
//         on ctx.

import { bootstrapKernel } from '../../../engines/kernel/kernel-bootstrap.js'
import { NLCLEngine } from '../../../engines/nlcl/nlcl-engine.js'
import { getLogger } from '../../../lib/logger.js'
import type { BootstrapContext } from '../context.js'
import { onShutdown } from '../../index.js'

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

  // 24.7 — register NLCL itself as a capability on the unified registry
  if (registry) {
    const { registerNlInterpretCapability } = await import(
      '../../../engines/capability-bootstrap.js'
    )
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
  const nodeStoreForRouter = new (await import('../../../storage/impl/node-store-impl.js')).NodeStoreImpl(
    db.prisma as never,
  )

  // Phase 1 stores — entity containers, content, notifications, contacts, sync, media
  const { EntityContainerStoreImpl: ECS } = await import(
    '../../../storage/impl/entity-container-store-impl.js'
  )
  const { ContentItemStoreImpl: CIS } = await import('../../../storage/impl/content-item-store-impl.js')
  const { NotificationStoreImpl: NS } = await import('../../../storage/impl/notification-store-impl.js')
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