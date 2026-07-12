// src/engines/nlcl/fuzzy-resolver.ts
// FuzzyResolver — IntentResolver using character/word-level fuzzy matching.
// Layer 2 of the SOTA pipeline: typo tolerance (Levenshtein/Jaro-Winkler/Dice).
// Sits between DeterministicResolver and SemanticResolver in the pipeline.
//
// Example: "opne my resme" → fuzzy matches alias "open my resume" → file.open.

import type { CommandPattern, IntentResolver, NLCContext, ParsedIntent, NLCLSurface } from './types.js'
import type { CommandPatternRegistry } from './command-registry.js'
import { fuzzySimilarity } from './fuzzy-matcher.js'
import { normalizeText } from './text-normalizer.js'
import { buildIntentFromPattern } from './pattern-match.js'

export class FuzzyResolver implements IntentResolver {
  readonly name = 'fuzzy'
  private registry: CommandPatternRegistry
  private threshold: number

  constructor(registry: CommandPatternRegistry, threshold = 0.7) {
    this.registry = registry
    this.threshold = threshold
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    const input = normalizeText(rawInput)
    if (!input) return null

    const candidates = this.registry.list({ surface: ctx.surface as NLCLSurface })
    let best: { pattern: CommandPattern; score: number; matched: string } | null = null

    for (const pattern of candidates) {
      const phrases = collectPhrases(pattern)
      for (const phrase of phrases) {
        const norm = normalizeText(phrase)
        if (!norm) continue
        const score = fuzzySimilarity(input, norm)
        if (score > (best?.score ?? 0)) {
          best = { pattern, score, matched: phrase }
        }
      }
    }

    if (!best || best.score < this.threshold) return null

    return buildIntentFromPattern(
      best.pattern,
      rawInput,
      best.score,
      `fuzzy:${best.matched}`,
    )
  }
}

/** Combined alias + example + keyword phrases for a pattern (candidate match targets). */
function collectPhrases(pattern: CommandPattern): string[] {
  const phrases: string[] = [...pattern.aliases, ...pattern.examples]
  for (const p of pattern.patterns) {
    if (p.keywords) phrases.push(...p.keywords)
  }
  return phrases
}
