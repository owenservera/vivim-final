// src/engines/semantic-search.ts
// SemanticSearchEngine — embedding-based semantic search across knowledge.

import { createHash } from 'node:crypto'
import { newId } from '../ids.js'
import { catchDebug, catchWarn } from '../lib/catch-logger.js'
import type { CapStoreDb } from '../storage/db.js'
import type { SemanticSearchStore } from '../storage/contracts/semantic-search-store.js'

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
  } catch (e) { catchWarn(e, "semantic-search: entity harvest"); report.errors++ }

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
  } catch (e) { catchWarn(e, "semantic-search: entity harvest"); report.errors++ }

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
  } catch (e) { catchWarn(e, "semantic-search: entity harvest"); report.errors++ }

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
  } catch (e) { catchWarn(e, "semantic-search: entity harvest"); report.errors++ }

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
  } catch (e) { catchWarn(e, "semantic-search: entity harvest"); report.errors++ }

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
        } catch (e) { catchWarn(e, "semantic-search: entity harvest"); report.errors++ }
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
      opts: { limit?: number; threshold?: number; entityType?: string },
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
          OR: [
            { name: { contains: query.text } },
            { description: { contains: query.text } },
          ],
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
          OR: [
            { decisionText: { contains: query.text } },
            { rationale: { contains: query.text } },
          ],
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
          OR: [
            { name: { contains: query.text } },
            { description: { contains: query.text } },
          ],
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
          OR: [
            { name: { contains: query.text } },
            { description: { contains: query.text } },
          ],
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
  const merged: Map<string, { score: number; entityType: string; entityId: string; snippet: string }> =
    new Map()

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
    const [entityType, entityId] = key.split(':')
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
  let pos = 0
  while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
    occurrences++
    pos += lowerQuery.length
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
