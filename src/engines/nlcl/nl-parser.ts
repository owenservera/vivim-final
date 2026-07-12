// src/engines/nlcl/nl-parser.ts
// NLCommandParser — deterministic natural language → ParsedIntent.
// Uses regex patterns with named capture groups + keyword matching.
// ZERO AI dependency. Handles 95%+ of consumer command volume.
// The remaining ~5% falls through to the pluggable IntentResolver (local LLM / provider LLM).

import type { CommandPattern, NLCContext, ParsedIntent } from './types.js'
import type { CommandPatternRegistry } from './command-registry.js'
import { normalizeText } from './text-normalizer.js'
import { resolveEntityValues } from './entity-resolution.js'

export interface ParseOptions {
  maxAlternatives?: number
  minConfidence?: number
  surface?: string
}

const DEFAULT_PARSE_OPTIONS: Required<ParseOptions> = {
  maxAlternatives: 3,
  minConfidence: 0.3,
  surface: 'frontend',
}

export class NLCommandParser {
  constructor(private registry: CommandPatternRegistry) {}

  parse(rawInput: string, ctx: NLCContext, opts?: ParseOptions): ParsedIntent | null {
    const options = { ...DEFAULT_PARSE_OPTIONS, ...opts }
    const input = rawInput.trim()
    if (!input) return null

    // Use the shared TextNormalizer so deterministic + fuzzy + semantic layers
    // all normalize identically (SOTA pipeline consistency).
    const normalized = normalizeText(input)

    const candidates = this.registry.list({ surface: opts?.surface as never })

    const matches: Array<{ pattern: CommandPattern; intent: ParsedIntent; score: number }> = []

    for (const pattern of candidates) {
      const match = this.tryMatch(pattern, normalized, rawInput)
      if (match) {
        const priorityBonus = (pattern.patterns[0]?.priority ?? 0) * 0.001
        matches.push({
          pattern,
          intent: match,
          score: match.confidence + priorityBonus,
        })
      }
    }

    matches.sort((a, b) => b.score - a.score)

    if (matches.length === 0) return null

    const best = matches[0]
    if (!best) return null

    if (best.intent.confidence < options.minConfidence) return null

    const alternatives = matches
      .slice(1, options.maxAlternatives + 1)
      .map((m) => m.intent)

    return {
      ...best.intent,
      alternatives,
      resolvedAt: Date.now(),
    }
  }

  private tryMatch(
    pattern: CommandPattern,
    normalizedInput: string,
    rawInput: string,
  ): ParsedIntent | null {
    for (const nlPattern of pattern.patterns) {
      const match = normalizedInput.match(nlPattern.regex)
      if (match) {
        const extracted = nlPattern.extract(match, rawInput)
        const validated = pattern.inputSchema.safeParse(extracted)
        if (validated.success) {
          // SOTA entity resolution (Gap 7.4): normalize dates/numbers/booleans.
          const resolved = resolveEntityValues(validated.data as Record<string, unknown>)
          return {
            patternId: pattern.id,
            intent: pattern.intent,
            input: resolved,
            confidence: this.scoreMatch(match, nlPattern, normalizedInput),
            rawInput,
            matchedPattern: nlPattern.regex.source,
            alternatives: [],
            resolvedAt: Date.now(),
          }
        }
      }
    }

    for (const alias of pattern.aliases) {
      if (this.matchesAlias(normalizedInput, alias)) {
        return {
          patternId: pattern.id,
          intent: pattern.intent,
          input: {},
          confidence: 0.7,
          rawInput,
          matchedPattern: `alias:${alias}`,
          alternatives: [],
          resolvedAt: Date.now(),
        }
      }
    }

    if (pattern.patterns.some((p) => p.keywords)) {
      const keywordScore = this.scoreKeywords(pattern, normalizedInput)
      if (keywordScore.confidence > 0) {
        const resolved = resolveEntityValues(keywordScore.input)
        return {
          patternId: pattern.id,
          intent: pattern.intent,
          input: resolved,
          confidence: keywordScore.confidence,
          rawInput,
          matchedPattern: 'keyword-fallback',
          alternatives: [],
          resolvedAt: Date.now(),
        }
      }
    }

    return null
  }

  private scoreMatch(
    match: RegExpMatchArray,
    pattern: { regex: RegExp; keywords?: string[] },
    input: string,
  ): number {
    const captureGroups = match.length - 1
    const inputLength = input.length
    const matchLength = match[0]?.length ?? 0
    const coverage = inputLength > 0 ? matchLength / inputLength : 0
    const baseConfidence = 0.6 + coverage * 0.39
    const captureBonus = Math.min(captureGroups * 0.02, 0.1)
    return Math.min(baseConfidence + captureBonus, 1.0)
  }

  private matchesAlias(input: string, alias: string): boolean {
    const normalizedAlias = normalizeText(alias)
    return input === normalizedAlias || input.startsWith(`${normalizedAlias} `)
  }

  private scoreKeywords(
    pattern: CommandPattern,
    input: string,
  ): { confidence: number; input: Record<string, unknown> } {
    const allKeywords = pattern.patterns.flatMap((p) => p.keywords ?? [])
    if (allKeywords.length === 0) return { confidence: 0, input: {} }

    const inputWords = new Set(input.split(' '))
    let matched = 0
    for (const kw of allKeywords) {
      if (inputWords.has(kw.toLowerCase())) matched++
    }

    const confidence = matched / allKeywords.length
    if (confidence < 0.4) return { confidence: 0, input: {} }

    const remainder = input
      .split(' ')
      .filter((w) => !allKeywords.some((kw) => kw.toLowerCase() === w))
      .join(' ')

    return {
      confidence: confidence * 0.6,
      input: remainder ? { query: remainder, raw: input } : { raw: input },
    }
  }
}
