// src/engines/nlcl/llm-slave-resolver.ts
// LLMSlaveResolver — Catalog-grounded LLM resolution with hybrid RAG.
//
// Tier 3 unit 15.7 — closes audit findings:
//   ❌-9: dense embeddings (MiniLM) used for catalog retrieval, not TF-IDF only.
//   ❌-10: explicit retry commitment via harness-feedback-coordinator (delegated
//          to the engine layer — here we just call into HarnessRepairEngine
//          which has its own retry-on-parse-fail strategy).
//   🚀-14: hybrid retrieval (BM25 sparse + MiniLM dense + RRF fusion) for the
//          top-K catalog candidates sent to the LLM (keeps prompt bounded).
//   🚀-22: budget-engine check before LLM call (audit Tier 5).
//   🚀-26: harness-repair-engine.repair() used to fix LLM JSON output before
//          parse (handles unbalanced quotes, trailing commas, etc).
//
// SOTA pipeline Layer 4 (LLM fallback). Sits after SemanticResolver; only
// invoked when the deterministic + fuzzy + semantic layers all fail to clear
// the configured confidence threshold.

import { MiniLmEmbeddingProvider } from '../embedding-minilm.js'
import type { EmbeddingProvider } from '../semantic-search.js'
import type { IntentResolver, NLCContext, ParsedIntent } from './types.js'

// ── LLMSlaveResolver: Catalog-grounded LLM resolution ─────────────────────────

export interface LLMSlaveResolverDeps {
  providerLLM: ProviderLLMAdapter
  catalog: () => Array<{
    id: string
    intent: string
    description: string
    inputSchema: unknown
  }>
  /**
   * Tier 3 unit 15.6 — dense embedding provider for RAG retrieval.
   * Defaults to MiniLmEmbeddingProvider. Pass a real ONNX/transformers
   * provider in production.
   */
  embeddingProvider?: EmbeddingProvider
  /**
   * Tier 3 unit 15.7 — harness repair engine for LLM JSON output.
   * Optional: if omitted, raw JSON.parse is used (audit 🚀-26 not engaged).
   */
  repairEngine?: {
    repair(input: {
      content: string
      schema: { parse: (v: unknown) => { success: boolean; data?: unknown } }
    }): Promise<{ ok: boolean; data?: unknown; repairs: string[]; errors: string[] }>
  }
  /**
   * Tier 5 — budget engine guard. Optional: if omitted, no budget check.
   */
  budgetGuard?: {
    checkBeforeRequest(): void
    accrue(costCents: number, tokens: number): Promise<void>
  }
  /** Max catalog entries to include in the LLM prompt (default 8). */
  topK?: number
  /** RRF k parameter (default 60). */
  rrfK?: number
}

export interface ProviderLLMAdapter {
  query(prompt: string): Promise<string>
}

interface CatalogEntry {
  id: string
  intent: string
  description: string
  inputSchema: unknown
  /** BM25 token bag for sparse retrieval. */
  tokens: string[]
  /** Pre-computed dense vector for dense retrieval. */
  dense: number[]
}

export class LLMSlaveResolver implements IntentResolver {
  readonly name = 'llm-slave'
  private adapter: ProviderLLMAdapter
  private getCatalog: () => Array<{
    id: string
    intent: string
    description: string
    inputSchema: unknown
  }>
  private readonly embeddingProvider: EmbeddingProvider
  private readonly repairEngine: LLMSlaveResolverDeps['repairEngine']
  private readonly budgetGuard: LLMSlaveResolverDeps['budgetGuard']
  private readonly topK: number
  private readonly rrfK: number
  private cachedCatalog: CatalogEntry[] = []
  private cachedCatalogSize = -1
  private bm25Index: BM25Index | null = null

  constructor(deps: LLMSlaveResolverDeps) {
    this.adapter = deps.providerLLM
    this.getCatalog = deps.catalog
    this.embeddingProvider = deps.embeddingProvider ?? new MiniLmEmbeddingProvider()
    this.repairEngine = deps.repairEngine
    this.budgetGuard = deps.budgetGuard
    this.topK = deps.topK ?? 8
    this.rrfK = deps.rrfK ?? 60
  }

  async resolve(rawInput: string, _ctx: NLCContext): Promise<ParsedIntent | null> {
    const catalog = this.getCatalog()
    await this.ensureIndex(catalog)

    // ── Tier 3 unit 15.7 RAG retrieval: BM25 + dense + RRF ────────────────
    const topCandidates = await this.retrieve(rawInput)
    if (topCandidates.length === 0) return null

    // ── Tier 5 🚀-22: budget guard before LLM call ─────────────────────────
    if (this.budgetGuard) {
      try {
        this.budgetGuard.checkBeforeRequest()
      } catch {
        // Budget exceeded — degrade gracefully to top-1 RAG result without LLM.
        const top = topCandidates[0]
        if (!top) return null
        return this.buildIntentFromCatalog(top.entry, rawInput, 0.5, 'llm-slave:budget-fallback')
      }
    }

    const prompt = this.buildPrompt(
      rawInput,
      topCandidates.map((c) => c.entry),
    )

    let response: string
    try {
      response = await this.adapter.query(prompt)
    } catch {
      // LLM call failed — degrade to top-1 RAG result.
      const top = topCandidates[0]
      if (!top) return null
      return this.buildIntentFromCatalog(top.entry, rawInput, 0.4, 'llm-slave:llm-error-fallback')
    }

    // ── Tier 3 unit 15.7 🚀-26: harness-repair on LLM output ───────────────
    const parsed = await this.parseLLMResponse(response, rawInput, catalog)
    if (parsed) {
      // Accrue cost estimate (1 LLM call ≈ 1 cent, ~500 tokens). Real numbers
      // come from the provider adapter in production.
      if (this.budgetGuard) {
        try {
          await this.budgetGuard.accrue(1, 500)
        } catch {
          // Best-effort accrual.
        }
      }
      return parsed
    }
    // Parse failed even after repair — fall back to top-1 RAG result.
    const top = topCandidates[0]
    if (!top) return null
    return this.buildIntentFromCatalog(top.entry, rawInput, 0.4, 'llm-slave:parse-failed-fallback')
  }

  /** Build a ParsedIntent directly from a catalog entry (fallback path). */
  private buildIntentFromCatalog(
    entry: CatalogEntry,
    rawInput: string,
    confidence: number,
    matchedPattern: string,
  ): ParsedIntent {
    return {
      patternId: entry.id,
      intent: entry.intent,
      input: {},
      confidence,
      rawInput,
      matchedPattern,
      alternatives: [],
      resolvedAt: Date.now(),
      capabilityId: entry.id,
    }
  }

  /**
   * Hybrid RAG retrieval — BM25 sparse + MiniLM dense, RRF-fused.
   * Returns the top-K catalog entries with their fused scores.
   * Async because we compute the query dense embedding inside.
   */
  private async retrieve(
    rawInput: string,
  ): Promise<Array<{ entry: CatalogEntry; fusedScore: number }>> {
    if (this.cachedCatalog.length === 0) return []
    const queryTokens = tokenize(rawInput)

    // Sparse — BM25 scores from the index.
    const sparseScores = this.bm25Index?.search(queryTokens) ?? []
    const sparseRanked = sparseScores.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)

    // Dense — compute query embedding now.
    const queryDense = await this.embeddingProvider.embed(rawInput)
    const denseRanked = this.cachedCatalog
      .map((entry) => ({
        entry,
        score: denseCosine(queryDense, entry.dense),
      }))
      .filter((s) => s.score > 0.3)
      .sort((a, b) => b.score - a.score)

    // RRF fusion — combine ranks from both retrievers.
    const k = this.rrfK
    const rrf = new Map<string, { entry: CatalogEntry; score: number }>()
    sparseRanked.forEach((s, i) => {
      const contribution = 1 / (k + i + 1)
      const existing = rrf.get(s.docId)
      if (existing) {
        existing.score += contribution
      } else {
        const entry = this.cachedCatalog.find((e) => e.id === s.docId)
        if (entry) rrf.set(s.docId, { entry, score: contribution })
      }
    })
    denseRanked.forEach((s, i) => {
      const contribution = 1 / (k + i + 1)
      const existing = rrf.get(s.entry.id)
      if (existing) {
        existing.score += contribution
      } else {
        rrf.set(s.entry.id, { entry: s.entry, score: contribution })
      }
    })
    if (rrf.size === 0) {
      // Both retrievers came up empty — return empty.
      return []
    }
    return [...rrf.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topK)
      .map((v) => ({ entry: v.entry, fusedScore: v.score }))
  }

  /** Build the catalog index (BM25 + dense vectors) if the catalog changed. */
  private async ensureIndex(
    catalog: Array<{
      id: string
      intent: string
      description: string
      inputSchema: unknown
    }>,
  ): Promise<void> {
    if (catalog.length === this.cachedCatalogSize && this.cachedCatalog.length > 0) {
      // Still need to compute queryDense for this turn.
      return
    }
    const entries: CatalogEntry[] = catalog.map((c) => ({
      id: c.id,
      intent: c.intent,
      description: c.description,
      inputSchema: c.inputSchema,
      tokens: tokenize(`${c.intent} ${c.description}`),
      dense: [],
    }))
    // Batch-embed all documents in one call.
    const docs = entries.map((e) => `${e.intent} ${e.description}`)
    const denseVectors = await this.embeddingProvider.embedBatch(docs)
    entries.forEach((e, i) => {
      e.dense = denseVectors[i] ?? []
    })
    this.cachedCatalog = entries
    this.cachedCatalogSize = catalog.length
    this.bm25Index = new BM25Index(entries)
  }

  private buildPrompt(rawInput: string, topCandidates: CatalogEntry[]): string {
    const catalogStr = topCandidates
      .map((c) => `- capabilityId: "${c.id}" | ${c.description}`)
      .join('\n')

    return `You are a command resolver. Given a user sentence, select ONE capabilityId from the catalog and produce valid JSON input. Respond ONLY as JSON: {"capabilityId":"<id>","input":{<params>}}

Catalog:
${catalogStr}

User: "${rawInput}"

JSON:`
  }

  private async parseLLMResponse(
    response: string,
    rawInput: string,
    catalog: Array<{ id: string; intent: string; description: string; inputSchema: unknown }>,
  ): Promise<ParsedIntent | null> {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const rawJson = jsonMatch[0]

    // ── Tier 3 unit 15.7 🚀-26: harness-repair before parse ─────────────────
    // The repair engine handles unbalanced quotes, trailing commas, schema
    // coercion. If no repair engine is wired, fall back to JSON.parse.
    let parsed: { capabilityId?: string; input?: Record<string, unknown> } | null = null
    if (this.repairEngine) {
      try {
        // Use a permissive schema — we just want the JSON shape repaired.
        const result = await this.repairEngine.repair({
          content: rawJson,
          schema: {
            parse: (v: unknown) => {
              if (typeof v === 'object' && v !== null) return { success: true, data: v }
              return { success: false }
            },
          },
        })
        if (result.ok && result.data) {
          parsed = result.data as { capabilityId?: string; input?: Record<string, unknown> }
        }
      } catch {
        // Fall through to direct JSON.parse.
      }
    }
    if (!parsed) {
      try {
        parsed = JSON.parse(rawJson) as {
          capabilityId?: string
          input?: Record<string, unknown>
        }
      } catch {
        return null
      }
    }
    if (!parsed.capabilityId) return null

    // Find matching pattern
    const pattern = catalog.find((c) => c.id === parsed.capabilityId)
    if (!pattern) return null

    return {
      patternId: pattern.id,
      intent: parsed.capabilityId,
      input: parsed.input ?? {},
      confidence: 1.0,
      rawInput,
      matchedPattern: 'llm-slave',
      alternatives: [],
      resolvedAt: Date.now(),
      capabilityId: parsed.capabilityId,
    }
  }
}

// ── BM25 implementation ────────────────────────────────────────────────────

class BM25Index {
  private docs: CatalogEntry[]
  private avgDocLength: number
  private docFreqs: Map<string, number> = new Map()
  private termFreqs: Map<string, number>[] = []
  private docLengths: number[] = []
  private readonly k1 = 1.5
  private readonly b = 0.75

  constructor(docs: CatalogEntry[]) {
    this.docs = docs
    this.avgDocLength = 0
    docs.forEach((doc, i) => {
      const tf = new Map<string, number>()
      let docLength = 0
      for (const token of doc.tokens) {
        docLength++
        tf.set(token, (tf.get(token) ?? 0) + 1)
        // Update document frequency.
        if (tf.get(token) === 1) {
          this.docFreqs.set(token, (this.docFreqs.get(token) ?? 0) + 1)
        }
      }
      this.termFreqs[i] = tf
      this.docLengths[i] = docLength
      this.avgDocLength += docLength
    })
    this.avgDocLength = docs.length > 0 ? this.avgDocLength / docs.length : 0
  }

  search(queryTokens: string[]): Array<{ docId: string; score: number }> {
    const results: Array<{ docId: string; score: number }> = []
    const N = this.docs.length
    for (let i = 0; i < N; i++) {
      const tf = this.termFreqs[i]
      if (!tf) continue
      let score = 0
      for (const qToken of queryTokens) {
        const f = tf.get(qToken) ?? 0
        if (f === 0) continue
        const df = this.docFreqs.get(qToken) ?? 0
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
        const numerator = f * (this.k1 + 1)
        const denominator =
          f +
          this.k1 * (1 - this.b + (this.b * (this.docLengths[i] ?? 0)) / (this.avgDocLength || 1))
        score += idf * (numerator / denominator)
      }
      if (score > 0) {
        const doc = this.docs[i]
        if (doc) results.push({ docId: doc.id, score })
      }
    }
    return results
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

function denseCosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}
