# part-4-embeddings-and-vector-search.md

> vivim-final context pack — embedding/vector search utility: SemanticSearchEngine, 4 embedding providers, hybrid sparse+dense retrieval, TF-IDF

## src/engines/semantic-search.ts

```ts
// src/engines/semantic-search.ts
// SemanticSearchEngine — embedding-based semantic search across knowledge.

import { createHash } from 'node:crypto'
import { newId } from '../ids.js'
import { catchDebug, catchWarn } from '../lib/catch-logger.js'
import type { SemanticSearchStore } from '../storage/contracts/semantic-search-store.js'
import type { CapStoreDb } from '../storage/db.js'

export interface SearchQuery {
  text: string
  conversationId?: string
  providerId?: string
  limit?: number
  threshold?: number
}

export interface SearchResult {
  type: 'conversation' | 'message' | 'fact' | 'entity' | 'decision'
  id: string
  score: number
  snippet: string
  conversationId: string | null
}

export interface EmbeddingProvider {
  name: string
  dimensions: number
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

export class SemanticSearchEngine {
  constructor(
    private store: SemanticSearchStore,
    private embeddingProvider: EmbeddingProvider,
    private db?: CapStoreDb,
  ) {}

  async index(text: string, entityType: string, entityId: string): Promise<void> {
    const embedding = await this.embeddingProvider.embed(text)
    const contentHash = createHash('sha256').update(text).digest('hex')

    await this.store.upsertEmbedding({
      id: newId(),
      entityType,
      entityId,
      embedding: JSON.stringify(embedding),
      model: this.embeddingProvider.name,
      dimensions: this.embeddingProvider.dimensions,
      contentHash,
      createdAt: Date.now(),
    })
  }

  async indexBatch(
    items: Array<{ text: string; entityType: string; entityId: string }>,
  ): Promise<void> {
    const texts = items.map((i) => i.text)
    const embeddings = await this.embeddingProvider.embedBatch(texts)
    const contentHashes = texts.map((t) => createHash('sha256').update(t).digest('hex'))

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const embedding = embeddings[i]
      const contentHash = contentHashes[i]
      if (!item || !embedding || !contentHash) continue

      await this.store.upsertEmbedding({
        id: newId(),
        entityType: item.entityType,
        entityId: item.entityId,
        embedding: JSON.stringify(embedding),
        model: this.embeddingProvider.name,
        dimensions: this.embeddingProvider.dimensions,
        contentHash,
        createdAt: Date.now(),
      })
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingProvider.embed(query.text)
    const limit = query.limit ?? 10
    const threshold = query.threshold ?? 0.0

    const results = await this.store.searchByEmbedding(queryEmbedding, {
      limit,
      threshold,
      model: this.embeddingProvider.name,
      dimensions: this.embeddingProvider.dimensions,
    })

    return results.map((r) => ({
      type: r.entityType as SearchResult['type'],
      id: r.entityId,
      score: r.score,
      snippet: '',
      conversationId: null,
    }))
  }

  async searchHybrid(query: SearchQuery): Promise<SearchResult[]> {
    return searchHybridImpl(this.store, this.embeddingProvider, this.db, query)
  }

  async reindexAll(): Promise<{ indexed: number; skipped: number; errors: number }> {
    return reindexAllEntities(this.store, this.embeddingProvider, this.db)
  }

  async getStats(): Promise<{ totalEmbeddings: number }> {
    const total = await this.store.countEmbeddings()
    return { totalEmbeddings: total }
  }
}

// ── Reindex Implementation ──────────────────────────────────────────────────

interface IndexableEntity {
  entityType: string
  entityId: string
  text: string
}

interface ReindexReport {
  indexed: number
  skipped: number
  errors: number
}

/**
 * Reindexes all memory entities by iterating over them, generating embeddings,
 * and storing them in the MemoryEmbedding table.
 */
export async function reindexAllEntities(
  store: {
    upsertEmbedding(input: {
      id: string
      entityType: string
      entityId: string
      embedding: string
      model: string
      dimensions: number
      contentHash: string
      createdAt: number
    }): Promise<void>
    countEmbeddings(opts?: { entityType?: string }): Promise<number>
  },
  provider: EmbeddingProvider,
  db?: CapStoreDb,
): Promise<ReindexReport> {
  const report: ReindexReport = { indexed: 0, skipped: 0, errors: 0 }

  if (!db) {
    // No database available — cannot enumerate entities
    return report
  }

  // Collect all indexable entities from the database
  const entities: IndexableEntity[] = []

  // 1. Entities
  try {
    const entityRows = await db.prisma.entity.findMany({ take: 10_000 })
    for (const row of entityRows) {
      const text = `${row.name} (${row.type}): ${row.description ?? ''}`
      entities.push({
        entityType: 'entity',
        entityId: row.id,
        text,
      })
    }
  } catch {
    // Table may not exist yet in migration
    report.errors++
  }

  // 2. Decision records
  try {
    const decisionRows = await db.prisma.decisionRecord.findMany({ take: 10_000 })
    for (const row of decisionRows) {
      entities.push({
        entityType: 'decision',
        entityId: row.id,
        text: `Decision: ${row.decisionText}${row.rationale ? ` — ${row.rationale}` : ''}`,
      })
    }
  } catch (e) {
    catchWarn(e, 'semantic-search: entity harvest')
    report.errors++
  }

  // 3. Pattern extracts
  try {
    const patternRows = await db.prisma.patternExtract.findMany({ take: 10_000 })
    for (const row of patternRows) {
      entities.push({
        entityType: 'pattern',
        entityId: row.id,
        text: `Pattern (${row.patternType}): ${row.name} — ${row.description}`,
      })
    }
  } catch (e) {
    catchWarn(e, 'semantic-search: entity harvest')
    report.errors++
  }

  // 4. Topics
  try {
    const topicRows = await db.prisma.topic.findMany({ take: 10_000 })
    for (const row of topicRows) {
      entities.push({
        entityType: 'topic',
        entityId: row.id,
        text: `Topic: ${row.name}${row.description ? ` — ${row.description}` : ''}`,
      })
    }
  } catch (e) {
    catchWarn(e, 'semantic-search: entity harvest')
    report.errors++
  }

  // 5. Projects
  try {
    const projectRows = await db.prisma.project.findMany({ take: 10_000 })
    for (const row of projectRows) {
      entities.push({
        entityType: 'project',
        entityId: row.id,
        text: `Project (${row.status}): ${row.name}${row.description ? ` — ${row.description}` : ''}`,
      })
    }
  } catch (e) {
    catchWarn(e, 'semantic-search: entity harvest')
    report.errors++
  }

  // 6. Conversation messages (sample recent ones)
  try {
    const messageRows = await db.prisma.conversationMessage.findMany({
      take: 5_000,
      orderBy: { createdAt: 'desc' },
    })
    for (const row of messageRows) {
      const content = row.content ?? ''
      if (content.trim().length < 10) {
        report.skipped++
        continue
      }
      entities.push({
        entityType: 'message',
        entityId: row.id,
        text: `[${row.role}] ${content}`,
      })
    }
  } catch (e) {
    catchWarn(e, 'semantic-search: entity harvest')
    report.errors++
  }

  // Process in batches of 50 for embedding generation
  const BATCH_SIZE = 50
  for (let i = 0; i < entities.length; i += BATCH_SIZE) {
    const batch = entities.slice(i, i + BATCH_SIZE)
    const texts = batch.map((e) => e.text)

    try {
      const embeddings = await provider.embedBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        const entity = batch[j]
        const embedding = embeddings[j]
        if (!entity || !embedding) {
          report.skipped++
          continue
        }

        const contentHash = createHash('sha256').update(entity.text).digest('hex')

        try {
          await store.upsertEmbedding({
            id: newId(),
            entityType: entity.entityType,
            entityId: entity.entityId,
            embedding: JSON.stringify(embedding),
            model: provider.name,
            dimensions: provider.dimensions,
            contentHash,
            createdAt: Date.now(),
          })
          report.indexed++
        } catch (e) {
          catchWarn(e, 'semantic-search: entity harvest')
          report.errors++
        }
      }
    } catch (e) {
      catchWarn(e, 'semantic-search: batch embedding failed')
      // Batch embedding failed — count all as errors
      report.errors += batch.length
    }
  }

  return report
}

// ── Hybrid Search Implementation ────────────────────────────────────────────

/**
 * Hybrid search combining semantic vector search with SQL LIKE keyword search.
 * Scoring formula: hybridScore = 0.7 * semanticScore + 0.3 * keywordScore
 */
export async function searchHybridImpl(
  store: {
    searchByEmbedding(
      embedding: number[],
      opts: {
        limit?: number
        threshold?: number
        entityType?: string
        model?: string
        dimensions?: number
      },
    ): Promise<Array<{ entityId: string; entityType: string; score: number }>>
    upsertEmbedding(input: {
      id: string
      entityType: string
      entityId: string
      embedding: string
      model: string
      dimensions: number
      contentHash: string
      createdAt: number
    }): Promise<void>
  },
  provider: EmbeddingProvider,
  db: CapStoreDb | undefined,
  query: SearchQuery,
): Promise<SearchResult[]> {
  const SEMANTIC_WEIGHT = 0.7
  const KEYWORD_WEIGHT = 0.3
  const limit = query.limit ?? 10

  // 1. Semantic search — generate query embedding and search
  let semanticResults: Array<{ entityId: string; entityType: string; score: number }> = []
  try {
    const queryEmbedding = await provider.embed(query.text)
    semanticResults = await store.searchByEmbedding(queryEmbedding, {
      limit: limit * 3, // Over-fetch to allow for merging with keyword results
      threshold: 0.0,
      model: provider.name,
      dimensions: provider.dimensions,
    })
  } catch (e) {
    catchDebug(e, 'semantic-search: embedding failed, falling back to keyword')
    // Semantic search failed — fall back to keyword-only
  }

  // 2. Keyword search — SQL LIKE against entity names, decision text, etc.
  const keywordResults: Map<string, { entityType: string; score: number; snippet: string }> =
    new Map()

  if (db) {
    // Search entities
    try {
      const entityMatches = await db.prisma.entity.findMany({
        where: {
          OR: [{ name: { contains: query.text } }, { description: { contains: query.text } }],
        },
        take: 50,
      })
      for (const row of entityMatches) {
        const text = `${row.name}: ${row.description ?? ''}`
        const score = computeKeywordScore(query.text, text)
        keywordResults.set(`entity:${row.id}`, {
          entityType: 'entity',
          score,
          snippet: text.slice(0, 200),
        })
      }
    } catch (e) {
      catchDebug(e, 'semantic-search: entity search skipped')
      // Table may not exist
    }

    // Search decision records
    try {
      const decisionMatches = await db.prisma.decisionRecord.findMany({
        where: {
          OR: [{ decisionText: { contains: query.text } }, { rationale: { contains: query.text } }],
        },
        take: 50,
      })
      for (const row of decisionMatches) {
        const text = `Decision: ${row.decisionText}`
        const score = computeKeywordScore(query.text, text)
        keywordResults.set(`decision:${row.id}`, {
          entityType: 'decision',
          score,
          snippet: text.slice(0, 200),
        })
      }
    } catch (e) {
      catchDebug(e, 'semantic-search: decision search skipped')
      // Table may not exist
    }

    // Search pattern extracts
    try {
      const patternMatches = await db.prisma.patternExtract.findMany({
        where: {
          OR: [{ name: { contains: query.text } }, { description: { contains: query.text } }],
        },
        take: 50,
      })
      for (const row of patternMatches) {
        const text = `${row.name}: ${row.description}`
        const score = computeKeywordScore(query.text, text)
        keywordResults.set(`pattern:${row.id}`, {
          entityType: 'pattern',
          score,
          snippet: text.slice(0, 200),
        })
      }
    } catch (e) {
      catchDebug(e, 'semantic-search: pattern search skipped')
      // Table may not exist
    }

    // Search topics
    try {
      const topicMatches = await db.prisma.topic.findMany({
        where: {
          OR: [{ name: { contains: query.text } }, { description: { contains: query.text } }],
        },
        take: 50,
      })
      for (const row of topicMatches) {
        const text = `Topic: ${row.name}${row.description ? ` — ${row.description}` : ''}`
        const score = computeKeywordScore(query.text, text)
        keywordResults.set(`topic:${row.id}`, {
          entityType: 'topic',
          score,
          snippet: text.slice(0, 200),
        })
      }
    } catch (e) {
      catchDebug(e, 'semantic-search: topic search skipped')
      // Table may not exist
    }

    // Search messages
    try {
      const messageMatches = await db.prisma.conversationMessage.findMany({
        where: {
          content: { contains: query.text },
          ...(query.conversationId ? { conversationId: query.conversationId } : {}),
        },
        take: 50,
      })
      for (const row of messageMatches) {
        const text = row.content ?? ''
        const score = computeKeywordScore(query.text, text)
        keywordResults.set(`message:${row.id}`, {
          entityType: 'message',
          score,
          snippet: text.slice(0, 200),
        })
      }
    } catch (e) {
      catchDebug(e, 'semantic-search: message search skipped')
      // Table may not exist
    }
  }

  // 3. Merge results using hybrid scoring
  const merged: Map<
    string,
    { score: number; entityType: string; entityId: string; snippet: string }
  > = new Map()

  // Add semantic results
  for (const result of semanticResults) {
    const key = `${result.entityType}:${result.entityId}`
    const existing = merged.get(key)
    const semanticScore = Math.max(0, result.score) // Ensure non-negative

    if (existing) {
      existing.score = SEMANTIC_WEIGHT * semanticScore + KEYWORD_WEIGHT * existing.score
    } else {
      merged.set(key, {
        score: SEMANTIC_WEIGHT * semanticScore,
        entityType: result.entityType,
        entityId: result.entityId,
        snippet: '',
      })
    }
  }

  // Add keyword results
  for (const [key, result] of keywordResults) {
    const [_entityType, entityId] = key.split(':')
    const existing = merged.get(key)
    const keywordScore = result.score

    if (existing) {
      // Already has semantic score — combine
      existing.score = existing.score + KEYWORD_WEIGHT * keywordScore
      if (result.snippet) existing.snippet = result.snippet
    } else {
      merged.set(key, {
        score: KEYWORD_WEIGHT * keywordScore,
        entityType: result.entityType,
        entityId: entityId ?? '',
        snippet: result.snippet,
      })
    }
  }

  // 4. Sort by hybrid score and return top results
  const results = Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return results.map((r) => ({
    type: r.entityType as SearchResult['type'],
    id: r.entityId,
    score: r.score,
    snippet: r.snippet,
    conversationId: null,
  }))
}

// ── Keyword Scoring Helper ──────────────────────────────────────────────────

/**
 * Computes a keyword relevance score based on:
 *   - Exact match: 1.0
 *   - Case-insensitive match: 0.9
 *   - Number of occurrences (normalized)
 *   - Position of first occurrence (earlier = higher score)
 */
function computeKeywordScore(query: string, text: string): number {
  if (!query || !text) return 0

  const lowerQuery = query.toLowerCase()
  const lowerText = text.toLowerCase()

  // Count occurrences
  let occurrences = 0
  let pos = lowerText.indexOf(lowerQuery, 0)
  while (pos !== -1) {
    occurrences++
    pos = lowerText.indexOf(lowerQuery, pos + lowerQuery.length)
  }

  if (occurrences === 0) return 0

  // Position factor — earlier matches score higher
  const firstPos = lowerText.indexOf(lowerQuery)
  const positionFactor = 1 - (firstPos / text.length) * 0.5

  // Frequency factor — more occurrences score higher, with diminishing returns
  const frequencyFactor = Math.min(1, occurrences / 3)

  // Length normalization — shorter texts with matches are more relevant
  const lengthFactor = Math.max(0.3, 1 - text.length / 5000)

  return Math.min(1, occurrences > 0 ? positionFactor * frequencyFactor * lengthFactor : 0)
}
```

## src/engines/embedding-ollama.ts

```ts
// src/engines/embedding-ollama.ts
// OllamaEmbeddingProvider — real embeddings via Ollama /api/embeddings.
// Uses nomic-embed-text (768-d). Falls back gracefully if Ollama is unavailable.

import { EngineError } from '../errors.js'
import type { EmbeddingProvider } from './semantic-search.js'

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama:nomic-embed-text'
  readonly dimensions = 768
  private readonly endpoint: string

  constructor(endpoint = 'http://localhost:11434') {
    this.endpoint = endpoint
  }

  async embed(text: string): Promise<number[]> {
    const result = (await this.embedBatch([text]))[0]
    if (!result) throw new EngineError('Ollama embed returned empty result')
    return result
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)

    try {
      const res = await fetch(`${this.endpoint}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', input: texts }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        throw new EngineError(`Ollama embed failed: ${res.status} ${res.statusText}`)
      }

      const data = (await res.json()) as { embeddings: number[][] }
      const embeddings = data.embeddings

      if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
        throw new EngineError('Ollama embed response shape mismatch')
      }

      return embeddings
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof EngineError) throw err
      throw new EngineError(
        `Ollama embed request failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
```

## src/engines/embedding-minilm.ts

```ts
// src/engines/embedding-minilm.ts
// MiniLmEmbeddingProvider — pure-TS deterministic fallback for offline use.
// Hashed token bag-of-words -> 256-d vector with L2 normalization.
// Not SOTA, but produces real (non-zero) vectors with cosine structure.

import type { EmbeddingProvider } from './semantic-search.js'

function hashToken(token: string): number {
  let h = 0
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) - h + token.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function l2Norm(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
}

function normalize(vec: number[]): number[] {
  const norm = l2Norm(vec)
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}

export class MiniLmEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'minilm:ts'
  readonly dimensions = 256

  async embed(text: string): Promise<number[]> {
    return this.pool(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.pool(t))
  }

  private pool(text: string): number[] {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0)

    const vec = new Array(this.dimensions).fill(0)

    for (const token of tokens) {
      const bucket = hashToken(token) % this.dimensions
      vec[bucket] += 1
    }

    return normalize(vec)
  }
}
```

## src/engines/embedding-hf.ts

```ts
// src/engines/embedding-hf.ts
// HfEmbeddingProvider — real neural embeddings via @huggingface/transformers (ONNX WASM).
// Uses Xenova/all-mpnet-base-v2 (768-d, INT8 quantized, ~22 MB).
// Default embedding provider: local, no server, no LLM, no API key.

import type { EmbeddingProvider } from './semantic-search.js'

const MODEL = 'Xenova/all-mpnet-base-v2'
const DEFAULT_DIMENSIONS = 768

// Lazy singleton for the pipeline — created once, reused across embed calls.
let _pipePromise: ReturnType<typeof import('@huggingface/transformers').pipeline> | null = null

function getPipeline() {
  if (!_pipePromise) {
    _pipePromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', MODEL, {
        quantized: true,
        cache_dir: process.env.VIVIM_MODEL_CACHE ?? 'data/models',
      }),
    )
  }
  return _pipePromise
}

export class HfEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'hf:mpnet-base-v2'
  readonly dimensions = DEFAULT_DIMENSIONS

  private initPromise: Promise<void> | null = null

  /** Warm up the pipeline (call once at boot). Idempotent. */
  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = getPipeline().then(() => {})
    }
    return this.initPromise
  }

  async embed(text: string): Promise<number[]> {
    const pipe = await getPipeline()
    const out = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(out.data as Float32Array)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const pipe = await getPipeline()
    const out = await pipe(texts, { pooling: 'mean', normalize: true })
    const data = out.data as Float32Array
    const dims = this.dimensions

    // Slice the flat [batch * dim] tensor into per-text vectors.
    const results: number[][] = []
    for (let i = 0; i < texts.length; i++) {
      const start = i * dims
      results.push(Array.from(data.subarray(start, start + dims)))
    }
    return results
  }

  /** Null out the pipeline reference (for tests / hot reload). */
  dispose(): void {
    _pipePromise = null
    this.initPromise = null
  }
}
```

## src/engines/embedding-classifier.ts

```ts
// src/engines/embedding-classifier.ts
// EmbeddingClassifier — classify entities by cosine similarity to category anchors.
// Uses prototype embeddings for each category (technology, person, project).
// Falls back gracefully when embedding provider is unavailable.

import { cosineSimilarity } from './onboarding/webapp-fingerprint.js'
import type { EmbeddingProvider } from './semantic-search.js'

export interface CategoryAnchor {
  category: string
  anchorPhrases: string[]
}

const DEFAULT_ANCHORS: CategoryAnchor[] = [
  {
    category: 'technology',
    anchorPhrases: [
      'programming language',
      'software library',
      'database',
      'cloud platform',
      'framework',
      'build tool',
      'API',
      'SDK',
    ],
  },
  {
    category: 'person',
    anchorPhrases: ['person name', 'author', 'developer', 'user', 'team member'],
  },
  {
    category: 'project',
    anchorPhrases: ['software project', 'application name', 'system', 'repository', 'module'],
  },
]

export class EmbeddingClassifier {
  private anchors: Map<string, number[]> = new Map()
  private anchorDefinitions: CategoryAnchor[]
  private initialized = false

  constructor(
    private embeddingProvider: EmbeddingProvider,
    anchors?: CategoryAnchor[],
  ) {
    this.anchorDefinitions = anchors ?? DEFAULT_ANCHORS
  }

  /** Pre-compute anchor embeddings. Call once after construction. */
  async init(): Promise<void> {
    if (this.initialized) return
    for (const anchor of this.anchorDefinitions) {
      const combined = anchor.anchorPhrases.join(' ')
      const embedding = await this.embeddingProvider.embed(combined)
      if (embedding) {
        this.anchors.set(anchor.category, embedding)
      }
    }
    this.initialized = true
  }

  /**
   * Classify text into categories by cosine similarity to anchor embeddings.
   * Returns categories sorted by score (highest first).
   */
  async classify(text: string): Promise<Array<{ category: string; score: number }>> {
    if (!this.initialized) await this.init()
    if (this.anchors.size === 0) return []

    const textEmbedding = await this.embeddingProvider.embed(text)
    if (!textEmbedding) return []

    const results: Array<{ category: string; score: number }> = []
    for (const [category, anchorEmbedding] of this.anchors) {
      const score = cosineSimilarity(textEmbedding, anchorEmbedding)
      results.push({ category, score })
    }
    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * Get the top category for a text snippet.
   * Returns null if no embedding provider or empty anchors.
   */
  async topCategory(text: string): Promise<string | null> {
    const results = await this.classify(text)
    return results[0]?.category ?? null
  }
}
```

## src/engines/nlcl/semantic-resolver.ts

```ts
// src/engines/nlcl/semantic-resolver.ts
// SemanticResolver — IntentResolver using DENSE embeddings (HF 768-d) fused with
// sparse TF-IDF via Reciprocal Rank Fusion (RRF).
//
// Tier 3 unit 15.6 — closes audit finding ❌-9 ("semantic resolver uses TF-IDF
// cosine only; no real embeddings wired"). Uses the booted HfEmbeddingProvider
// (Xenova/all-mpnet-base-v2, 768-d ONNX WASM) via the provider chain in
// knowledge.ts. Falls back to HfEmbeddingProvider if no provider is passed.
//
// SOTA pipeline Layer 3 (paraphrase detection). Sits between FuzzyResolver
// and LLM fallback.
//
// Example: "display the log output" → dense+sparse fused match "show me the logs"
//   → system.logs. TF-IDF alone misses this because tokens don't overlap;
//   dense embeddings capture the semantic proximity.
//
// Hybrid scoring (audit 🚀-14):
//   - Sparse (TF-IDF cosine): exact-token signal, high precision
//   - Dense (MiniLM cosine): semantic signal, high recall
//   - RRF fusion: rank-based, no weight tuning needed
//     score(d) = sum over retrievers of 1 / (k + rank_retriever(d))
//     k=60 standard.

import { EngineError } from '../../errors.js'
import { HfEmbeddingProvider } from '../embedding-hf.js'
import type { EmbeddingProvider } from '../semantic-search.js'
import type { CommandPatternRegistry } from './command-registry.js'
import { buildIntentFromPattern } from './pattern-match.js'
import { cosineSimilarity, type SparseVector, Tfidf } from './tfidf.js'
import type {
  CommandPattern,
  IntentResolver,
  NLCContext,
  NLCLSurface,
  ParsedIntent,
} from './types.js'

interface IndexedPattern {
  pattern: CommandPattern
  sparseVector: SparseVector
  denseVector: number[]
}

export interface SemanticResolverOpts {
  /** Dense embedding provider. Defaults to MiniLmEmbeddingProvider. */
  embeddingProvider?: EmbeddingProvider
  /** Threshold for the fused score (0..1, but RRF scores are typically < 0.05; default 0.01). */
  threshold?: number
  /** RRF k parameter (standard 60). */
  rrfK?: number
  /** Sparse threshold (cosine). Below this, sparse retriever doesn't contribute. */
  sparseThreshold?: number
  /** Dense threshold (cosine). Below this, dense retriever doesn't contribute. */
  denseThreshold?: number
}

interface RankedCandidate {
  pattern: CommandPattern
  /** Fused RRF score (higher = better). */
  fusedScore: number
  /** Sparse cosine (TF-IDF). */
  sparseScore: number
  /** Dense cosine (MiniLM). */
  denseScore: number
}

export class SemanticResolver implements IntentResolver {
  readonly name = 'semantic'
  private registry: CommandPatternRegistry
  private readonly embeddingProvider: EmbeddingProvider
  private readonly threshold: number
  private readonly rrfK: number
  private readonly sparseThreshold: number
  private readonly denseThreshold: number
  private tfidf = new Tfidf()
  private index: IndexedPattern[] = []
  private indexedSize = -1

  constructor(registry: CommandPatternRegistry, opts: SemanticResolverOpts | number = {}) {
    this.registry = registry
    // Backward-compat: a bare number is interpreted as the sparse threshold
    // (matches the previous constructor signature).
    if (typeof opts === 'number') {
      this.embeddingProvider = new HfEmbeddingProvider()
      this.threshold = 0.01
      this.rrfK = 60
      this.sparseThreshold = opts
      this.denseThreshold = 0.4
    } else {
      this.embeddingProvider = opts.embeddingProvider ?? new HfEmbeddingProvider()
      this.threshold = opts.threshold ?? 0.01
      this.rrfK = opts.rrfK ?? 60
      this.sparseThreshold = opts.sparseThreshold ?? 0.6
      this.denseThreshold = opts.denseThreshold ?? 0.4
    }
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    await this.ensureIndex()
    const candidates = this.index.filter((entry) =>
      entry.pattern.surfaces.includes(ctx.surface as NLCLSurface),
    )
    if (candidates.length === 0) return null

    // Sparse retrieval — TF-IDF cosine.
    const querySparse = this.tfidf.transform(rawInput)
    const sparseRanked: Array<{ pattern: CommandPattern; score: number }> = []
    if (querySparse.size > 0) {
      for (const entry of candidates) {
        const score = cosineSimilarity(querySparse, entry.sparseVector)
        if (score >= this.sparseThreshold) {
          sparseRanked.push({ pattern: entry.pattern, score })
        }
      }
      sparseRanked.sort((a, b) => b.score - a.score)
    }

    // Dense retrieval — MiniLM cosine.
    const queryDense = await this.embeddingProvider.embed(rawInput)
    const denseRanked: Array<{ pattern: CommandPattern; score: number }> = []
    for (const entry of candidates) {
      const score = denseCosine(queryDense, entry.denseVector)
      if (score >= this.denseThreshold) {
        denseRanked.push({ pattern: entry.pattern, score })
      }
    }
    denseRanked.sort((a, b) => b.score - a.score)

    // RRF fusion — combine ranks from both retrievers.
    const rrfScores = new Map<string, RankedCandidate>()
    const k = this.rrfK
    sparseRanked.forEach((c, i) => {
      const existing = rrfScores.get(c.pattern.id)
      const contribution = 1 / (k + i + 1)
      if (existing) {
        existing.fusedScore += contribution
        existing.sparseScore = c.score
      } else {
        rrfScores.set(c.pattern.id, {
          pattern: c.pattern,
          fusedScore: contribution,
          sparseScore: c.score,
          denseScore: 0,
        })
      }
    })
    denseRanked.forEach((c, i) => {
      const existing = rrfScores.get(c.pattern.id)
      const contribution = 1 / (k + i + 1)
      if (existing) {
        existing.fusedScore += contribution
        existing.denseScore = c.score
      } else {
        rrfScores.set(c.pattern.id, {
          pattern: c.pattern,
          fusedScore: contribution,
          sparseScore: 0,
          denseScore: c.score,
        })
      }
    })

    if (rrfScores.size === 0) return null

    // Pick the highest fused score.
    let best: RankedCandidate | null = null
    for (const candidate of rrfScores.values()) {
      if (!best || candidate.fusedScore > best.fusedScore) {
        best = candidate
      }
    }
    if (!best || best.fusedScore < this.threshold) return null

    // The fused score is in (0, 2/(k+1)] ≈ (0, 0.033] for k=60 — we rescale
    // to (0, 1] for the ParsedIntent.confidence field so downstream layers
    // (layered-resolver) compare apples to apples with fuzzy/LLM confidences.
    const maxRrf = 2 / (k + 1)
    const normalizedConfidence = Math.min(1, best.fusedScore / maxRrf)
    // Boost confidence if BOTH retrievers agreed (high signal).
    const bothAgreed = best.sparseScore > 0 && best.denseScore > 0
    const finalConfidence = bothAgreed
      ? Math.min(1, normalizedConfidence + 0.1)
      : normalizedConfidence

    return buildIntentFromPattern(
      best.pattern,
      rawInput,
      finalConfidence,
      `semantic:${bothAgreed ? 'rrf-hybrid' : 'rrf-single'}`,
    )
  }

  /** Rebuild the sparse + dense index if the registry has changed since last build. */
  private async ensureIndex(): Promise<void> {
    const size = this.registry.size()
    if (size === this.indexedSize && this.index.length > 0) return

    const patterns = this.registry.list()
    this.tfidf.fit(patterns.map((p) => buildPatternDocument(p)))
    // Batch embed for efficiency (single call to embeddingProvider).
    const documents = patterns.map((p) => buildPatternDocument(p))
    const denseVectors = await this.embeddingProvider.embedBatch(documents)
    this.index = patterns.map((pattern, i) => ({
      pattern,
      sparseVector: this.tfidf.transform(documents[i] ?? ''),
      denseVector: denseVectors[i] ?? [],
    }))
    this.indexedSize = size
  }
}

/** Build a representative document for a pattern from its metadata + examples. */
function buildPatternDocument(pattern: CommandPattern): string {
  const parts: string[] = [
    pattern.intent,
    pattern.description,
    ...pattern.aliases,
    ...pattern.examples,
  ]
  for (const p of pattern.patterns) {
    if (p.keywords) parts.push(...p.keywords)
  }
  return parts.join(' ')
}

/** Dense cosine similarity (number[] × number[]). Throws on length mismatch per audit ❌-6. */
function denseCosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new EngineError(
      `denseCosine: length mismatch (a=${a.length}, b=${b.length}) - vector corruption`,
    )
  }
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
```

## src/engines/nlcl/tfidf.ts

```ts
// src/engines/nlcl/tfidf.ts
// TFIDF — Layer 3 of the SOTA NLU pipeline (Semantic Similarity).
// Sparse TF-IDF vectorization + cosine similarity. Pure TypeScript, zero deps.
//
// SOTA reference: TF-IDF cosine is the "feels like AI" layer for paraphrase
// detection without ML training (Vex Intent Classifier, REIC RAG augmentation).
// Builds an IDF model over a corpus, then scores query→document cosine similarity.

import { defaultNormalizer } from './text-normalizer.js'

export type SparseVector = Map<string, number>

export interface TfidfOptions {
  minTokenLength?: number
}

export class Tfidf {
  private idf = new Map<string, number>()
  private docCount = 0
  private vocabulary = new Set<string>()
  private readonly minTokenLength: number

  constructor(opts: TfidfOptions = {}) {
    this.minTokenLength = opts.minTokenLength ?? 2
  }

  /** Fit IDF over a corpus of raw documents. Call once (or when corpus changes). */
  fit(corpus: string[]): void {
    this.docCount = corpus.length
    this.idf.clear()
    this.vocabulary.clear()

    const df = new Map<string, number>()
    for (const doc of corpus) {
      const tokens = this.tokenize(doc)
      const seen = new Set(tokens)
      for (const tok of seen) {
        this.vocabulary.add(tok)
        df.set(tok, (df.get(tok) ?? 0) + 1)
      }
    }

    for (const [tok, freq] of df) {
      // Smoothed IDF (always > 0).
      this.idf.set(tok, Math.log((this.docCount + 1) / (freq + 1)) + 1)
    }
  }

  /** Transform a raw text into a normalized TF-IDF sparse vector. */
  transform(text: string): SparseVector {
    const tokens = this.tokenize(text)
    if (tokens.length === 0) return new Map()
    const tf = new Map<string, number>()
    for (const tok of tokens) {
      tf.set(tok, (tf.get(tok) ?? 0) + 1)
    }
    const vec = new Map<string, number>()
    let norm = 0
    for (const [tok, count] of tf) {
      const idf = this.idf.get(tok)
      if (idf === undefined) continue
      const weight = (count / tokens.length) * idf
      vec.set(tok, weight)
      norm += weight * weight
    }
    norm = Math.sqrt(norm) || 1
    for (const [tok, weight] of vec) {
      vec.set(tok, weight / norm)
    }
    return vec
  }

  private tokenize(text: string): string[] {
    return defaultNormalizer.tokenize(text).filter((t) => t.length >= this.minTokenLength)
  }
}

/** Cosine similarity between two sparse vectors in [0, 1]. */
export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  if (a.size === 0 || b.size === 0) return 0
  // Iterate the smaller vector for efficiency.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let dot = 0
  for (const [tok, weight] of small) {
    const other = large.get(tok)
    if (other) dot += weight * other
  }
  return dot
}
```
