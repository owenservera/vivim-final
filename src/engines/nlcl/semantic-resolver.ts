// src/engines/nlcl/semantic-resolver.ts
// SemanticResolver — IntentResolver using TF-IDF cosine similarity.
// Layer 3 of the SOTA pipeline: paraphrase detection ("feels like AI" layer).
// Sits between FuzzyResolver and LLM fallback.
//
// Example: "display the log output" → TF-IDF cosine matches "show me the logs" → system.logs.

import type { CommandPattern, IntentResolver, NLCContext, ParsedIntent, NLCLSurface } from './types.js'
import type { CommandPatternRegistry } from './command-registry.js'
import { Tfidf, cosineSimilarity, type SparseVector } from './tfidf.js'
import { buildIntentFromPattern } from './pattern-match.js'

interface IndexedPattern {
  pattern: CommandPattern
  vector: SparseVector
}

export class SemanticResolver implements IntentResolver {
  readonly name = 'semantic'
  private registry: CommandPatternRegistry
  private threshold: number
  private tfidf = new Tfidf()
  private index: IndexedPattern[] = []
  private indexedSize = -1

  constructor(registry: CommandPatternRegistry, threshold = 0.6) {
    this.registry = registry
    this.threshold = threshold
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    this.ensureIndex()
    const candidates = this.index.filter((entry) =>
      entry.pattern.surfaces.includes(ctx.surface as NLCLSurface),
    )
    if (candidates.length === 0) return null

    const queryVec = this.tfidf.transform(rawInput)
    if (queryVec.size === 0) return null

    let best: { pattern: CommandPattern; score: number } | null = null
    for (const entry of candidates) {
      const score = cosineSimilarity(queryVec, entry.vector)
      if (score > (best?.score ?? 0)) {
        best = { pattern: entry.pattern, score }
      }
    }

    if (!best || best.score < this.threshold) return null

    return buildIntentFromPattern(
      best.pattern,
      rawInput,
      best.score,
      'semantic:tfidf-cosine',
    )
  }

  /** Rebuild the TF-IDF index if the registry has changed since last build. */
  private ensureIndex(): void {
    const size = this.registry.size()
    if (size === this.indexedSize && this.index.length > 0) return

    const patterns = this.registry.list()
    this.tfidf.fit(patterns.map((p) => buildPatternDocument(p)))
    this.index = patterns.map((pattern) => ({
      pattern,
      vector: this.tfidf.transform(buildPatternDocument(pattern)),
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
