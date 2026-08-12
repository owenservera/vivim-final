// src/engines/knowledge-index-pipeline.ts
// Phase 0/4 — Knowledge indexing pipeline with dedup and incremental embedding.
// Uses the existing KnowledgeIngestionEngine, SemanticSearchEngine, and
// MemoryEngine as execution substrates — does NOT create a second memory system.
//
// Pipeline: source event → normalize → dedupe → chunk → extract → embed → index → link → memory update

import type { KnowledgeEnvelope, VersionedKnowledgeEnvelope } from './knowledge-envelope.js'

// ── Chunk ────────────────────────────────────────────────────────────────

export interface KnowledgeChunk {
  id: string
  sourceId: string
  ordinal: number
  text: string
  contentHash: string
}

// ── Extraction ───────────────────────────────────────────────────────────

export interface KnowledgeExtraction {
  entities: Array<{ name: string; type: string; confidence: number }>
  facts: Array<{ subject: string; predicate: string; object: unknown; confidence: number }>
  decisions: Array<{ text: string; confidence: number }>
}

// ── Pipeline Dependencies (injected, not coupled) ────────────────────────

export interface KnowledgePipelineDeps {
  /** Check if a content hash already exists (skip re-embedding). */
  hasVersion(contentHash: string): Promise<boolean>
  /** Persist the normalized source envelope. */
  saveSource(envelope: VersionedKnowledgeEnvelope): Promise<void>
  /** Persist extracted chunks. */
  saveChunks(chunks: KnowledgeChunk[]): Promise<void>
  /** Run lightweight extraction (entities, facts, decisions). */
  extract(envelope: VersionedKnowledgeEnvelope): Promise<KnowledgeExtraction>
  /** Persist extraction results. */
  saveExtraction(sourceId: string, extraction: KnowledgeExtraction): Promise<void>
  /** Embed chunks into vector index. */
  embed(chunks: KnowledgeChunk[]): Promise<void>
  /** Create knowledge graph links from extraction. */
  link(sourceId: string, extraction: KnowledgeExtraction): Promise<void>
  /** Invalidate context caches affected by this source. */
  invalidateContext(sourceId: string): Promise<void>
}

// ── Pipeline ─────────────────────────────────────────────────────────────

export class KnowledgeIndexPipeline {
  constructor(private readonly deps: KnowledgePipelineDeps) {}

  /**
   * Ingest a single knowledge envelope through the full pipeline.
   * Returns whether the content was skipped (already indexed) or processed.
   */
  async ingest(
    envelope: KnowledgeEnvelope,
  ): Promise<{ skipped: boolean; sourceId: string }> {
    // Step 1: Normalize (trim, compute hash)
    const { normalizeKnowledge } = await import('./knowledge-envelope.js')
    const normalized = normalizeKnowledge(envelope)

    // Step 2: Dedupe — skip if content hash unchanged
    if (await this.deps.hasVersion(normalized.contentHash)) {
      return { skipped: true, sourceId: normalized.sourceId }
    }

    // Step 3: Save source
    await this.deps.saveSource(normalized)

    // Step 4: Chunk
    const chunks = chunk(normalized)
    await this.deps.saveChunks(chunks)

    // Step 5: Extract (entities, facts, decisions)
    const extraction = await this.deps.extract(normalized)
    await this.deps.saveExtraction(normalized.sourceId, extraction)

    // Step 6: Embed (skip if no chunks)
    if (chunks.length) await this.deps.embed(chunks)

    // Step 7: Link (knowledge graph edges)
    await this.deps.link(normalized.sourceId, extraction)

    // Step 8: Invalidate context
    await this.deps.invalidateContext(normalized.sourceId)

    return { skipped: false, sourceId: normalized.sourceId }
  }
}

// ── Chunking ─────────────────────────────────────────────────────────────

const CHUNK_MAX = 1600
const CHUNK_OVERLAP = 160

function chunk(envelope: VersionedKnowledgeEnvelope): KnowledgeChunk[] {
  const text = envelope.content

  if (!text) {
    return [
      {
        id: `${envelope.sourceId}:0`,
        sourceId: envelope.sourceId,
        ordinal: 0,
        text: '',
        contentHash: envelope.contentHash,
      },
    ]
  }

  const out: KnowledgeChunk[] = []
  let start = 0
  let ordinal = 0

  while (start < text.length) {
    const end = Math.min(text.length, start + CHUNK_MAX)
    const slice = text.slice(start, end)
    out.push({
      id: `${envelope.sourceId}:${ordinal}`,
      sourceId: envelope.sourceId,
      ordinal,
      text: slice,
      contentHash: `${envelope.contentHash}:${ordinal}`,
    })
    ordinal += 1
    if (end >= text.length) break
    start = Math.max(start + 1, end - CHUNK_OVERLAP)
  }

  return out
}
