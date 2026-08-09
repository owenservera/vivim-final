// src/server/index.ts
// Bun.serve — REST API + WebSocket server entry point
//
// ── BOOT GRAPH (FIX-A1-2, session 1) ────────────────────────────────────────
// This file exposes exactly TWO entry points:
//   - `createServer(port)`            — minimal stub path (db-only). Used by
//                                       tooling, tests, and the boot phase
//                                       tracker. Does NOT call bootstrapEngines.
//   - `createServerWithEngines(port)` — full production boot. The ONLY caller
//                                       of `bootstrapEngines` (which itself is
//                                       a thin re-export of the canonical
//                                       `orchestrateBootstrap` in
//                                       `src/server/bootstrap/orchestrator.ts`).
//
// The boot phase order (config → stores → engines → caps → routes) is enforced
// by `orchestrateBootstrap` and verified by invariant B13
// (`devops/invariants.ts:checkB13_BootGraphCanon`). Any other module that
// imports `bootstrapEngines` is a regression and will fail the arch test
// (`tests/arch/boundary-cdp.test.ts`).
//
// `BootPhase` type below tracks how far the boot has progressed:
//   - `db-only`       — only `db` is guaranteed
//   - `seeds-done`    — seed data loaded
//   - `engines-ready` — all stores, engines, and capability registrations complete
//   - `fully-booted`  — kernel boot, health kernel, onboarding pipeline done
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CapabilityEventBus } from '../engines/capability-event-bus.js'
import type { CapabilityResolutionEngine } from '../engines/capability-resolution.js'
import type { ChromeGovernor } from '../engines/chrome-governor.js'
import type { ConceptualModelService } from '../engines/conceptual-model-service.js'
import type { ConversationManager } from '../engines/conversation-manager.js'
import type { CostOptimizer } from '../engines/cost-optimizer.js'
import type { CrossConversationSynthesizer } from '../engines/cross-conversation-synthesis.js'
import type { ExportEngine } from '../engines/export.js'
import { InMemoryGenerativeTaskStore } from '../engines/generative/generative-task-store.js'
import type { IdempotencyGuard } from '../engines/idempotency-guard.js'
import type { Kernel } from '../engines/kernel/kernel-context.js'
import type { KnowledgeIngestionEngine } from '../engines/knowledge-ingestion.js'
import type { LockManager } from '../engines/lock-manager.js'
import { NLCLEngine } from '../engines/nlcl/nlcl-engine.js'
import type { ProviderHealthKernel } from '../engines/provider-health.js'
import type { ProviderMuxEngine } from '../engines/provider-mux.js'
import type { RetryEngine } from '../engines/retry-engine.js'
import type { SemanticSearchEngine } from '../engines/semantic-search.js'
import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import type { UserIdentityEngine } from '../engines/user-identity.js'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import { type CapStoreDb, getDb } from '../storage/db.js'
import { createAuthMiddleware } from './auth-gate.js'
import { createAutomationRouter } from './automation-router.js'
import { createAutonomousRouter } from './autonomous-router.js'
import { bootstrapEngines } from './bootstrap-engines.js'
import { createCapabilityRouter } from './capability-router.js'
import { createChromeRouter } from './chrome-router.js'
import { createConversationRouter } from './conversation-router.js'
import { createConversationSyncRouter } from './conversation-sync-router.js'
import { createGenerativeRouter } from './generative-router.js'
import { createInterpretRouter } from './interpret-router.js'
import { createLlmHarnessRouter } from './llm-harness-router.js'
import { createMemoryVizRouter } from './memory-viz-router.js'
import { createMutationRouter } from './mutation-router.js'
import { createMuxRouter } from './mux-router.js'
import { createNLCLRouter } from './nlcl-router.js'
import { createNodeRouter } from './node-router.js'
import { createPluginBuilderRouter } from './plugin-builder-router.js'
import { dispatch, errorResponse, json } from './response.js'
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

/**
 * Boot phase discriminator. Callers can narrow what's available on ServerContext
 * by checking `ctx.phase` rather than testing individual optional fields.
 *
 * - `db-only`       — only `db` is guaranteed
 * - `seeds-done`    — seed data loaded
 * - `engines-ready` — all stores, engines, and capability registrations complete
 * - `fully-booted`  — kernel boot, health kernel, onboarding pipeline done
 */
export type BootPhase = 'db-only' | 'seeds-done' | 'engines-ready' | 'fully-booted'

export interface ServerContext {
  port: number
  phase: BootPhase
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
 * Match a pathname + method against any capability's declared apiEndpoint.
 * Handles `{param}` and `:param` placeholders in the path.
 * Returns the matched capability + extracted path params, or null.
 */
function matchCapabilityEndpoint(
  registry: import('../engines/unified-registry.js').UnifiedCapabilityRegistry,
  pathname: string,
  method: string,
): {
  cap: import('../engines/unified-registry.js').UnifiedCapability
  pathParams: Record<string, string>
} | null {
  const caps = registry.list({ surface: 'api' })
  for (const cap of caps) {
    if (!cap.apiEndpoint) continue
    if (cap.apiEndpoint.method.toUpperCase() !== method.toUpperCase()) continue
    const declared = cap.apiEndpoint.path
    // Convert /api/foo/{id}/bar or /api/foo/:id/bar → regex
    const paramNames: string[] = []
    const regexStr = declared
      .replace(/\{([^}]+)\}/g, (_, name) => {
        paramNames.push(name)
        return '([^/]+)'
      })
      .replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name)
        return '([^/]+)'
      })
    const regex = new RegExp(`^${regexStr}$`)
    const match = pathname.match(regex)
    if (match) {
      const pathParams: Record<string, string> = {}
      paramNames.forEach((name, i) => {
        pathParams[name] = decodeURIComponent(match[i + 1] ?? '')
      })
      return { cap, pathParams }
    }
  }
  return null
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
      } catch (err) {
        catchDebug(err, 'server:index:188')
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

  const ctx: ServerContext = { port, phase: 'db-only', db, eventBus, nlclEngine }

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
  const conversationSyncRouter = createConversationSyncRouter(ctx)
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

        // ── Session 2: trace-ID for log correlation ──────────────────────────
        // Every response gets an X-Trace-Id header so logs across the stack can
        // be correlated. If the client sends X-Trace-Id, we honor it; otherwise
        // we generate one. This is a minimal inline implementation of what the
        // dead middleware pipeline (src/server/middleware/trace-propagation.ts)
        // was supposed to do — wired here to avoid a risky handler refactor.
        const traceId =
          req.headers.get('X-Trace-Id') ??
          `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

        /** Wrap a Response with the X-Trace-Id + CORS headers. */
        const withTrace = (res: Response): Response => {
          const headers = new Headers(res.headers)
          if (!headers.has('X-Trace-Id')) headers.set('X-Trace-Id', traceId)
          headers.set('Access-Control-Allow-Origin', '*')
          headers.set('Access-Control-Expose-Headers', 'X-Trace-Id')
          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers,
          })
        }

        // CORS preflight — allow all origins, methods, headers
        if (req.method === 'OPTIONS') {
          return withTrace(
            new Response(null, {
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, QUERY',
                'Access-Control-Allow-Headers':
                  'Content-Type, Authorization, X-Source, X-Trace-Id, X-Request-Id',
                'Access-Control-Max-Age': '86400',
              },
            }),
          )
        }

        if (url.pathname === '/health') {
          return withTrace(json({ status: 'ok', version: '1.0.0' }))
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
            return errorResponse('OpenAPI spec not found', 'NotFound', 404)
          } catch {
            return errorResponse('Failed to load OpenAPI spec', 'InternalError', 500)
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
            : errorResponse('WebSocket upgrade failed', 'ValidationError', 400)
        }

        // Reject requests during shutdown
        if (isShuttingDown) {
          return errorResponse('Server shutting down', 'ServiceUnavailable', 503)
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
        if (url.pathname.startsWith('/api/conversations/sync/')) {
          return conversationSyncRouter(req)
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
          return dispatch(
            () => chromeRouter(req, url),
            () => conversationRouter(req),
          )
        }

        // Generative engine routes
        if (url.pathname.startsWith('/api/generative/')) {
          return generativeRouter(req)
        }

        // LLM harness routes
        if (url.pathname.startsWith('/api/harness/')) {
          return dispatch(
            () => llmHarnessRouter(req, url),
            () => conversationRouter(req),
          )
        }

        // Mutation routes
        if (url.pathname.startsWith('/api/mutation/')) {
          return dispatch(
            () => mutationRouter(req, url),
            () => conversationRouter(req),
          )
        }

        // Plugin builder routes
        if (url.pathname.startsWith('/api/plugins/')) {
          return dispatch(
            () => pluginBuilderRouter(req, url),
            () => conversationRouter(req),
          )
        }

        // Surface routes
        if (url.pathname.startsWith('/api/surface/')) {
          return dispatch(
            () => surfaceRouter(req, url),
            () => conversationRouter(req),
          )
        }

        // Template routes
        if (url.pathname.startsWith('/api/template/')) {
          return dispatch(
            () => templateRouter(req, url),
            () => conversationRouter(req),
          )
        }

        // Variant routes
        if (url.pathname.startsWith('/api/variant/')) {
          return dispatch(
            () => variantRouter(req, url),
            () => conversationRouter(req),
          )
        }

        // Version routes
        if (url.pathname.startsWith('/api/version/')) {
          return dispatch(
            () => versionRouter(req, url),
            () => conversationRouter(req),
          )
        }

        // Update routes
        if (url.pathname.startsWith('/api/update/')) {
          return dispatch(
            () => updateRouter(req, url),
            () => conversationRouter(req),
          )
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
          } catch (err) {
            catchDebug(err, 'server:index:496')
            // Fall through to conversationRouter
          }
        }

        // Session 2: global error safety net + trace-ID on final response.
        return conversationRouter(req)
          .then((res: Response) => withTrace(res))
          .catch((err: unknown) => {
            log.error(
              {
                traceId,
                pathname: url.pathname,
                err: err instanceof Error ? err.message : String(err),
              },
              'unhandled error in request routing',
            )
            return withTrace(
              json(
                {
                  error: err instanceof Error ? err.message : 'Internal Server Error',
                  code: 'InternalError',
                  traceId,
                },
                500,
              ),
            )
          })
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
  ctx.phase = 'engines-ready'
  ready = true

  // Register signal handlers for graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  return ctx
}

/**
 * Full bootstrap — wires all engines into the server context.
 * Call this when you need a working server with real engine backing.
 */
export async function createServerWithEngines(port = 9420): Promise<ServerContext> {
  const engines = await bootstrapEngines(port)

  const ctx: ServerContext = {
    port,
    phase: 'db-only',
    db: engines.db,
    eventBus: engines.eventBus,
    conversationManager: engines.conversationManager,
    resolutionEngine: engines.resolutionEngine,
    governor: engines.governor,
    knowledgeIngestion: engines.knowledgeIngestion,
    semanticSearch: engines.semanticSearch,
    synthesizer: engines.synthesizer,
    exportEngine: engines.exportEngine,
    providerMux: engines.providerMux,
    costOptimizer: engines.costOptimizer,
    autonomousEngine: engines.autonomousEngine,
    policyEngine: engines.policyEngine,
    registry: engines.registry,
    nlclEngine: engines.nlclEngine,
    automationOrchestrator: engines.automationOrchestrator,
    kernel: engines.kernel,
    healthKernel: engines.healthKernel,
    lockManager: engines.lockManager,
    idempotencyGuard: engines.idempotencyGuard,
    retryEngine: engines.retryEngine,
    memoryFabric: engines.memoryFabric,
    agentBuilder: engines.agentBuilder,
    memoryEngine: engines.memoryEngine,
    nodeStore: engines.nodeStore,
    containerStore: engines.containerStore,
    contentStore: engines.contentStore,
    notificationStore: engines.notificationStore,
    contactStore: engines.contactStore,
    syncStore: engines.syncStore,
    mediaStore: engines.mediaStore,
  }

  // ── vivim-canvas (v7) — native composable layer system ────────────────
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
    if (engines.registry) {
      const canvasStore = new InMemoryCanvasStore()
      const host = new ServerLayerHost()
      const executor = new RegistryCapabilityExecutor(engines.registry)
      const engine = new CanvasEngine({
        store: canvasStore,
        host,
        executor,
        oracle: createOracleVisibility(engines.db),
        primities: corePrimitiveProviders(engines.db),
      })
      await engine.seedCoreLayers()
      engine.registerCapabilities(engines.registry)
      canvasRouter = createCanvasRouter(ctx)
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
    agentCanvasRouter = createAgentCanvasRouter(ctx)
    log.info('[boot] agent-canvas router wired')
  } catch (err) {
    log.warn({ err }, '[boot] agent-canvas router not available')
  }

  const auth = createAuthMiddleware()
  const conversationRouter = createConversationRouter(ctx)
  const knowledgeRouter = createKnowledgeRouter(ctx)
  const tunnelRouter = createTunnelRouter(ctx)
  const setupRouter = createSetupRouter(ctx)
  const muxRouter = createMuxRouter(ctx)
  const autonomousRouter =
    engines.autonomousEngine && engines.policyEngine
      ? createAutonomousRouter({
          autonomousEngine: engines.autonomousEngine,
          policyEngine: engines.policyEngine,
        })
      : null
  const nlclRouter = createNLCLRouter(engines.nlclEngine)
  const interpretRouter = createInterpretRouter(engines.nlclEngine)
  const capabilityRouter = engines.registry ? createCapabilityRouter(ctx) : null
  const automationRouter = createAutomationRouter({ orchestrator: engines.automationOrchestrator })
  const memoryRouter = engines.memoryEngine ? createMemoryVizRouter(engines.memoryEngine) : null
  const nodeRouter = createNodeRouter(ctx)
  const storageRouter = engines.relocationEngine
    ? createStorageRouter({ relocationEngine: engines.relocationEngine })
    : null

  const containersRouter = createContainersRouter(ctx)
  const contentRouter = createContentRouter(ctx)
  const notificationsRouter = createNotificationsRouter(ctx)
  const contactsRouter = createContactsRouter(ctx)
  const syncRouter = createSyncRouter(ctx)
  const mediaRouter = createMediaRouter(ctx)
  const updateRouter = createUpdateRouter()

  registerConversationForwarder(engines.eventBus)
  registerCanvasMutationForwarder(engines.eventBus)
  registerNodeEventForwarder(engines.eventBus)

  let ready = false

  async function handleOpenCodeRoutes(
    req: Request,
    url: URL,
    serve: {
      client: import('../engines/opencode/opencode-client.js').OpenCodeClient
      ingest: import('../engines/opencode/opencode-ingest.js').OpenCodeIngest
      supervisor: import('../engines/opencode/opencode-supervisor.js').OpenCodeSupervisor
    },
  ): Promise<Response> {
    const { client, ingest, supervisor } = serve
    const path = url.pathname

    if (path === '/api/opencode/send' && req.method === 'POST') {
      const body = (await req.json()) as { prompt?: string; sessionId?: string; model?: string }
      if (!body.prompt?.trim()) {
        return errorResponse('prompt is required', 'ValidationError', 400)
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
        return errorResponse(err instanceof Error ? err.message : String(err), 'InternalError', 500)
      }
    }

    if (path === '/api/opencode/session' && req.method === 'POST') {
      const body = (await req.json()) as { model?: string; cwd?: string }
      try {
        const { sessionId } = await client.createSession({ model: body.model, cwd: body.cwd })
        return json({ ok: true, sessionId })
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err), 'InternalError', 500)
      }
    }

    if (path === '/api/opencode/sessions' && req.method === 'GET') {
      try {
        const sessions = await client.listSessions()
        return json({ ok: true, sessions, count: sessions.length })
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err), 'InternalError', 500)
      }
    }

    if (path === '/api/opencode/instances' && req.method === 'GET') {
      // Instance register + live classifier: which opencode process is vivim's
      // (managed) vs the user's interactive session (external). Never kill by
      // image name — consult this endpoint first.
      try {
        const classified = supervisor.getRegistry().classifyLive()
        const ledger = supervisor.getRegistry().readLedger()
        return json({
          ok: true,
          managed: classified.filter((p) => p.managed),
          external: classified.filter((p) => !p.managed),
          current: {
            instanceId: supervisor.getInstanceId(),
            pid: supervisor.getPid(),
            port: supervisor.getPort(),
            running: supervisor.isRunning(),
          },
          ledgerCount: ledger.length,
        })
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err), 'InternalError', 500)
      }
    }

    if (path.startsWith('/api/opencode/permission/') && req.method === 'POST') {
      const permissionId = path.split('/').pop()
      const body = (await req.json()) as { sessionId?: string; decision?: string }
      if (!body.sessionId || !permissionId || !body.decision) {
        return errorResponse(
          'sessionId, permissionId, and decision are required',
          'ValidationError',
          400,
        )
      }
      try {
        await client.respondPermission(
          body.sessionId,
          permissionId,
          body.decision as 'allow' | 'deny' | 'allow_always',
        )
        return json({ ok: true, sessionId: body.sessionId, permissionId, decision: body.decision })
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err), 'InternalError', 500)
      }
    }

    return errorResponse('Not found', 'NotFound', 404)
  }

  const { boundPort } = startOnFreePort(
    {
      async fetch(req, server) {
        const url = new URL(req.url)

        // ── Session 2: trace-ID for log correlation (production handler) ──────
        const traceId =
          req.headers.get('X-Trace-Id') ??
          `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

        const withTrace = (res: Response): Response => {
          const headers = new Headers(res.headers)
          if (!headers.has('X-Trace-Id')) headers.set('X-Trace-Id', traceId)
          headers.set('Access-Control-Allow-Origin', '*')
          headers.set('Access-Control-Expose-Headers', 'X-Trace-Id')
          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers,
          })
        }

        if (req.method === 'OPTIONS') {
          return withTrace(
            new Response(null, {
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, QUERY',
                'Access-Control-Allow-Headers':
                  'Content-Type, Authorization, X-Source, X-Trace-Id, X-Request-Id',
                'Access-Control-Max-Age': '86400',
              },
            }),
          )
        }

        if (url.pathname === '/health') {
          return withTrace(json({ status: 'ok', version: '1.0.0' }))
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
            : errorResponse('WebSocket upgrade failed', 'ValidationError', 400)
        }

        if (isShuttingDown) {
          return errorResponse('Server shutting down', 'ServiceUnavailable', 503)
        }

        const authResult = auth(req)
        if (authResult) return authResult

        // Desktop sidecar: ported frontend App Router bag. Runs FIRST — right after
        // the auth gate, before every backend prefix router. The WebView served its
        // /api/* entirely from the frontend App Router at dev time, so an exact table
        // path (e.g. /api/canvas/shell, /api/canvas/definition/[id],
        // /api/media/open, /api/storage/health) must win over backend prefix routers
        // that would otherwise swallow it (the canvas router 404s shell, the media
        // :id matcher catches open, the storage router 404s health). Backend keeps
        // priority for every path with no frontend table entry. Only exact
        // path+verb matches resolve; null falls through to the backend chain.
        if (url.pathname.startsWith('/api/')) {
          try {
            const { dispatchFrontendRoute } = await import('../desktop/frontend-route-mount.js')
            const ported = await dispatchFrontendRoute(req, url)
            if (ported) return withTrace(ported)
          } catch (err) {
            // Frontend route bag unavailable (dev/test bundles without frontend):
            // fall through to the normal backend routing chain.
            catchDebug(err, 'server:index:dispatchFrontendRoute')
          }
        }

        if (url.pathname.startsWith('/api/route/')) return muxRouter(req)
        if (url.pathname.startsWith('/api/autonomous/') && autonomousRouter) {
          return dispatch(
            () => autonomousRouter(req, url),
            () => conversationRouter(req),
          )
        }
        if (url.pathname.startsWith('/api/nlcl/')) return nlclRouter(req)
        if (url.pathname === '/api/interpret' && req.method === 'POST') {
          return interpretRouter(req)
        }
        // F1: Live POST /api/agent/run route — calls the cap:agent:run capability
        // via the unified registry (mirrors the universal execute path).
        if (url.pathname === '/api/agent/run' && req.method === 'POST') {
          const body = (await req.json().catch(() => ({}))) as {
            prompt?: string
            model?: string
            sessionId?: string
            cwd?: string
          }
          if (!body.prompt?.trim()) {
            return errorResponse('prompt is required', 'ValidationError', 400)
          }
          const registry = engines.registry
          if (!registry) {
            return errorResponse('Capability registry not ready', 'NotAvailable', 503)
          }
          try {
            const cap = registry.get('cap:agent:run')
            if (!cap) {
              return errorResponse('cap:agent:run not registered', 'NotAvailable', 504)
            }
            const result = await cap.handler(
              {
                prompt: String(body.prompt),
                model: body.model,
                sessionId: body.sessionId,
                cwd: body.cwd,
              },
              { metadata: {} },
            )
            return withTrace(json(result))
          } catch (err) {
            return errorResponse(String(err), 'ExecutionError', 500)
          }
        }
        if (url.pathname.startsWith('/api/opencode/')) {
          const serve = (globalThis as Record<string, unknown>).__opencodeServe as
            | {
                client: import('../engines/opencode/opencode-client.js').OpenCodeClient
                ingest: import('../engines/opencode/opencode-ingest.js').OpenCodeIngest
                supervisor: import('../engines/opencode/opencode-supervisor.js').OpenCodeSupervisor
              }
            | undefined
          if (!serve) {
            return errorResponse('OpenCode serve not enabled', 'NotAvailable', 503)
          }
          return handleOpenCodeRoutes(req, url, serve)
        }
        if (url.pathname.startsWith('/api/automate/')) {
          return dispatch(
            () => automationRouter(req, url),
            () => conversationRouter(req),
          )
        }
        if (url.pathname.startsWith('/api/knowledge/')) return knowledgeRouter(req)
        if (url.pathname.startsWith('/api/tunnel/')) return tunnelRouter(req)
        if (url.pathname.startsWith('/api/containers/')) return containersRouter(req)
        if (url.pathname.startsWith('/api/content/')) return contentRouter(req)
        if (url.pathname.startsWith('/api/notifications/')) return notificationsRouter(req)
        if (url.pathname.startsWith('/api/contacts/')) return contactsRouter(req)
        if (url.pathname.startsWith('/api/sync/')) return syncRouter(req)
        if (url.pathname.startsWith('/api/media/')) return mediaRouter(req)
        if (url.pathname.startsWith('/api/update/')) return updateRouter(req, url)
        if (url.pathname.startsWith('/api/nodes/')) return nodeRouter(req)
        if (url.pathname.startsWith('/api/storage/') && storageRouter) return storageRouter(req)
        if (url.pathname.startsWith('/api/memory/') && memoryRouter) {
          // Session 3: memory-viz-router now returns Response directly (was {status, body}).
          return memoryRouter(req)
        }
        if (url.pathname.startsWith('/api/canvas/') && canvasRouter) {
          return canvasRouter(req, url)
        }
        if (url.pathname.startsWith('/api/agent/canvas/') && agentCanvasRouter) {
          const result = await agentCanvasRouter(req, url)
          if (result) return result
        }

        if (url.pathname === '/api/system/refresh-provider-snapshot' && req.method === 'POST') {
          try {
            const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
            const { CapabilitySnapshot: CapSnapshot } = await import(
              '../engines/capability-snapshot.js'
            )
            const pStore = new ProviderStoreImpl(engines.db)
            const registeredProviders = (await pStore.listDefinitions({ isActive: true })).map(
              (d) => d.id,
            )
            const newSnapshot = new CapSnapshot(
              await import('../storage/impl/capability-store-impl.js').then(
                (m) => new m.CapabilityStoreImpl(engines.db),
              ),
            )
            const count = await newSnapshot.load(registeredProviders)
            if (engines.governor) {
              engines.governor.setCapabilitySnapshot(newSnapshot)
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
            return errorResponse(
              err instanceof Error ? err.message : String(err),
              'InternalError',
              500,
            )
          }
        }

        if (url.pathname.startsWith('/api/capabilities') && capabilityRouter) {
          return capabilityRouter(req, url)
        }

        // Universal apiEndpoint dispatcher: if no dedicated route matched, check if
        // the path + method matches a capability's declared apiEndpoint. If so,
        // route through registry.execute() — the single entry point.
        // This ensures EVERY declared apiEndpoint is reachable without writing a
        // dedicated route for each. (F1-style fix for all missing /api/ai/*, /api/admin/*, etc.)
        if (url.pathname.startsWith('/api/') && engines.registry) {
          const matchResult = matchCapabilityEndpoint(engines.registry, url.pathname, req.method)
          if (matchResult) {
            const { cap, pathParams } = matchResult
            try {
              const body = await req.json().catch(() => ({}))
              const input =
                typeof body === 'object' && body !== null
                  ? { ...body, ...pathParams }
                  : { ...pathParams }
              // Also merge query params
              for (const [key, value] of url.searchParams) {
                input[key] = value
              }
              const output = await engines.registry.execute(cap.id, input, { metadata: {} })
              return withTrace(json(output))
            } catch (err) {
              return withTrace(
                errorResponse(
                  err instanceof Error ? err.message : String(err),
                  'ExecutionError',
                  500,
                ),
              )
            }
          }
        }

        const frontendDir = process.env.FRONTEND_DIR
        if (frontendDir) {
          try {
            const filePath = join(frontendDir, url.pathname === '/' ? 'index.html' : url.pathname)
            if (existsSync(filePath)) {
              return new Response(Bun.file(filePath))
            }
            if (!url.pathname.includes('.')) {
              const indexPath = join(frontendDir, 'index.html')
              if (existsSync(indexPath)) {
                return new Response(Bun.file(indexPath))
              }
            }
          } catch (err) {
            catchDebug(err, 'server:index:909')
            // Fall through to conversationRouter
          }
        }

        // Session 2: global error safety net + trace-ID on final response.
        return conversationRouter(req)
          .then((res: Response) => withTrace(res))
          .catch((err: unknown) => {
            log.error(
              {
                traceId,
                pathname: url.pathname,
                err: err instanceof Error ? err.message : String(err),
              },
              'unhandled error in request routing',
            )
            return withTrace(
              json(
                {
                  error: err instanceof Error ? err.message : 'Internal Server Error',
                  code: 'InternalError',
                  traceId,
                },
                500,
              ),
            )
          })
      },
      websocket: {
        open(ws) {
          handleWebSocket.open(ws)
        },
        message(ws, message) {
          handleWebSocket.message(ws, message, engines.eventBus)
        },
        close(ws) {
          handleWebSocket.close(ws, engines.eventBus)
        },
      },
    },
    port,
  )

  ctx.port = boundPort
  ctx.phase = 'fully-booted'
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
