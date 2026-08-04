// src/server/index.ts
// Bun.serve — REST API + WebSocket server entry point
//
// Minimal shell: mounts response helpers, auth gate, conversation router,
// and WebSocket bridge. Engine wiring is deferred to the full bootstrap
// (units 5.1-5.5 are bundled; full wiring comes after all stubs exist).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectCapabilityRegistry } from '../cli/index.js'
import { config } from '../config.js'
import { registerGeneratedCapabilities } from '../engines/capability-bootstrap-generated.js'
import { registerDefaultCapabilities } from '../engines/capability-bootstrap.js'
import { registerNlInterpretCapability } from '../engines/capability-bootstrap.js'
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
import { InMemoryGenerativeTaskStore } from '../engines/generative/generative-task-store.js'
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
import { getLogger } from '../lib/logger.js'
import { type CapStoreDb, getDb } from '../storage/db.js'
import { createAuthMiddleware } from './auth-gate.js'
import { createAutomationRouter } from './automation-router.js'
import { createAutonomousRouter } from './autonomous-router.js'
import { createCapabilityRouter } from './capability-router.js'
import { createChromeRouter } from './chrome-router.js'
import { createConversationRouter } from './conversation-router.js'
import { createGenerativeRouter } from './generative-router.js'
import { createInterpretRouter } from './interpret-router.js'
import { createLlmHarnessRouter } from './llm-harness-router.js'
import { createMemoryVizRouter } from './memory-viz-router.js'
import { createMutationRouter } from './mutation-router.js'
import { createMuxRouter } from './mux-router.js'
import { createNLCLRouter } from './nlcl-router.js'
import { createNodeRouter } from './node-router.js'
import { bootOnboardingPipeline } from './onboarding-boot.js'
import { createPluginBuilderRouter } from './plugin-builder-router.js'
import { errorResponse, json } from './response.js'
import { createContactsRouter } from './routes/contacts.js'
import { createContainersRouter } from './routes/containers.js'
import { createContentRouter } from './routes/content.js'
import { createKnowledgeRouter } from './routes/knowledge.js'
import { createMediaRouter } from './routes/media.js'
import { createNotificationsRouter } from './routes/notifications.js'
import { createSyncRouter } from './routes/sync.js'
import { createTunnelRouter } from './routes/tunnel.js'
import { createUpdateRouter } from './routes/update.js'
import { createSetupRouter } from './setup-router.js'
import { createStorageRouter } from './storage-router.js'
import { createSurfaceRouter } from './surface-router.js'
import { createTemplateRouter } from './template-router.js'
import { createVariantRouter } from './variant-router.js'
import { createVersionRouter } from './version-router.js'
import {
  handleWebSocket,
  registerCanvasMutationForwarder,
  registerConversationForwarder,
  registerNodeEventForwarder,
  setCanvasWsHandler,
} from './websocket.js'

export interface ServerContext {
  port: number
  db: CapStoreDb
  eventBus: CapabilityEventBus
  conversationManager?: ConversationManager
  resolutionEngine?: CapabilityResolutionEngine
  governor?: ChromeGovernor
  knowledgeIngestion?: KnowledgeIngestionEngine
  semanticSearch?: SemanticSearchEngine
  synthesizer?: CrossConversationSynthesizer
  exportEngine?: ExportEngine
  providerMux?: ProviderMuxEngine
  autonomousEngine?: import('../engines/autonomous-execution.js').AutonomousExecutionEngine
  policyEngine?: import('../engines/execution-policy.js').ExecutionPolicyEngine
  registry?: UnifiedCapabilityRegistry
  costOptimizer?: CostOptimizer
  nlclEngine?: NLCLEngine
  automationOrchestrator?: import('../engines/automation/orchestrator.js').AutomationOrchestrator
  kernel?: Kernel
  healthKernel?: ProviderHealthKernel
  lockManager?: LockManager
  idempotencyGuard?: IdempotencyGuard
  retryEngine?: RetryEngine
  conceptualModel?: ConceptualModelService
  userIdentity?: UserIdentityEngine
  memoryFabric?: import('../engines/memory/memory-fabric.js').MemoryFabric
  agentBuilder?: import('../engines/agent-builder.js').AgentBuilderEngine
  memoryEngine?: import('../engines/memory-engine.js').MemoryEngine
  nodeStore?: import('../storage/contracts/node-store.js').NodeStoreContract
  containerStore?: import('../storage/impl/entity-container-store-impl.js').EntityContainerStoreImpl
  contentStore?: import('../storage/impl/content-item-store-impl.js').ContentItemStoreImpl
  notificationStore?: import('../storage/impl/notification-store-impl.js').NotificationStoreImpl
  contactStore?: import('../storage/impl/contact-store-impl.js').ContactStoreImpl
  syncStore?: import('../storage/impl/sync-store-impl.js').SyncStoreImpl
  mediaStore?: import('../storage/impl/media-store-impl.js').MediaStoreImpl
}

const log = getLogger('server')

/** Shutdown hooks registered during server lifetime */
const shutdownHooks: Array<() => Promise<void>> = []
let isShuttingDown = false

export function onShutdown(hook: () => Promise<void>): void {
  shutdownHooks.push(hook)
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true
  log.info({ signal }, 'Shutting down gracefully...')

  for (const hook of shutdownHooks) {
    try {
      await hook()
    } catch (err) {
      log.error({ err }, 'Shutdown hook error')
    }
  }

  log.info('Shutdown complete.')
  process.exit(0)
}

/**
 * Try to bind Bun.serve on `port`. If EADDRINUSE, walk up to the next free
 * port (up to +200). Writes the actual port to `.runtime/backend.port` so
 * downstream clients (PS1 scripts, frontend, CLI) discover it.
 */
function startOnFreePort(
  opts: Parameters<typeof Bun.serve>[0],
  preferredPort: number,
): { server: ReturnType<typeof Bun.serve>; boundPort: number } {
  const maxScan = preferredPort + 200
  let port = preferredPort
  while (port < maxScan) {
    try {
      const server = Bun.serve({ ...opts, port } as Parameters<typeof Bun.serve>[0])
      // Write actual port so PS1 scripts + frontend can discover it
      try {
        const runtimeDir = join(process.cwd(), '.runtime')
        mkdirSync(runtimeDir, { recursive: true })
        writeFileSync(join(runtimeDir, 'backend.port'), String(port), 'utf-8')
      } catch {
        /* best-effort */
      }
      return { server, boundPort: port }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EADDRINUSE') {
        log.warn({ port, nextPort: port + 1 }, 'Port in use, trying next port')
        port++
        continue
      }
      throw err
    }
  }
  throw new Error(`No free port found in range ${preferredPort}–${maxScan - 1}`)
}

export async function createServer(port = 9420): Promise<ServerContext> {
  const db = getDb()
  const eventBus = CapabilityEventBus.getInstance()

  // NLCL works even in minimal mode — deterministic parser needs no external deps
  const nlclEngine = new NLCLEngine({ db })

  const ctx: ServerContext = { port, db, eventBus, nlclEngine }

  // Phase 1 stores — entity containers, content, notifications, contacts, sync, media
  const { EntityContainerStoreImpl } = await import(
    '../storage/impl/entity-container-store-impl.js'
  )
  const { ContentItemStoreImpl } = await import('../storage/impl/content-item-store-impl.js')
  const { NotificationStoreImpl } = await import('../storage/impl/notification-store-impl.js')
  const { ContactStoreImpl } = await import('../storage/impl/contact-store-impl.js')
  const { SyncStoreImpl } = await import('../storage/impl/sync-store-impl.js')
  const { MediaStoreImpl } = await import('../storage/impl/media-store-impl.js')
  ctx.containerStore = new EntityContainerStoreImpl(db)
  ctx.contentStore = new ContentItemStoreImpl(db)
  ctx.notificationStore = new NotificationStoreImpl(db)
  ctx.contactStore = new ContactStoreImpl(db)
  ctx.syncStore = new SyncStoreImpl(db)
  ctx.mediaStore = new MediaStoreImpl(db)

  const auth = createAuthMiddleware()
  const conversationRouter = createConversationRouter(ctx)
  const knowledgeRouter = createKnowledgeRouter(ctx)
  const setupRouter = createSetupRouter(ctx)
  const muxRouter = createMuxRouter(ctx)
  const nlclRouter = createNLCLRouter(nlclEngine)
  const chromeRouter = createChromeRouter()
  const generativeStore = new InMemoryGenerativeTaskStore()
  const generativeRouter = createGenerativeRouter(generativeStore)
  const llmHarnessRouter = createLlmHarnessRouter()
  const mutationRouter = createMutationRouter()
  const pluginBuilderRouter = createPluginBuilderRouter()
  const surfaceRouter = createSurfaceRouter()
  const templateRouter = createTemplateRouter()
  const variantRouter = createVariantRouter()
  const versionRouter = createVersionRouter()
  const updateRouter = createUpdateRouter()
  const tunnelRouter = createTunnelRouter(ctx)
  const containersRouter = createContainersRouter(ctx)
  const contentRouter = createContentRouter(ctx)
  const notificationsRouter = createNotificationsRouter(ctx)
  const contactsRouter = createContactsRouter(ctx)
  const syncRouter = createSyncRouter(ctx)
  const mediaRouter = createMediaRouter(ctx)

  // NodeStoreImpl for the minimal server context (node graph queries)
  const nodeStoreMinimal = new (await import('../storage/impl/node-store-impl.js')).NodeStoreImpl(
    db.prisma as never,
  )
  const nodeRouter = createNodeRouter({ ...ctx, nodeStore: nodeStoreMinimal })

  // bootOnboardingPipeline called after governor is created (see below)

  // Track readiness — becomes true after server boots
  let ready = false

  const { boundPort } = startOnFreePort(
    {
      fetch(req, server) {
        const url = new URL(req.url)

        // CORS preflight — allow all origins, methods, headers
        if (req.method === 'OPTIONS') {
          return new Response(null, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, QUERY',
              'Access-Control-Allow-Headers':
                'Content-Type, Authorization, X-Source, X-Trace-Id, X-Request-Id',
              'Access-Control-Max-Age': '86400',
            },
          })
        }

        if (url.pathname === '/health') {
          return json({ status: 'ok', version: '1.0.0' })
        }

        // Readiness — 200 only when server is ready to accept traffic (no auth)
        if (url.pathname === '/readyz') {
          if (!ready) {
            return json({ status: 'not_ready', reason: 'server still starting' }, 503)
          }
          return json({ status: 'ready', uptime: process.uptime() })
        }

        // OpenAPI spec — no auth, machine-readable API documentation
        if (url.pathname === '/api/openapi.json') {
          try {
            const specPath = join(process.cwd(), 'docs/api/v11-universal-api.yaml')
            if (existsSync(specPath)) {
              const yaml = readFileSync(specPath, 'utf8')
              return new Response(yaml, {
                headers: { 'Content-Type': 'application/yaml; charset=utf-8' },
              })
            }
            return json({ error: 'OpenAPI spec not found', code: 'NotFound' }, 404)
          } catch {
            return json({ error: 'Failed to load OpenAPI spec', code: 'InternalError' }, 500)
          }
        }

        // Swagger UI — no auth, interactive API documentation
        if (url.pathname === '/docs') {
          const specUrl = `${url.origin}/api/openapi.json`
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>vivim API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '${specUrl}', dom_id: '#swagger-ui', deepLinking: true });
  </script>
</body>
</html>`
          return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }

        // Setup routes — no auth (workspace/profile setup is first-run experience)
        if (url.pathname.startsWith('/api/setup/')) {
          return setupRouter(req)
        }

        // WebSocket upgrade
        if (url.pathname === '/ws') {
          const ok = server.upgrade(req, { data: {} })
          return ok
            ? new Response(null, { status: 101 })
            : errorResponse('WebSocket upgrade failed', 'UpgradeFailed', 400)
        }

        // Reject requests during shutdown
        if (isShuttingDown) {
          return json({ error: 'Server shutting down', code: 'ShuttingDown' }, 503)
        }

        // Auth gate
        const authResult = auth(req)
        if (authResult) return authResult

        // Mux routes
        if (url.pathname.startsWith('/api/route/')) {
          return muxRouter(req)
        }

        // NLCL — Natural Language Command Layer routes (available in minimal mode)
        if (url.pathname.startsWith('/api/nlcl/')) {
          return nlclRouter(req)
        }

        // Knowledge routes
        if (url.pathname.startsWith('/api/knowledge/')) {
          return knowledgeRouter(req)
        }

        // Tunnel + P2P subsystem routes (minimal bootstrap)
        if (url.pathname.startsWith('/api/tunnel/')) {
          return tunnelRouter(req)
        }

        // Next Tranche routes — containers, content, notifications, contacts, sync, media
        if (url.pathname.startsWith('/api/containers/')) {
          return containersRouter(req)
        }
        if (url.pathname.startsWith('/api/content/')) {
          return contentRouter(req)
        }
        if (url.pathname.startsWith('/api/notifications/')) {
          return notificationsRouter(req)
        }
        if (url.pathname.startsWith('/api/contacts/')) {
          return contactsRouter(req)
        }
        if (url.pathname.startsWith('/api/sync/')) {
          return syncRouter(req)
        }
        if (url.pathname.startsWith('/api/media/')) {
          return mediaRouter(req)
        }

        // Node graph query routes (universal node layer)
        if (url.pathname.startsWith('/api/nodes/')) {
          return nodeRouter(req)
        }

        // Chrome automation routes
        if (url.pathname.startsWith('/api/chrome/')) {
          return chromeRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Generative engine routes
        if (url.pathname.startsWith('/api/generative/')) {
          return generativeRouter(req)
        }

        // LLM harness routes
        if (url.pathname.startsWith('/api/harness/')) {
          return llmHarnessRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Mutation routes
        if (url.pathname.startsWith('/api/mutation/')) {
          return mutationRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Plugin builder routes
        if (url.pathname.startsWith('/api/plugins/')) {
          return pluginBuilderRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Surface routes
        if (url.pathname.startsWith('/api/surface/')) {
          return surfaceRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Template routes
        if (url.pathname.startsWith('/api/template/')) {
          return templateRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Variant routes
        if (url.pathname.startsWith('/api/variant/')) {
          return variantRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Version routes
        if (url.pathname.startsWith('/api/version/')) {
          return versionRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Update routes
        if (url.pathname.startsWith('/api/update/')) {
          return updateRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // Static file serving (env-gated: FRONTEND_DIR)
        const frontendDir = process.env.FRONTEND_DIR
        if (frontendDir) {
          try {
            const filePath = join(frontendDir, url.pathname === '/' ? 'index.html' : url.pathname)
            if (existsSync(filePath)) {
              return new Response(Bun.file(filePath))
            }
            // SPA fallback: serve index.html for non-file paths
            if (!url.pathname.includes('.')) {
              const indexPath = join(frontendDir, 'index.html')
              if (existsSync(indexPath)) {
                return new Response(Bun.file(indexPath))
              }
            }
          } catch {
            // Fall through to conversationRouter
          }
        }

        return conversationRouter(req)
      },
      websocket: {
        open(ws) {
          handleWebSocket.open(ws)
        },
        message(ws, message) {
          handleWebSocket.message(ws, message, eventBus)
        },
        close(ws) {
          handleWebSocket.close(ws, eventBus)
        },
      },
    },
    port,
  )

  ctx.port = boundPort

  // Mark server as ready after Bun.serve succeeds
  ready = true

  // Register signal handlers for graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  return ctx
}

/**
 * Run individual seed functions (providers, parsers, automation, taxonomy, harness).
 * Extracted from boot flow for reuse by snapshot auto-restore fallback.
 */
async function runIndividualSeeds(
  db: CapStoreDb,
  registrar: any,
  providerStore: any,
  log: ReturnType<typeof getLogger>,
): Promise<void> {
  const seedResult = await registrar.seedAll()
  log.info(
    { count: seedResult.seeded.length, errors: seedResult.errors.length },
    'Seeded providers',
  )

  try {
    const { seedHarvestedParsers, seedStreamConfigs } = await import(
      '../../seeds/parsers/harvest.seed.js'
    )
    const harvested = await seedHarvestedParsers(providerStore)
    log.info({ count: harvested }, 'Harvested parser variants into DB')
    const streamConfigs = await seedStreamConfigs(providerStore)
    log.info({ count: streamConfigs }, 'Seeded provider stream configs')
  } catch (err) {
    log.warn({ err }, 'Parser harvest seed skipped')
  }

  try {
    const { seedAutomation } = await import('../../seeds/automation/automation.seed.js')
    const autoCount = await seedAutomation(db)
    log.info({ count: autoCount }, 'Seeded browser-automation records')
  } catch (err) {
    log.warn({ err }, 'Automation seed skipped')
  }

  try {
    const { ensureTaxonomySeeded } = await import('../../seeds/taxonomy/taxonomy-seed.js')
    const tax = await ensureTaxonomySeeded(db.prisma)
    if (tax.upserted > 0) {
      log.info({ count: tax.upserted }, 'Seeded capability-taxonomy rows')
    }
  } catch (err) {
    log.warn({ err }, 'Taxonomy seed skipped')
  }

  try {
    const { seedHarnessCommands } = await import('../../seeds/harness/commands.seed.js')
    const harnessCount = await seedHarnessCommands(db)
    log.info({ count: harnessCount }, 'Seeded harness commands')
  } catch (err) {
    log.warn({ err }, 'Harness command seed skipped')
  }
}

/**
 * Full bootstrap — wires all engines into the server context.
 * Call this when you need a working server with real engine backing.
 */
export async function createServerWithEngines(port = 9420): Promise<ServerContext> {
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

  let needsSeed: boolean;
  if (process.env.FORCE_SEED) {
    needsSeed = true;
  } else {
    try {
      needsSeed = (await db.prisma.providerDefinition.count()) === 0;
    } catch (err: unknown) {
      // P2021 = "no such table" — DB exists but schema wasn't applied
      const code = (err as { code?: string })?.code;
      if (code === 'P2021') {
        log.warn('DB schema not applied (P2021) — will attempt snapshot restore');
        needsSeed = true;
      } else {
        throw err;
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
        setDb(null as any)
        const freshDb = getDb()
        // Re-initialize provider store with fresh DB connection
        const freshProviderStore = new ProviderStoreImpl(freshDb)
        const freshRegistrar = new ProviderRegistrar(freshProviderStore, undefined, eventBus)
        // Update local references for downstream use
        Object.assign(providerStore, freshProviderStore)
        Object.assign(registrar, freshRegistrar)
        // Update the db variable's prisma reference
        ;(db as any).prisma = freshDb.prisma
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
  const resStore = new CapabilityResolutionStoreImpl(db.prisma as any)
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
  const memoizer = new ExecutionMemoizer({
    emit: (event: string, data: unknown) => {
      eventBus.emit({ type: event, ...(data as Record<string, unknown>) } as any)
    },
    on: (_event: string, _handler: (data: unknown) => void) => {
      // Memoizer invalidation hooks — no-op for bootstrap; real wiring uses eventBus directly
    },
  })
  const memoryEngine = new MemoryEngine(episodicStore, semanticStore, proceduralStore, eventBus)

  // Wire up the Memory Intelligence store for entity/topic/project/preference tracking
  const { MemoryIntelligenceStoreImpl } = await import(
    '../storage/impl/memory-intelligence-store-impl.js'
  )
  const memoryIntelStore = new MemoryIntelligenceStoreImpl(db)
  memoryEngine.setIntelligenceStore(memoryIntelStore)

  // Read workspace hint for profile base directory (set by setup wizard)
  const workspaceHint = (await db.getWorkspaceHint()) ?? 'chrome-profiles'

  const governor = new ChromeGovernor(govStore, {
    portRange: [9300, 9400],
    healthProbeIntervalMs: 30_000,
    healthProbeTimeoutMs: 5_000,
    autoRestart: true,
    maxRestarts: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60_000,
    profileBaseDir: workspaceHint,
  })

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
  } catch {
    /* knowledge ingestion not available */
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
    } catch {
      const { MiniLmEmbeddingProvider } = await import('../engines/embedding-minilm.js')
      embedding = new MiniLmEmbeddingProvider()
    }

    semanticSearch = new SemanticSearchEngine(ssStore, embedding, db)
  } catch {
    /* semantic search not available */
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
  } catch {
    /* synthesizer not available */
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
  } catch {
    /* export engine not available */
  }

  // Mux engines (optional — wired if stores are available)
  let providerMux: import('../engines/provider-mux.js').ProviderMuxEngine | undefined
  let costOptimizer: import('../engines/cost-optimizer.js').CostOptimizer | undefined

  try {
    const { CostOptimizer } = await import('../engines/cost-optimizer.js')
    const { CostStoreImpl } = await import('../storage/impl/cost-store-impl.js')
    const costStore = new CostStoreImpl(db)
    costOptimizer = new CostOptimizer(costStore)
  } catch {
    /* cost optimizer not available */
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
  } catch {
    /* provider mux not available */
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
    // Allow harness DB programs (prog-* capabilities) to be executed through
    // the One Entry Point without pre-registration. Lazy-resolved on first
    // request and cached in the registry for subsequent calls.
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
    // Collapses `llm-test` into the One Entry Point — no parallel CLI command
    // tree, the orchestrator runs through the registry handler.
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
    // Expose every mcp-surface capability as a live MCP tool over WebSocket so
    // the llm-testing mcp adapter can actually discover + invoke them. Without
    // this the mcp surface silently yields 0 tests and parity is meaningless.
    try {
      const { McpServerAdapter } = await import('../engines/mcp-server-adapter.js')
      const mcpServer = new McpServerAdapter(governor, registry)
      const mcpStartPort = config.mcpPort ?? port + 1
      let mcpPort = mcpStartPort
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          await mcpServer.start({ port: mcpPort, hostname: '127.0.0.1' })
          break
        } catch {
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
    // Construct the MemoryFabric once and wire it into AgentBuilderEngine so
    // every spawned agent auto-provisions a per-agent memory subsystem
    // (MemoryOracle + MemoryWarden). Capabilities are registered into `registry`.
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
      // (verifiable via devops verify-cross-surface). Per-agent subsystems for
      // spawned agents are provisioned on spawn (FR-001/FR-002).
      await memoryFabric
        .provisionAgentMemory('system', 'system-run')
        .catch((e) => log.warn({ err: e }, 'System memory subsystem provision skipped'))
      log.info('MemoryFabric + AgentBuilderEngine wired (per-agent memory enabled)')

      // ── OpenCode `serve` supervisor (feature 027, ADDITIVE, OFF by default) ──
      // Peer provider 'opencode'. Supervises a local `opencode serve` subprocess and
      // ingests its sessions into AgentSession/EventRecord. Local-first: only starts
      // when OPENCODE_SERVE_ENABLED=1. Never blocks other providers' boot.
      // Nested inside memory-fabric block — requires agenticStoreImpl in scope.
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
    // Every CDP command becomes a `cap:cdp:*` capability backed by the governor's
    // mediated transport. At boot we register the full offline protocol catalog
    // (96+ commands) and persist a CapabilityBinding row per command against the
    // `generic` provider (the automation backbone) with status `prospect` (D2
    // light gate — not yet live-verified). When a real provider slave attaches,
    // executeCdp re-registers with that providerId + `active` status.
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
      // Boot registration is unverified → prospect (D2 light gate pending).
    })
    log.info(
      `[boot] CDP capabilities: registered=${cdpResult.registered.length} bound=${cdpResult.bound.length} skipped=${cdpResult.skipped.length}`,
    )

    // ── 019: DB-driven capability snapshot ──────────────────────────────────
    // Load active bindings for registered (active) providers into an in-memory
    // map at boot. Runtime resolution reads from the snapshot (no DB hit).
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
  } catch {
    /* autonomous execution not available */
  }

  // NLCL — Natural Language Command Layer (the "comms system")
  // Deterministic parser by default; pluggable local LLM / provider LLM for fallback.
  // Available on all surfaces: REST API, CLI, MCP, frontend.
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

  // ── vivim-canvas (v7) — native composable layer system ────────────────
  // Attaches to the existing server host; every canvas op is a capability
  // (P5). Local-first store by default; primitives + oracle read from db.
  let canvasRouter: ((req: Request, url: URL) => Promise<Response>) | null = null
  try {
    const { CanvasEngine } = await import('../canvas/canvas-engine.js')
    const { InMemoryCanvasStore } = await import('../canvas/in-memory-store.js')
    const { createCanvasRouter } = await import('./canvas-router.js')
    const {
      attachCanvasWs,
      ServerLayerHost,
      corePrimitiveProviders,
      createOracleVisibility,
      RegistryCapabilityExecutor,
    } = await import('./canvas-ws.js')
    if (registry) {
      const canvasStore = new InMemoryCanvasStore()
      const host = new ServerLayerHost()
      const executor = new RegistryCapabilityExecutor(registry)
      const engine = new CanvasEngine({
        store: canvasStore,
        host,
        executor,
        oracle: createOracleVisibility(db),
        primities: corePrimitiveProviders(db),
      })
      await engine.seedCoreLayers()
      engine.registerCapabilities(registry)
      canvasRouter = createCanvasRouter({ registry } as unknown as ServerContext)
      setCanvasWsHandler(attachCanvasWs(engine))
      log.info('[boot] vivim-canvas engine wired (store: in-memory, local-first)')
    }
  } catch (err) {
    log.warn({ err }, '[boot] vivim-canvas not available')
  }

  // ── agent-canvas (P4) — agent ↔ canvas command bridge ─────────────────
  let agentCanvasRouter: ((req: Request, url: URL) => Promise<Response | null>) | null = null
  try {
    const { createAgentCanvasRouter } = await import('./agent-canvas-router.js')
    log.info('[boot] agent-canvas-router module loaded, creating router...')
    agentCanvasRouter = createAgentCanvasRouter({ registry, db } as unknown as ServerContext)
    log.info('[boot] agent-canvas router wired')
  } catch (err) {
    log.warn({ err }, '[boot] agent-canvas router not available')
  }

  // ── Kernel bootstrap ──────────────────────────────────────────────────
  // Per 0.6a spec: create kernel AFTER all engines exist, register them,
  // then start kernel + topology snapshots + shutdown hooks.
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

  const ctx: ServerContext = {
    port,
    db,
    eventBus,
    conversationManager,
    resolutionEngine,
    governor,
    knowledgeIngestion,
    semanticSearch,
    synthesizer,
    exportEngine,
    providerMux,
    costOptimizer,
    autonomousEngine,
    policyEngine,
    registry,
    nlclEngine,
    automationOrchestrator,
    kernel,
    healthKernel,
    lockManager,
    idempotencyGuard,
    retryEngine,
    memoryFabric,
    agentBuilder,
    memoryEngine,
  }

  // NodeStoreImpl — lightweight Prisma wrapper for the Universal Node Layer.
  // Instantiated here so the node-router can serve graph queries independently
  // of the memory-fabric boot sequence (which also creates its own instance).
  const nodeStoreForRouter = new (await import('../storage/impl/node-store-impl.js')).NodeStoreImpl(
    db.prisma as never,
  )
  ctx.nodeStore = nodeStoreForRouter

  // Phase 1 stores — entity containers, content, notifications, contacts, sync, media
  const { EntityContainerStoreImpl: ECS } = await import(
    '../storage/impl/entity-container-store-impl.js'
  )
  const { ContentItemStoreImpl: CIS } = await import('../storage/impl/content-item-store-impl.js')
  const { NotificationStoreImpl: NS } = await import('../storage/impl/notification-store-impl.js')
  const { ContactStoreImpl: CS } = await import('../storage/impl/contact-store-impl.js')
  const { SyncStoreImpl: SS } = await import('../storage/impl/sync-store-impl.js')
  const { MediaStoreImpl: MS } = await import('../storage/impl/media-store-impl.js')
  ctx.containerStore = new ECS(db)
  ctx.contentStore = new CIS(db)
  ctx.notificationStore = new NS(db)
  ctx.contactStore = new CS(db)
  ctx.syncStore = new SS(db)
  ctx.mediaStore = new MS(db)

  const auth = createAuthMiddleware()
  const conversationRouter = createConversationRouter(ctx)
  const knowledgeRouter = createKnowledgeRouter(ctx)
  const tunnelRouter = createTunnelRouter(ctx)
  const setupRouter = createSetupRouter(ctx)
  const muxRouter = createMuxRouter(ctx)
  const autonomousRouter =
    autonomousEngine && policyEngine
      ? createAutonomousRouter({ autonomousEngine, policyEngine })
      : null
  const nlclRouter = createNLCLRouter(nlclEngine)
  const interpretRouter = createInterpretRouter(nlclEngine)
  const capabilityRouter = ctx.registry ? createCapabilityRouter(ctx) : null
  const automationRouter = createAutomationRouter({ orchestrator: automationOrchestrator })
  const memoryRouter = ctx.memoryEngine ? createMemoryVizRouter(ctx.memoryEngine) : null
  const nodeRouter = createNodeRouter(ctx)
  const storageRouter = relocationEngine ? createStorageRouter({ relocationEngine }) : null

  const containersRouter = createContainersRouter(ctx)
  const contentRouter = createContentRouter(ctx)
  const notificationsRouter = createNotificationsRouter(ctx)
  const contactsRouter = createContactsRouter(ctx)
  const syncRouter = createSyncRouter(ctx)
  const mediaRouter = createMediaRouter(ctx)

  // Unit 2.7 — forward conversation events to subscribed WebSocket frontends
  registerConversationForwarder(eventBus)
  // Canvas mutation + node-level event forwarders (v8 canvas UI)
  registerCanvasMutationForwarder(eventBus)
  registerNodeEventForwarder(eventBus)

  let ready = false

  // ── OpenCode `serve` routes (feature 029) ──────────────────────────────
  async function handleOpenCodeRoutes(
    req: Request,
    url: URL,
    serve: {
      client: import('../engines/opencode/opencode-client.js').OpenCodeClient
      ingest: import('../engines/opencode/opencode-ingest.js').OpenCodeIngest
    },
  ): Promise<Response> {
    const { client, ingest } = serve
    const path = url.pathname

    // POST /api/opencode/send
    if (path === '/api/opencode/send' && req.method === 'POST') {
      const body = (await req.json()) as { prompt?: string; sessionId?: string; model?: string }
      if (!body.prompt?.trim()) {
        return json({ error: 'prompt is required' }, 400)
      }
      try {
        let sessionId = body.sessionId
        if (!sessionId) {
          const created = await client.createSession({ model: body.model })
          sessionId = created.sessionId
        }
        await ingest.start(sessionId, { model: body.model })
        await client.sendPrompt(sessionId, body.prompt)
        return json({ ok: true, sessionId, text: `Prompt sent to session ${sessionId}` })
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    }

    // POST /api/opencode/session
    if (path === '/api/opencode/session' && req.method === 'POST') {
      const body = (await req.json()) as { model?: string; cwd?: string }
      try {
        const { sessionId } = await client.createSession({ model: body.model, cwd: body.cwd })
        return json({ ok: true, sessionId })
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    }

    // GET /api/opencode/sessions
    if (path === '/api/opencode/sessions' && req.method === 'GET') {
      return json({ ok: true, sessions: [], text: 'Session listing requires the ingest layer.' })
    }

    // POST /api/opencode/permission/:id
    if (path.startsWith('/api/opencode/permission/') && req.method === 'POST') {
      const permissionId = path.split('/').pop()
      const body = (await req.json()) as { sessionId?: string; decision?: string }
      if (!body.sessionId || !permissionId || !body.decision) {
        return json({ error: 'sessionId, permissionId, and decision are required' }, 400)
      }
      try {
        await client.respondPermission(
          body.sessionId,
          permissionId,
          body.decision as 'allow' | 'deny' | 'allow_always',
        )
        return json({ ok: true, sessionId: body.sessionId, permissionId, decision: body.decision })
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    }

    return json({ error: 'Not found', code: 'NotFound' }, 404)
  }

  const { boundPort } = startOnFreePort(
    {
      async fetch(req, server) {
        const url = new URL(req.url)

        // CORS preflight — allow all origins, methods, headers
        if (req.method === 'OPTIONS') {
          return new Response(null, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, QUERY',
              'Access-Control-Allow-Headers':
                'Content-Type, Authorization, X-Source, X-Trace-Id, X-Request-Id',
              'Access-Control-Max-Age': '86400',
            },
          })
        }

        if (url.pathname === '/health') {
          return json({ status: 'ok', version: '1.0.0' })
        }

        if (url.pathname === '/readyz') {
          if (!ready) {
            return json({ status: 'not_ready', reason: 'server still starting' }, 503)
          }
          return json({ status: 'ready', uptime: process.uptime() })
        }

        if (url.pathname.startsWith('/api/setup/')) {
          return setupRouter(req)
        }

        if (url.pathname === '/ws') {
          const ok = server.upgrade(req, { data: {} })
          return ok
            ? new Response(null, { status: 101 })
            : errorResponse('WebSocket upgrade failed', 'UpgradeFailed', 400)
        }

        if (isShuttingDown) {
          return json({ error: 'Server shutting down', code: 'ShuttingDown' }, 503)
        }

        const authResult = auth(req)
        if (authResult) return authResult

        // Mux routes
        if (url.pathname.startsWith('/api/route/')) {
          return muxRouter(req)
        }

        // Autonomous execution routes
        if (url.pathname.startsWith('/api/autonomous/') && autonomousRouter) {
          return autonomousRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        // NLCL — Natural Language Command Layer routes
        if (url.pathname.startsWith('/api/nlcl/')) {
          return nlclRouter(req)
        }

        // Interpret — NLCL interpret + execute (frontend DevConsole)
        if (url.pathname === '/api/interpret' && req.method === 'POST') {
          return interpretRouter(req)
        }

        // OpenCode `serve` capability routes (feature 029)
        if (url.pathname.startsWith('/api/opencode/')) {
          const serve = (globalThis as Record<string, unknown>).__opencodeServe as
            | {
                client: import('../engines/opencode/opencode-client.js').OpenCodeClient
                ingest: import('../engines/opencode/opencode-ingest.js').OpenCodeIngest
              }
            | undefined
          if (!serve) {
            return json({ error: 'OpenCode serve not enabled', code: 'OPENCODE_DISABLED' }, 503)
          }
          return handleOpenCodeRoutes(req, url, serve)
        }

        // Automation — governor-mediated browser automation (B9 / L7)
        if (url.pathname.startsWith('/api/automate/')) {
          return automationRouter(req, url).then((r) => r ?? conversationRouter(req))
        }

        if (url.pathname.startsWith('/api/knowledge/')) {
          return knowledgeRouter(req)
        }

        // Tunnel + P2P subsystem routes
        if (url.pathname.startsWith('/api/tunnel/')) {
          return tunnelRouter(req)
        }

        // Next Tranche routes — containers, content, notifications, contacts, sync, media
        if (url.pathname.startsWith('/api/containers/')) {
          return containersRouter(req)
        }
        if (url.pathname.startsWith('/api/content/')) {
          return contentRouter(req)
        }
        if (url.pathname.startsWith('/api/notifications/')) {
          return notificationsRouter(req)
        }
        if (url.pathname.startsWith('/api/contacts/')) {
          return contactsRouter(req)
        }
        if (url.pathname.startsWith('/api/sync/')) {
          return syncRouter(req)
        }
        if (url.pathname.startsWith('/api/media/')) {
          return mediaRouter(req)
        }

        // Node graph query routes (universal node layer)
        if (url.pathname.startsWith('/api/nodes/')) {
          return nodeRouter(req)
        }

        // Storage management routes
        if (url.pathname.startsWith('/api/storage/') && storageRouter) {
          return storageRouter(req)
        }

        if (url.pathname.startsWith('/api/memory/') && memoryRouter) {
          const bodyText = req.method === 'GET' ? undefined : await req.text()
          return memoryRouter({ url: req.url, method: req.method, body: bodyText }).then(
            (r) =>
              new Response(JSON.stringify(r.body), {
                status: r.status,
                headers: { 'Content-Type': 'application/json' },
              }),
          )
        }

        // vivim-canvas routes (v7.12) — capability plane over HTTP
        if (url.pathname.startsWith('/api/canvas/') && canvasRouter) {
          return canvasRouter(req, url)
        }

        // agent-canvas routes (P4) — agent ↔ canvas command bridge
        if (url.pathname.startsWith('/api/agent/canvas/') && agentCanvasRouter) {
          log.debug({ pathname: url.pathname }, '[server] routing to agentCanvasRouter')
          const result = await agentCanvasRouter(req, url)
          log.debug({ result: result ? 'Response' : 'null' }, '[server] agentCanvasRouter result')
          if (result) return result
        }

        // ── System admin routes (provider snapshot refresh) ────────────────
        if (url.pathname === '/api/system/refresh-provider-snapshot' && req.method === 'POST') {
          try {
            const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
            const { CapabilitySnapshot: CapSnapshot } = await import(
              '../engines/capability-snapshot.js'
            )
            const pStore = new ProviderStoreImpl(db)
            const registeredProviders = (await pStore.listDefinitions({ isActive: true })).map(
              (d) => d.id,
            )
            const newSnapshot = new CapSnapshot(
              await import('../storage/impl/capability-store-impl.js').then(
                (m) => new m.CapabilityStoreImpl(db),
              ),
            )
            const count = await newSnapshot.load(registeredProviders)
            if (governor) {
              governor.setCapabilitySnapshot(newSnapshot)
            }
            log.info(
              { providers: registeredProviders.length, entries: count },
              '[system] Provider snapshot refreshed',
            )
            return json({
              ok: true,
              providers: registeredProviders.length,
              entries: count,
              providerIds: registeredProviders,
            })
          } catch (err) {
            log.error({ err }, '[system] Failed to refresh provider snapshot')
            return json({ error: err instanceof Error ? err.message : String(err) }, 500)
          }
        }

        // 24.1/24.2 — universal capability transport (execute + introspection)
        if (url.pathname.startsWith('/api/capabilities') && capabilityRouter) {
          return capabilityRouter(req, url)
        }

        // Static file serving (env-gated: FRONTEND_DIR)
        const frontendDir = process.env.FRONTEND_DIR
        if (frontendDir) {
          try {
            const filePath = join(frontendDir, url.pathname === '/' ? 'index.html' : url.pathname)
            if (existsSync(filePath)) {
              return new Response(Bun.file(filePath))
            }
            // SPA fallback: serve index.html for non-file paths
            if (!url.pathname.includes('.')) {
              const indexPath = join(frontendDir, 'index.html')
              if (existsSync(indexPath)) {
                return new Response(Bun.file(indexPath))
              }
            }
          } catch {
            // Fall through to conversationRouter
          }
        }

        return conversationRouter(req)
      },
      websocket: {
        open(ws) {
          handleWebSocket.open(ws)
        },
        message(ws, message) {
          handleWebSocket.message(ws, message, eventBus)
        },
        close(ws) {
          handleWebSocket.close(ws, eventBus)
        },
      },
    },
    port,
  )

  ctx.port = boundPort
  ready = true
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  return ctx
}

// NOTE: The `import.meta.main` block was removed because `bun build --compile`
// causes it to fire even when the module is imported as a dependency (e.g. from
// src/desktop/sidecar-entry.ts). This created a duplicate server on config.port
// that stole the DB lock before the sidecar's own server could start.
// The sidecar entry (src/desktop/sidecar-entry.ts) is the true entry point
// for the compiled binary and handles port/host configuration.
