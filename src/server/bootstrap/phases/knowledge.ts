// src/server/bootstrap/phases/knowledge.ts
// Boot phase: optional knowledge/search/export engines + mux/cost engines.
// All are OPTIONAL — each is wired independently and skips cleanly when an
// engine or store is unavailable so a partial result never blocks boot.
// Writes: knowledgeIngestion, semanticSearch, synthesizer, exportEngine,
//         providerMux, costOptimizer on ctx.

import type { EmbeddingProvider } from '../../../engines/semantic-search.js'
import type { CapabilityEvent } from '../../../engines/capability-event-bus.js'
import { catchDebug } from '../../../lib/catch-logger.js'
import { getLogger } from '../../../lib/logger.js'
import type { BootstrapContext } from '../context.js'

const _log = getLogger('bootstrap:knowledge')

export async function bootstrapKnowledgePhase(ctx: BootstrapContext): Promise<void> {
  const db = ctx.db as NonNullable<BootstrapContext['db']>
  const eventBus = ctx.eventBus as NonNullable<BootstrapContext['eventBus']>
  const convStore = ctx.convStore as NonNullable<BootstrapContext['convStore']>
  const streamBlocks = ctx.streamBlocks as NonNullable<BootstrapContext['streamBlocks']>

  // ── OutcomeTracker (§7 — adaptive scoring foundation) ────────────────────
  try {
    const { OutcomeTracker } = await import('../../../engines/outcome-tracker.js')
    const outcomeTracker = new OutcomeTracker({ alpha: 0.1, minSamples: 5 })
    ctx.outcomeTracker = outcomeTracker
    _log.info('OutcomeTracker initialized (alpha=0.1, minSamples=5)')

    // Auto-record provider outcomes from capability events
    eventBus.on('capability:executed', (evt) => {
      outcomeTracker.record({
        type: 'outcome.recorded',
        eventId: '' as never,
        requestId: '' as never,
        sequence: 0,
        timestamp: new Date().toISOString(),
        subjectId: evt.providerId,
        subjectType: 'provider',
        outcome: evt.ok ? 'reinforced' : 'ignored',
      })
    })
    eventBus.on('capability:failed', (evt) => {
      outcomeTracker.record({
        type: 'outcome.recorded',
        eventId: '' as never,
        requestId: '' as never,
        sequence: 0,
        timestamp: new Date().toISOString(),
        subjectId: evt.providerId,
        subjectType: 'provider',
        outcome: 'rejected',
      })
    })
  } catch (e) {
    catchDebug(e, 'bootstrap: outcome tracker not available')
  }

  // Knowledge engines (optional — wired if stores are available)
  let knowledgeIngestion:
    | import('../../../engines/knowledge-ingestion.js').KnowledgeIngestionEngine
    | undefined
  let semanticSearch: import('../../../engines/semantic-search.js').SemanticSearchEngine | undefined
  let synthesizer:
    | import('../../../engines/cross-conversation-synthesis.js').CrossConversationSynthesizer
    | undefined
  let exportEngine: import('../../../engines/export.js').ExportEngine | undefined
  // #5: Hoisted to phase scope so it can be exposed on ctx for MemoryFabric.
  let embeddingProvider: import('../../../engines/semantic-search.js').EmbeddingProvider | undefined

  try {
    const { KnowledgeIngestionEngine } = await import('../../../engines/knowledge-ingestion.js')
    const { KnowledgeIngestionStoreImpl } = await import(
      '../../../storage/impl/knowledge-ingestion-store-impl.js'
    )
    const { KnowledgeExtractor } = await import('../../../engines/knowledge-extractor.js')
    const { KnowledgeExtractorStoreImpl } = await import(
      '../../../storage/impl/knowledge-extractor-store-impl.js'
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
    const { SemanticSearchEngine } = await import('../../../engines/semantic-search.js')
    const { SemanticSearchStoreImpl } = await import(
      '../../../storage/impl/semantic-search-store-impl.js'
    )
    const ssStore = new SemanticSearchStoreImpl(db)

    let embedding: EmbeddingProvider
    // Ordered provider chain: HF (default, local ONNX) → Ollama (opt-in) → MiniLM (fallback)
    try {
      const { HfEmbeddingProvider } = await import('../../../engines/embedding-hf.js')
      const provider = new HfEmbeddingProvider()
      await provider.init()
      await provider.embed('warmup')
      embedding = provider
    } catch (e) {
      catchDebug(e, 'bootstrap: HF embedding failed, trying Ollama')
      try {
        const { OllamaEmbeddingProvider } = await import('../../../engines/embedding-ollama.js')
        const provider = new OllamaEmbeddingProvider()
        await provider.embed('ping')
        embedding = provider
      } catch (e2) {
        catchDebug(e2, 'bootstrap: Ollama unavailable, falling back to MiniLM')
        const { MiniLmEmbeddingProvider } = await import('../../../engines/embedding-minilm.js')
        embedding = new MiniLmEmbeddingProvider()
      }
    }
    embeddingProvider = embedding // #5: expose on phase scope

    // §8: Embedding provider observability — log tier + emit degradation event.
    const providerTier =
      embedding.name === 'hf:mpnet-base-v2'
        ? 'neural'
        : embedding.name.startsWith('ollama:')
          ? 'neural-remote'
          : 'fallback-hash'

    _log.info(`Embedding provider active: ${embedding.name} (tier: ${providerTier})`)

    if (providerTier === 'fallback-hash') {
      _log.warn(
        '⚠ Embedding degraded: using hash-based fallback. Semantic search quality is reduced.',
      )
      // Emit telemetry event for degraded embedding state
      eventBus.emit({
        type: 'capability:status_changed',
        capabilityId: 'embedding',
        providerId: embedding.name,
        from: 'neural',
        to: 'degraded',
      } as CapabilityEvent)
    }

    semanticSearch = new SemanticSearchEngine(ssStore, embedding, db)
  } catch (e) {
    catchDebug(e, 'bootstrap: semantic search not available')
  }

  try {
    const { CrossConversationSynthesizer } = await import(
      '../../../engines/cross-conversation-synthesis.js'
    )
    const { CrossConversationSynthesizerStoreImpl } = await import(
      '../../../storage/impl/cross-conversation-synth-store-impl.js'
    )
    const synthStore = new CrossConversationSynthesizerStoreImpl(db)
    // #1: Pick a real synthesis provider from the gateway registry.
    // Falls back to simulator only if no real provider is registered.
    const { getGatewayProviderLLMAdapter } = await import(
      '../../../engines/gateway-provider-llm-adapter.js'
    )
    const synthLlm = pickSynthesisProvider(getGatewayProviderLLMAdapter)
    if (semanticSearch)
      synthesizer = new CrossConversationSynthesizer(synthStore, semanticSearch, synthLlm)
  } catch (e) {
    catchDebug(e, 'bootstrap: synthesizer not available')
  }

  try {
    const { ExportEngine } = await import('../../../engines/export.js')
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
  let providerMux: import('../../../engines/provider-mux.js').ProviderMuxEngine | undefined
  let costOptimizer: import('../../../engines/cost-optimizer.js').CostOptimizer | undefined

  try {
    const { CostOptimizer } = await import('../../../engines/cost-optimizer.js')
    const { CostStoreImpl } = await import('../../../storage/impl/cost-store-impl.js')
    const costStore = new CostStoreImpl(db)
    costOptimizer = new CostOptimizer(costStore)
  } catch (e) {
    catchDebug(e, 'bootstrap: cost optimizer not available')
  }

  try {
    const { ProviderMuxEngine } = await import('../../../engines/provider-mux.js')
    const { MuxStoreImpl } = await import('../../../storage/impl/mux-store-impl.js')
    const { Router } = await import('../../../router/router.js')
    const { RouterStoreImpl } = await import('../../../storage/impl/router-store-impl.js')

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

          const result = await ctx.conversationManager?.send(convId, message)

          const latencyMs = Date.now() - start
          const estCost = await estimateCost(providerId, latencyMs)

          if (costOptimizer) {
            await costOptimizer.recordCost(providerId, estCost, 0, 0)
          }

          return {
            ok: result?.ok ?? false,
            response: result?.text || '',
            latencyMs,
            costCents: estCost,
            error: result?.error,
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

  ctx.knowledgeIngestion = knowledgeIngestion
  ctx.semanticSearch = semanticSearch
  ctx.synthesizer = synthesizer
  ctx.exportEngine = exportEngine
  ctx.embeddingProvider = embeddingProvider // #5: for MemoryFabric
  ctx.providerMux = providerMux
  ctx.costOptimizer = costOptimizer
}

/**
 * Pick the best available provider for cross-conversation synthesis.
 * Tries real registered providers first (higher quality), then falls back
 * to the simulator (in-process, no real LLM).
 */
function pickSynthesisProvider(
  getAdapter: typeof import('../../../engines/gateway-provider-llm-adapter.js').getGatewayProviderLLMAdapter,
) {
  // Preferred providers in quality order — Claude > Gemini > ChatGPT > DeepSeek > Grok.
  // These are the 6 UI-facing chat providers in the knowledge graph.
  const preferred = ['claude', 'gemini', 'chatgpt', 'deepseek', 'grok']

  // Try to find a registered provider in the gateway.
  const gw = globalThis.__aiGateway
  if (gw?.providers) {
    for (const id of preferred) {
      if (gw.providers.has(id)) {
        return getAdapter({ providerId: id })
      }
    }
  }

  // No real provider available — fall back to simulator (works without a GPU).
  return getAdapter({ providerId: 'simulator' })
}
