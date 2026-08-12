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
