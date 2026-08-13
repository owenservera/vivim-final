// src/storage/impl/cozo-semantic-search.ts
// CozoSemanticSearchStore — vector search via Cozo HNSW indexes.
// SQLite remains the source of truth (ADR-014). Cozo is a rebuildable index.
// Falls back gracefully on any Cozo error (fail-open).

import { catchDebug } from '../../lib/catch-logger.js'
import type { SemanticSearchStore } from '../contracts/semantic-search-store.js'
import type { CozoLayer } from '../cozo/cozo-layer.js'

export class CozoSemanticSearchStore implements SemanticSearchStore {
  constructor(private cozo: CozoLayer) {}

  async upsertEmbedding(input: {
    id: string
    entityType: string
    entityId: string
    embedding: string
    model: string
    dimensions: number
    contentHash: string
    createdAt: number
  }): Promise<void> {
    // Project into Cozo Entity relation with vector column.
    // embedding is stored as JSON string in SQLite; Cozo accepts JSON arrays for <F32;768>.
    try {
      await this.cozo.runMut(
        `?[id, name, kind, canonical, embedding] <- [[
          $id, $name, $kind, $name, $embedding
        ]]
        :put Entity {id => name, kind, canonical, embedding}`,
        {
          id: input.id,
          name: input.entityId,
          kind: input.entityType,
          embedding: input.embedding, // JSON array string — Cozo parses it for <F32;768>
        },
      )
    } catch (err) {
      catchDebug(err, 'cozo-semantic-search: upsertEmbedding failed (fail-open)')
    }
  }

  async getEmbedding(
    entityType: string,
    entityId: string,
  ): Promise<{
    id: string
    embedding: string
    model: string
    dimensions: number
  } | null> {
    try {
      const result = await this.cozo.runScript(
        `?[id, embedding] := *Entity[id, kind, embedding], kind == $kind, id == $id`,
        { kind: entityType, id: entityId },
      )
      if (!result || result.rows.length === 0) return null
      const row = result.rows[0]
      return {
        id: row?.[0] as string,
        embedding: JSON.stringify(row?.[1]), // Cozo returns array, stringify for contract
        model: 'cozo',
        dimensions: 768,
      }
    } catch (err) {
      catchDebug(err, 'cozo-semantic-search: getEmbedding failed (fail-open)')
      return null
    }
  }

  async searchByEmbedding(
    queryEmbedding: number[],
    opts: {
      limit?: number
      threshold?: number
      entityType?: string
      model?: string
      dimensions?: number
    },
  ): Promise<Array<{ entityId: string; entityType: string; score: number }>> {
    const limit = opts.limit ?? 10
    const threshold = opts.threshold ?? 0.0

    try {
      // Cozo HNSW approximate nearest neighbor search.
      // ~* is the approximate search operator when an HNSW index exists.
      // distance = L2 by default (matches our index creation).
      const kindFilter = opts.entityType ? `, kind == $kind` : ''
      const script = `?[entity_id, kind, dist] :=
        ~*Entity[entity_id, embedding]($v, width = ${limit})${kindFilter},
        dist = distance
        :limit ${limit}`

      const params: Record<string, unknown> = { v: queryEmbedding }
      if (opts.entityType) params.kind = opts.entityType

      const result = await this.cozo.runScript(script, params)
      if (!result) return []

      // Convert L2 distance to similarity score (0..1).
      // L2 distance for normalized vectors: range [0, 2].
      // similarity = 1 - (distance / 2)
      return result.rows
        .map((row) => {
          const entityId = row?.[0] as string
          const entityType = row?.[1] as string
          const dist = row?.[2] as number
          const score = Math.max(0, 1 - dist / 2)
          return { entityId, entityType, score }
        })
        .filter((r) => r.score >= threshold)
        .sort((a, b) => b.score - a.score)
    } catch (err) {
      catchDebug(err, 'cozo-semantic-search: searchByEmbedding failed (fail-open)')
      return []
    }
  }

  async deleteEmbedding(_entityType: string, entityId: string): Promise<void> {
    try {
      await this.cozo.runMut(
        `?[id] <- [[ $id ]]
        :delete Entity {id}`,
        { id: entityId },
      )
    } catch (err) {
      catchDebug(err, 'cozo-semantic-search: deleteEmbedding failed (fail-open)')
    }
  }

  async countEmbeddings(opts?: { entityType?: string }): Promise<number> {
    try {
      const kindFilter = opts?.entityType ? `, kind == $kind` : ''
      const script = `count[id] := *Entity[id, kind]${kindFilter}`
      const params: Record<string, unknown> = {}
      if (opts?.entityType) params.kind = opts.entityType

      const result = await this.cozo.runScript(script, params)
      if (!result || result.rows.length === 0) return 0
      return (result.rows[0]?.[0] as number) ?? 0
    } catch (err) {
      catchDebug(err, 'cozo-semantic-search: countEmbeddings failed (fail-open)')
      return 0
    }
  }
}
