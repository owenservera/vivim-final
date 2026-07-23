# SERVER BOOTSTRAP / API ROUTER - FULL SOURCE CONCATENATED

> **GENERATED FROM**: `docs/server-bootstrap-api-router.md`  
> **SOURCE FILES**: `src/server/index.ts`, `src/server/conversation-router.ts`, `src/server/capability-router.ts`, `src/server/websocket.ts`, `src/server/auth-gate.ts`, `src/server/kernel-router.ts`, `src/server/setup-router.ts`  
> **GENERATION DATE**: 2025-01-XX  
> **PURPOSE**: Complete source code concatenation for Server Bootstrap system

---

## 📋 DOCUMENT HEADER (Original Generated Doc)

The `src/server/index.ts` is the **HTTP + WebSocket server entry point**. `createServerWithEngines()` performs the full boot sequence: seed → store init → engine wiring → CDP transport injection → governor boot → protocol priming → snapshot load → registry population → MCP server start → memory fabric → kernel bootstrap.

## 🎯 GOVERNING SOURCE FILES

| File | Role |
|------|------|
| `src/server/index.ts` | **Single most important server file.** `createServer(port)` — minimal shell (health, setup, WS upgrade, auth, CORS). `createServerWithEngines(port)` — **full bootstrap**: 1) seeds providers (`ProviderRegistrar.seedAll`), parsers (`seedHarvestedParsers`), taxonomy (`ensureTaxonomySeeded`), harness commands (`seedHarnessCommands`); 2) creates all `StoreImpl` instances; 3) instantiates `CapabilityResolutionEngine`, `StreamParserEngine`, `StreamBlockStore`, `ExecutionMemoizer`, `MemoryEngine`, `ChromeGovernor`, `ConversationManager`; 4) primes parser cache from generated protocol; 5) injects `CdpTransportImpl`; 6) boots governor; 7) wires optional engines (knowledge ingestion, semantic search, synthesizer, export, provider mux, autonomous execution, policy engine); 8) registers **default** capabilities and `prog-*` program resolver; 9) registers LLM-as-Human testing capabilities; 10) registers generated taxonomy capabilities; 11) starts MCP server (`McpServerAdapter`); 12) provisions per-agent memory (`MemoryFabric`); 13) bootstraps the kernel (`bootstrapKernel`); 14) starts `ProviderHealthKernel`. |
| `src/server/conversation-router.ts` | Primary REST surface: `GET/POST /api/providers`, `GET /api/providers/:id/capabilities`, `GET/POST /api/conversations`, `POST /api/conversations/:id/send`, `GET /api/conversations/:id/messages`, `DELETE /api/conversations/:id`, `POST /api/conversations/:id/capabilities/:slug/execute`, fleet start/kill, session, health, sandbox debug. |
| `src/server/capability-router.ts` | Universal capability transport: `GET /api/capabilities?surface=&category=&tag=`, `POST /api/capabilities/:id/execute`, `GET /api/capabilities/:id`. Slug resolves via `getBySlugAsync` (lazy prog-*) then executes handler. |
| `src/server/websocket.ts` | WebSocket bridge: opens connections, routes messages through `eventBus`, forwards conversation events to subscribed WS clients. |
| `src/server/auth-gate.ts` | `createAuthMiddleware` — local-first auth stub (always succeeds for POST /session). |
| `src/server/kernel-router.ts` | Kernel registration/topology routes. |
| `src/server/setup-router.ts` | First-run workspace setup (no auth required). |

---

## 🔧 KEY TYPES AND INTERFACES

```typescript
// From src/server/index.ts
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
}
```

---

## 📜 FULL SOURCE CODE CONCATENATION

### FILE 1: src/server/index.ts

```typescript
// src/server/index.ts
// Bun.serve — REST API + WebSocket server entry point
//
// Minimal shell: mounts response helpers, auth gate, conversation router,
// and WebSocket bridge. Engine wiring is deferred to the full bootstrap
// (units 5.1-5.5 are bundled; full wiring comes after all stubs exist).

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connectCapabilityRegistry } from '../cli/index.js'
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
import { type CapStoreDb, getDb } from '../storage/db.js'
import { createAuthMiddleware } from './auth-gate.js'
import { createAutomationRouter } from './automation-router.js'
import { createAutonomousRouter } from './autonomous-router.js'
import { createCapabilityRouter } from './capability-router.js'
import { createConversationRouter } from './conversation-router.js'
import { createKnowledgeRouter } from './knowledge-router.js'
import { createMemoryRouter } from './memory-router.js'
import { createMemoryVizRouter } from './memory-viz-router.js'
import { createMuxRouter } from './mux-router.js'
import { createNLCLRouter } from './nlcl-router.js'
import { errorResponse, json } from './response.js'
import { createSetupRouter } from './setup-router.js'
import { handleWebSocket, registerConversationForwarder, registerCanvasMutationForwarder, registerNodeEventForwarder, setCanvasWsHandler } from './websocket.js'

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
}

/** Shutdown hooks registered during server lifetime */
const shutdownHooks: Array<() => Promise<void>> = []
let isShuttingDown = false

export function onShutdown(hook: () => Promise<void>): void {
  shutdownHooks.push(hook)
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`\n${signal} received — shutting down gracefully...`)

  for (const hook of shutdownHooks) {
    try {
      await hook()
    } catch (err) {
      console.error('Shutdown hook error:', err)
    }
  }

  console.log('Shutdown complete.')
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
      const server = Bun.serve({ ...opts, port })
      // Write actual port so PS1 scripts + frontend can discover it
      try {
        const runtimeDir = join(process.cwd(), '.runtime')
        mkdirSync(runtimeDir, { recursive: true })
        writeFileSync(join(runtimeDir, 'backend.port'), String(port), 'utf-8')
      } catch { /* best-effort */ }
      return { server, boundPort: port }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EADDRINUSE') {
        console.warn(`[boot] Port ${port} in use, trying ${port + 1}...`)
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

  const auth = createAuthMiddleware()
  const conversationRouter = createConversationRouter(ctx)
  const knowledgeRouter = createKnowledgeRouter(ctx)
  const setupRouter = createSetupRouter(ctx)
  const muxRouter = createMuxRouter(ctx)
  const nlclRouter = createNLCLRouter(nlclEngine)

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

        // Setup routes — no auth (workspace/profile setup is first-run experience)
        if (url.pathname.startsWith('/api/setup/')) {
          return setupRouter(req)
        }

        // WebSocket upgrade
        if (url.pathname === '/ws') {
          const ok = server.upgrade(req)
          return ok ? undefined : errorResponse('WebSocket upgrade failed', 'UpgradeFailed', 400)
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

  // Seed providers at boot (idempotent upserts)
  const { ProviderStoreImpl } = await import('../storage/impl/provider-store-impl.js')
  const { ProviderRegistrar } = await import('../engines/provider-registrar.js')
  const providerStore = new ProviderStoreImpl(db)
  const registrar = new ProviderRegistrar(providerStore, undefined, eventBus)
  const seedResult = await registrar.seedAll()
  console.log(
    `[boot] Seeded ${seedResult.seeded.length} providers, ${seedResult.errors.length} errors`,
  )
  if (seedResult.errors.length > 0) {
    console.warn('[boot] Seed errors:', seedResult.errors)
  }

  // Harvest parser variants into DB inline rows (idempotent upsert). This is
  // what populates providerParser so the protocol generator and the DB fallback
  // chain both have a parser to resolve. Never called before this point.
  try {
    const { seedHarvestedParsers } = await import('../../seeds/parsers/harvest.seed.js')
    const harvested = await seedHarvestedParsers(providerStore)
    console.log(`[boot] Harvested ${harvested} parser variants into DB`)
  } catch (err) {
    console.warn('[boot] harvest parser seed skipped:', err)
  }

  // Initialize provider registry cache (loads all provider data from DB)
  const { createProviderRegistry } = await import('../config/provider-registry.js')
  const providerRegistry = createProviderRegistry(db)
  await providerRegistry.initialize()
  console.log(
    `[boot] Provider registry initialized: ${providerRegistry.getProviderList().length} providers cached`,
  )

  // Seed browser-automation substrate (idempotent: agent-loop role anchors)
  try {
    const { seedAutomation } = await import('../../seeds/automation/automation.seed.js')
    const autoCount = await seedAutomation(db)
    console.log(`[boot] Seeded ${autoCount} browser-automation records`)
  } catch (err) {
    console.warn('[boot] automation seed skipped:', err)
  }

  // Seed capability taxonomy into DB (idempotent: only when table is empty, so
  // a fresh clone or post-migration boot self-heals without `bun run seed`).
  try {
    const { ensureTaxonomySeeded } = await import('../../seeds/taxonomy/taxonomy-seed.js')
    const tax = await ensureTaxonomySeeded(db.prisma)
    if (tax.upserted > 0) {
      console.log(`[boot] Seeded ${tax.upserted} capability-taxonomy rows`)
    }
  } catch (err) {
    console.warn('[boot] taxonomy seed skipped:', err)
  }

  // Seed harness command registry (idempotent upsert; mirrors providers/parsers).
  try {
    const { seedHarnessCommands } = await import('../../seeds/harness/commands.seed.js')
    const harnessCount = await seedHarnessCommands(db)
    console.log(`[boot] Seeded ${harnessCount} harness commands`)
  } catch (err) {
    console.warn('[boot] harness command seed skipped:', err)
  }

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
    const source = normalizeProtocolSource(process.env.PROVIDER_PROTOCOL_SOURCE)
    const { protocol } = await loadProviderProtocol(source)
    await parserEngine.primeFromProtocol(protocol)
    console.log(`[boot] Stream parser cache primed from ${source} protocol`)
  } catch (err) {
    console.warn('[boot] protocol parser priming skipped:', err)
  }

  // [CONTINUED IN NEXT SECTION - File truncated for length]
  // ... Additional engine wiring, MCP server, kernel bootstrap, etc.

}
```

---

### FILE 2: src/server/conversation-router.ts

```typescript
// src/server/conversation-router.ts
// REST API router — core endpoints

import type {
  PlanTier,
  ResolvedCapabilities,
  ResolvedCapability,
} from '../engines/capability-resolution.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'

/** Flatten grouped ResolvedCapabilities into a single ordered array. */
function flattenResolved(resolved: ResolvedCapabilities): ResolvedCapability[] {
  return [
    ...resolved.composer,
    ...resolved.header,
    ...resolved.message,
    ...resolved.sidebar,
    ...resolved.inline,
  ]
}

export function createConversationRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method

    try {
      // Providers
      if (pathname === '/api/providers' && method === 'GET') {
        const providers = await ctx.db.listProviders()
        return json(providers)
      }

      if (pathname.match(/^\/api\/providers\/[^/]+$/) && method === 'GET') {
        const id = pathname.split('/')[3]
        if (!id) return errorResponse('Invalid provider id', 'ValidationError', 400)
        const provider = await ctx.db.getProvider(id)
        if (!provider) return errorResponse('Provider not found', 'NotFoundError', 404)
        return json(provider)
      }

      // GET /api/providers/:id/capabilities — delegate to CapabilityResolutionEngine
      const capMatch = pathname.match(/^\/api\/providers\/([^/]+)\/capabilities$/)
      if (capMatch && method === 'GET') {
        const providerId = capMatch[1]
        if (!providerId) return errorResponse('Invalid provider id', 'ValidationError', 400)
        if (!ctx.resolutionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const planTier = (url.searchParams.get('planTier') ?? 'free') as PlanTier
        const resolved = await ctx.resolutionEngine.resolve(providerId, planTier)
        return json({ ...resolved, capabilities: flattenResolved(resolved) })
      }

      // GET /api/conversations/:id/capabilities — resolve via the conversation's provider
      const convCapMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/capabilities$/)
      if (convCapMatch && method === 'GET') {
        const conversationId = convCapMatch[1]
        if (!conversationId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        if (!ctx.resolutionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const conversation = await ctx.db.getConversation(conversationId)
        if (!conversation) return errorResponse('Conversation not found', 'NotFoundError', 404)
        const providerId = (conversation as { providerId: string }).providerId
        const planTier = (url.searchParams.get('planTier') ?? 'free') as PlanTier
        const resolved = await ctx.resolutionEngine.resolve(providerId, planTier)
        return json({ ...resolved, capabilities: flattenResolved(resolved) })
      }

      // POST /api/conversations/:id/capabilities/:slug/execute
      const execMatch = pathname.match(
        /^\/api\/conversations\/([^/]+)\/capabilities\/([^/]+)\/execute$/,
      )
      if (execMatch && method === 'POST') {
        const conversationId = execMatch[1]
        const slug = execMatch[2]
        if (!conversationId || !slug) {
          return errorResponse('Invalid conversation or capability', 'ValidationError', 400)
        }
        if (!ctx.resolutionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const conversation = await ctx.db.getConversation(conversationId)
        if (!conversation) return errorResponse('Conversation not found', 'NotFoundError', 404)
        const providerId = (conversation as { providerId: string }).providerId

        const resolved = await ctx.resolutionEngine.resolve(providerId, 'free')
        const capability = flattenResolved(resolved).find((c) => c.slug === slug)
        if (!capability) return errorResponse('Capability not found', 'NotFoundError', 404)

        const traceId = crypto.randomUUID()
        ctx.eventBus.emit({
          type: 'capability:progress',
          step: 0,
          total: 1,
          description: `Dispatched ${slug}`,
          moduleId: capability.id,
          slaveId: conversationId,
        })

        // Execution logic continues...
        // [File truncated - see original for full implementation]
      }

      // Additional routes for conversations, messages, fleet operations, etc.
      // ...
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Internal server error',
        'InternalError',
        500,
      )
    }
  }
}
```

---

### FILE 3: src/server/capability-router.ts

```typescript
// src/server/capability-router.ts
// Unit 24.1 (universal execute route) + 24.2 (introspection route)
// The single execution transport for every capability across all surfaces.
// Mounted in createServerWithEngines after the auth gate.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import type { CapabilityContext, UnifiedCapability } from '../engines/unified-registry.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

function toDetail(cap: UnifiedCapability): Record<string, unknown> {
  return {
    id: cap.id,
    slug: cap.slug,
    name: cap.name,
    description: cap.description,
    category: cap.category,
    surfaces: cap.surfaces,
    inputSchema: cap.inputSchema,
    outputSchema: cap.outputSchema,
    cliCommand: cap.cliCommand,
    ui: cap.ui,
    uiAction: cap.uiAction,
    apiEndpoint: cap.apiEndpoint,
    workflowNodeType: cap.workflowNodeType,
    mcpToolName: cap.mcpToolName,
    requiresConfirmation: cap.requiresConfirmation,
    tags: cap.tags,
  }
}

export function createCapabilityRouter(ctx: ServerContext) {
  return async function capabilityRouter(req: Request, url: URL): Promise<Response> {
    const registry = ctx.registry
    const _source = extractSource(req)
    if (!registry) {
      return errorResponse('Capability registry not available', 'NotAvailable', 503)
    }

    // 24.2 — GET /api/capabilities?<surface>&<category>&<tag>
    if (req.method === 'GET' && url.pathname === '/api/capabilities') {
      const surface = (url.searchParams.get('surface') as any) ?? undefined
      const category = url.searchParams.get('category') ?? undefined
      const tag = url.searchParams.get('tag') ?? undefined
      const caps = registry.list({ surface, category, tag })
      return json({ capabilities: caps.map(toDetail), total: caps.length })
    }

    // 24.1 — POST /api/capabilities/:id/execute (slug alias resolves same handler)
    const execMatch = url.pathname.match(/^\/api\/capabilities\/([^/]+)\/execute$/)
    if (req.method === 'POST' && execMatch) {
      const id = decodeURIComponent(execMatch[1] ?? '')
      const cap = (await registry.getBySlugAsync(id)) ?? registry.get(id)
      if (!cap) {
        return errorResponse(`Capability ${id} not found`, 'NotFound', 404)
      }

      let body: { input?: Record<string, unknown>; ctx?: Partial<CapabilityContext> } = {}
      try {
        const parsed = await req.json()
        if (parsed && typeof parsed === 'object') {
          body = parsed as typeof body
        }
      } catch {
        body = {}
      }
      const input = (body.input ?? {}) as Record<string, unknown>

      const required = (cap.inputSchema?.required as string[] | undefined) ?? []
      for (const key of required) {
        if (!(key in input)) {
          return errorResponse(`Missing required input: ${key}`, 'ValidationError', 400)
        }
      }

      const capCtx: CapabilityContext = {
        conversationId: body.ctx?.conversationId,
        providerId: body.ctx?.providerId,
        slaveId: body.ctx?.slaveId,
        userId: body.ctx?.userId,
        metadata: (body.ctx?.metadata as Record<string, unknown>) ?? {},
      }

      try {
        const start = Date.now()
        const output = await registry.execute(cap.id, input, capCtx)
        const latencyMs = Date.now() - start
        ctx.eventBus?.emit({
          type: 'capability:executed',
          capabilityId: cap.id,
          latencyMs,
        } as any)
        return json({
          ok: true,
          capabilityId: cap.id,
          output,
          traceId: globalThis.crypto?.randomUUID?.() ?? 'n/a',
          latencyMs,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isValidation = message.startsWith('Missing required input')
        return errorResponse(message, 'ExecutionError', isValidation ? 400 : 500)
      }
    }

    // 24.2 — GET /api/capabilities/:id (single detail)
    const detailMatch = url.pathname.match(/^\/api\/capabilities\/([^/]+)$/)
    if (req.method === 'GET' && detailMatch) {
      const id = decodeURIComponent(detailMatch[1] ?? '')
      const cap = (await registry.getBySlugAsync(id)) ?? registry.get(id)
      if (!cap) {
        return errorResponse(`Capability ${id} not found`, 'NotFound', 404)
      }
      return json(toDetail(cap))
    }

    return errorResponse('Not found', 'NotFound', 404)
  }
}
```

---

## 🔍 ADDITIONAL INSIGHTS AND CONTEXT

### Architecture Overview

The server bootstrap system follows a **layered initialization pattern**:

1. **Minimal Shell** (`createServer`): Health checks, CORS, WebSocket upgrade, basic routing
2. **Full Bootstrap** (`createServerWithEngines`): Complete engine wiring with all dependencies
3. **Lazy Loading**: All heavy engines are imported dynamically to avoid circular dependencies
4. **Seed First**: Providers, parsers, taxonomy, and harness commands are seeded before engine instantiation
5. **Prime Cache**: Parser cache is primed from generated protocol for zero-DB-read hot path
6. **Wire Transport**: CDP transport injected into governor before boot
7. **Populate Registry**: Default capabilities, generated capabilities, CDP methods all registered
8. **Start Services**: MCP server, memory fabric, kernel bootstrap, health kernel

### Critical Design Decisions

1. **Single Entry Point**: All operations flow through `createServerWithEngines`
2. **Graceful Degradation**: Optional engines (knowledge, semantic search, etc.) fail gracefully
3. **Port Discovery**: Automatic port walking with `.runtime/backend.port` persistence
4. **Readiness Gate**: `/readyz` endpoint prevents traffic during boot
5. **CORS Open**: All origins allowed for local-first development
6. **Auth Stub**: Local-first auth always succeeds for POST /session

### Data Flow Patterns

```
Request → Router → Engine → Store → DB
       ↓
   EventBus → Subscribers
       ↓
   WebSocket → Clients
```

### Key Invariants

- **Governor Canon**: Only ChromeGovernor touches CDP
- **DB-Only Parsers**: Parser logic lives in DB, not in code
- **One Entry Point**: All capabilities registered once, exported to all surfaces
- **Lazy Resolution**: prog-* capabilities resolved on-demand
- **Zero DB Reads**: Hot parse path uses primed cache

---

## 📊 SYSTEM CONNECTIONS

- **UnifiedCapabilityRegistry**: server populates + bridges to CLI/MCP/UI
- **ChromeGovernor**: initialized, CDP transport injected, booted
- **StreamParserEngine**: instantiated + primed from protocol
- **ConversationManager**: instantiated with all dependencies
- **ProviderRegistrar**: seeds providers, parsers, capabilities into DB
- **CapabilityEventBus**: singleton at boot, threaded through every engine
- **Kernel**: `bootstrapKernel` registers all engines and starts topology snapshots
- **MCP**: `McpServerAdapter` exposes every `mcp`-surface capability over WebSocket

---

## 🎯 CRITICAL PATTERNS

- **Lazy Engine Import**: `createServerWithEngines` uses dynamic `import()` to avoid circular dependencies at module load
- **Graceful Shutdown**: `process.on('SIGTERM')` / `process.on('SIGINT')` → `gracefulShutdown()` runs all registered hooks
- **Port Discovery**: `startOnFreePort()` tries preferred port, walks up to +200 on `EADDRINUSE`, writes actual port to `.runtime/backend.port`
- **Readiness Gate**: `/readyz` returns 200 only after `Bun.serve` succeeds, preventing traffic during boot
- **Auth Stub**: Local-first auth — `POST /session` always succeeds; `GET /session` returns `authenticated: false`
- **CORS**: Allows all origins, methods, headers for local-first development

---

*File generated from original documentation and source code concatenation. For complete implementation details, refer to the individual source files in `src/server/`.*
