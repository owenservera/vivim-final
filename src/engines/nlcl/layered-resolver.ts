// src/engines/nlcl/layered-resolver.ts
// LayeredResolver — the full SOTA 6-layer NLU pipeline orchestrator.
//
// Pipeline (per research report nlcl-nlu-systems-sota-2026.md):
//   Normalization (TextNormalizer, shared)
//     → Deterministic (regex/keyword)      confidence gate: parser minConfidence
//     → Fuzzy (Jaro-Winkler/Dice)          confidence gate: 0.70
//     → Semantic (TF-IDF cosine)           confidence gate: 0.60
//     → Classifier (NLI zero-shot)         confidence gate: 0.55
//     → LLM fallback (Local/Provider LLM)  confidence gate: 0.50
//     → (else) unresolved / clarification
//
// First layer to clear its gate wins; lower-confidence matches are attached as
// alternatives. Tracks which layer resolved (telemetry for Kernel Oracle).

import type { EmbeddingProvider } from '../semantic-search.js'
import type { CommandPatternRegistry } from './command-registry.js'
import { FuzzyResolver } from './fuzzy-resolver.js'
import { DeterministicResolver } from './intent-resolver.js'
import { SemanticResolver } from './semantic-resolver.js'
import type { IntentResolver, NLCContext, ParsedIntent } from './types.js'

export type ResolutionLayer = 'deterministic' | 'fuzzy' | 'semantic' | 'classifier' | 'llm' | 'none'

export interface LayeredResolverOptions {
  llmFallback?: IntentResolver
  fuzzyThreshold?: number
  semanticThreshold?: number
  llmThreshold?: number
  embeddingProvider?: EmbeddingProvider
  classifierResolver?: IntentResolver
  classifierThreshold?: number
}

export interface LayerTelemetry {
  layer: ResolutionLayer
  scores: Partial<Record<ResolutionLayer, number>>
}

export class LayeredResolver implements IntentResolver {
  readonly name = 'layered'
  private deterministic: DeterministicResolver
  private fuzzy: FuzzyResolver
  private semantic: SemanticResolver
  private llmFallback: IntentResolver | null
  private classifier: IntentResolver | null
  private fuzzyThreshold: number
  private semanticThreshold: number
  private classifierThreshold: number
  private llmThreshold: number
  private lastLayer: ResolutionLayer = 'none'
  private lastScores: Partial<Record<ResolutionLayer, number>> = {}

  constructor(registry: CommandPatternRegistry, opts: LayeredResolverOptions = {}) {
    this.deterministic = new DeterministicResolver(registry)
    this.fuzzy = new FuzzyResolver(registry, opts.fuzzyThreshold ?? 0.7)
    this.semantic = new SemanticResolver(registry, {
      embeddingProvider: opts.embeddingProvider,
      threshold: opts.semanticThreshold ?? 0.6,
    })
    this.llmFallback = opts.llmFallback ?? null
    this.classifier = opts.classifierResolver ?? null
    this.fuzzyThreshold = opts.fuzzyThreshold ?? 0.7
    this.semanticThreshold = opts.semanticThreshold ?? 0.6
    this.classifierThreshold = opts.classifierThreshold ?? 0.55
    this.llmThreshold = opts.llmThreshold ?? 0.5
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    const scores: Partial<Record<ResolutionLayer, number>> = {}

    // Layer 1: Deterministic (regex/keyword). Parser already enforces minConfidence.
    const det = await this.deterministic.resolve(rawInput, ctx)
    if (det) scores.deterministic = det.confidence
    if (det) {
      this.lastLayer = 'deterministic'
      this.lastScores = scores
      return det
    }

    // Layer 2: Fuzzy match (typo tolerance).
    const fz = await this.fuzzy.resolve(rawInput, ctx)
    if (fz) scores.fuzzy = fz.confidence
    if (fz && fz.confidence >= this.fuzzyThreshold) {
      this.lastLayer = 'fuzzy'
      this.lastScores = scores
      return fz
    }

    // Layer 3: Semantic similarity (paraphrase detection).
    const sem = await this.semantic.resolve(rawInput, ctx)
    if (sem) scores.semantic = sem.confidence
    if (sem && sem.confidence >= this.semanticThreshold) {
      this.lastLayer = 'semantic'
      this.lastScores = scores
      if (fz) sem.alternatives.unshift(fz)
      return sem
    }

    // Layer 3.5: Tiny NLI classifier (cheap pre-filter before the LLM).
    if (this.classifier) {
      const cls = await this.classifier.resolve(rawInput, ctx)
      if (cls) scores.classifier = cls.confidence
      if (cls && cls.confidence >= this.classifierThreshold) {
        this.lastLayer = 'classifier'
        this.lastScores = scores
        const alts = [fz, sem].filter(Boolean) as ParsedIntent[]
        cls.alternatives = [...alts, ...cls.alternatives]
        return cls
      }
    }

    // Layer 4: LLM fallback (ambiguous cases only).
    if (this.llmFallback) {
      const llm = await this.llmFallback.resolve(rawInput, ctx)
      if (llm) scores.llm = llm.confidence
      if (llm && llm.confidence >= this.llmThreshold) {
        this.lastLayer = 'llm'
        this.lastScores = scores
        const alts = [fz, sem].filter(Boolean) as ParsedIntent[]
        llm.alternatives = [...alts, ...llm.alternatives]
        return llm
      }
    }

    // No layer cleared its gate — return best-effort for clarification, or null.
    this.lastLayer = 'none'
    this.lastScores = scores
    return fz ?? sem ?? null
  }

  getLastLayer(): ResolutionLayer {
    return this.lastLayer
  }

  getLastScores(): Partial<Record<ResolutionLayer, number>> {
    return this.lastScores
  }

  getSubResolvers(): Record<string, IntentResolver> {
    return {
      deterministic: this.deterministic,
      fuzzy: this.fuzzy,
      semantic: this.semantic,
      classifier: this.classifier ?? (null as unknown as IntentResolver),
      llm: this.llmFallback ?? (null as unknown as IntentResolver),
    }
  }
}
