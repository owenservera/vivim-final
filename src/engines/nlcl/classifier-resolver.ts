// src/engines/nlcl/classifier-resolver.ts
// ClassifierResolver — IntentResolver backed by the tiny local NLI expert
// (classifier-nli.ts / Xenova/nli-deberta-v3-xsmall).
//
// New pipeline Layer 3.5, sitting between SemanticResolver and the LLM
// fallback (llm-slave-resolver.ts):
//
//   Normalization
//     → Deterministic   (regex/keyword)
//     → Fuzzy            (Jaro-Winkler/Dice)
//     → Semantic          (TF-IDF + dense RRF)
//     → Classifier (NEW)  (tiny NLI zero-shot over the command catalog)
//     → LLM fallback      (full provider LLM — last resort only)
//
// Rationale: semantic (embedding) similarity is good at "does this input
// look like any known example", but it is a nearest-neighbor match, not a
// calibrated decision — it has no notion of "none of the above". The NLI
// classifier scores every candidate intent as a proper entailment
// probability, including implicitly weighing "no confident match" when all
// scores are low and flat. That makes it a good, cheap gate immediately
// before the expensive LLM layer: most of what would otherwise fall through
// to llm-slave-resolver.ts gets resolved here instead, for a ~20MB local
// model instead of a network call to a full-size LLM.
//
// See UPGRADE-PACK-TINY-EXPERT-MODELS.md for wiring instructions into
// layered-resolver.ts (adds one optional constructor field + one pipeline
// stage; does not change the public IntentResolver contract).

import type { IntentClassifierProvider } from '../classifier-nli.js'
import { NliClassifierProvider } from '../classifier-nli.js'
import type { CommandPatternRegistry } from './command-registry.js'
import { extractPatternInput } from './pattern-match.js'
import type { CommandPattern, IntentResolver, NLCContext, NLCLSurface, ParsedIntent } from './types.js'

export interface ClassifierResolverOpts {
  /** Tiny NLI classifier provider. Defaults to NliClassifierProvider. */
  classifier?: IntentClassifierProvider
  /** Minimum top-label score to accept (0..1). Default 0.55 — deliberately
   *  conservative since this sits right before the LLM safety net. */
  threshold?: number
  /** Cap on how many catalog intents are sent to the classifier per call —
   *  zero-shot classification cost scales with candidate count. Default 24. */
  maxCandidates?: number
}

export class ClassifierResolver implements IntentResolver {
  readonly name = 'classifier'
  private registry: CommandPatternRegistry
  private classifier: IntentClassifierProvider
  private threshold: number
  private maxCandidates: number

  constructor(registry: CommandPatternRegistry, opts: ClassifierResolverOpts = {}) {
    this.registry = registry
    this.classifier = opts.classifier ?? new NliClassifierProvider()
    this.threshold = opts.threshold ?? 0.55
    this.maxCandidates = opts.maxCandidates ?? 24
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    const patterns = this.registry
      .list()
      .filter((p) => p.surfaces.includes(ctx.surface as NLCLSurface))
      .slice(0, this.maxCandidates)
    if (patterns.length === 0) return null

    await this.classifier.init()
    // Use `intent` (a short verb-phrase-style label) rather than description —
    // shorter labels are cheaper for the model and closer to the
    // hypothesis_template ("The user wants to {}") framing in classifier-nli.ts.
    const labelToPattern = new Map<string, CommandPattern>()
    const labels: string[] = []
    for (const p of patterns) {
      const label = humanizeIntent(p.intent)
      labelToPattern.set(label, p)
      labels.push(label)
    }

    const result = await this.classifier.classify(rawInput, labels)
    if (result.labels.length === 0) return null

    const topLabel = result.labels[0]
    const topScore = result.scores[0] ?? 0
    if (!topLabel || topScore < this.threshold) return null

    const pattern = labelToPattern.get(topLabel)
    if (!pattern) return null

    const input = extractPatternInput(pattern, rawInput) ?? {}
    return {
      patternId: pattern.id,
      intent: pattern.intent,
      input,
      confidence: topScore,
      rawInput,
      matchedPattern: 'classifier:nli-zero-shot',
      alternatives: [],
      resolvedAt: Date.now(),
    }
  }
}

/** "system.logs.show" -> "show the system logs" (best-effort, cheap heuristic). */
function humanizeIntent(intent: string): string {
  return intent
    .split(/[._-]/)
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
