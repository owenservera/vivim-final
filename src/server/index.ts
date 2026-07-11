// src/server/index.ts
// Bun.serve — REST API + WebSocket server entry point
//
// Minimal shell: mounts response helpers, auth gate, conversation router,
// and WebSocket bridge. Engine wiring is deferred to the full bootstrap
// (units 5.1-5.5 are bundled; full wiring comes after all stubs exist).

import { CapabilityEventBus } from '../engines/capability-event-bus.js'
import type { CapabilityResolutionEngine } from '../engines/capability-resolution.js'
import type { ChromeGovernor } from '../engines/chrome-governor.js'
import type { ConversationManager } from '../engines/conversation-manager.js'
import type { CrossConversationSynthesizer } from '../engines/cross-conversation-synthesis.js'
import type { ExportEngine } from '../engines/export.js'
import type { KnowledgeIngestionEngine } from '../engines/knowledge-ingestion.js'
import type { SemanticSearchEngine } from '../engines/semantic-search.js'
import { type CapStoreDb, getDb } from '../storage/db.js'
import { createAuthMiddleware } from './auth-gate.js'
import { createConversationRouter } from './conversation-router.js'
import { createKnowledgeRouter } from './knowledge-router.js'
import { errorResponse, json } from './response.js'
import { createSetupRouter } from './setup-router.js'
import { handleWebSocket } from './websocket.js'

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

export async function createServer(port = 9420): Promise<ServerContext> {
  const db = getDb()
  const eventBus = CapabilityEventBus.getInstance()

  const ctx: ServerContext = { port, db, eventBus }

  const auth = createAuthMiddleware()
  const conversationRouter = createConversationRouter(ctx)
  const knowledgeRouter = createKnowledgeRouter(ctx)
  const setupRouter = createSetupRouter(ctx)

  // Track readiness — becomes true after server boots
  let ready = false

  Bun.serve({
    port,
    fetch(req, server) {
      const url = new URL(req.url)

      // Liveness — always 200 if process is running (no auth)
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
  })

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
  const { StreamBlockStore } = await import('../engines/stream-block-store.js')
  const { ExecutionMemoizer } = await import('../engines/execution-memoizer.js')
  const { MemoryEngine } = await import('../engines/memory-engine.js')
  const { ConversationStoreImpl } = await import('../storage/impl/conversation-store-impl.js')
  const { GovernorStoreImpl } = await import('../storage/impl/governor-store-impl.js')
  const { CapabilityResolutionStoreImpl } = await import(
    '../storage/impl/capability-resolution-store-impl.js'
  )
  const { ParserStoreImpl } = await import('../storage/impl/parser-store-impl.js')
  const { EpisodicMemoryStoreImpl } = await import('../storage/impl/episodic-memory-store-impl.js')
  const { SemanticMemoryStoreImpl } = await import('../storage/impl/semantic-memory-store-impl.js')
  const { ProceduralMemoryStoreImpl } = await import(
    '../storage/impl/procedural-memory-store-impl.js'
  )

  // Store instances
  const convStore = new ConversationStoreImpl(db)
  const govStore = new GovernorStoreImpl(db)
  const resStore = new CapabilityResolutionStoreImpl(db.prisma as any)
  const parserStore = new ParserStoreImpl(db)
  const episodicStore = new EpisodicMemoryStoreImpl(db)
  const semanticStore = new SemanticMemoryStoreImpl(db)
  const proceduralStore = new ProceduralMemoryStoreImpl(db)

  // Engine instances
  const resolutionEngine = new CapabilityResolutionEngine(resStore)
  const parserEngine = new StreamParserEngine(parserStore)
  const streamBlocks = new StreamBlockStore(db)
  const memoizer = new ExecutionMemoizer({
    emit: (event: string, data: unknown) => {
      eventBus.emit({ type: event, ...(data as Record<string, unknown>) } as any)
    },
    on: (_event: string, _handler: (data: unknown) => void) => {
      // Memoizer invalidation hooks — no-op for bootstrap; real wiring uses eventBus directly
    },
  })
  const memoryEngine = new MemoryEngine(episodicStore, semanticStore, proceduralStore, eventBus)

  const governor = new ChromeGovernor(govStore, {
    portRange: [9300, 9400],
    healthProbeIntervalMs: 30_000,
    healthProbeTimeoutMs: 5_000,
    autoRestart: true,
    maxRestarts: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60_000,
  })

  const conversationManager = new ConversationManager(
    governor,
    resolutionEngine,
    parserEngine,
    streamBlocks,
    convStore,
    eventBus,
    memoizer,
    memoryEngine,
  )

  // Boot governor (seeds accounts, starts fleet)
  await governor.boot()

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
    const noopEmbedding = {
      name: 'noop',
      dimensions: 384,
      embed: async (_t: string) => new Array(384).fill(0),
      embedBatch: async (ts: string[]) => ts.map(() => new Array(384).fill(0)),
    }
    semanticSearch = new SemanticSearchEngine(ssStore, noopEmbedding)
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
    exportEngine = new ExportEngine(db)
  } catch {
    /* export engine not available */
  }

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
  }

  const auth = createAuthMiddleware()
  const conversationRouter = createConversationRouter(ctx)
  const knowledgeRouter = createKnowledgeRouter(ctx)
  const setupRouter = createSetupRouter(ctx)

  let ready = false

  Bun.serve({
    port,
    fetch(req, server) {
      const url = new URL(req.url)

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
        const ok = server.upgrade(req)
        return ok ? undefined : errorResponse('WebSocket upgrade failed', 'UpgradeFailed', 400)
      }

      if (isShuttingDown) {
        return json({ error: 'Server shutting down', code: 'ShuttingDown' }, 503)
      }

      const authResult = auth(req)
      if (authResult) return authResult

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
  })

  ready = true
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  return ctx
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 9420)
  const ctx = await createServerWithEngines(port)
  console.log(`vivim server listening on :${ctx.port}`)
}
