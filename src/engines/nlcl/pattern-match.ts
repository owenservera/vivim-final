// src/engines/nlcl/pattern-match.ts
// Shared pattern-matching helper for the new SOTA resolvers (Fuzzy + Semantic).
// Runs a pattern's regexes against raw input and returns validated extracted params,
// or null if no regex matches. Mirrors NLCommandParser.tryMatch's regex path so
// fuzzy/semantic resolvers can recover BOTH intent and parameters, not just intent.

import { normalizeText } from './text-normalizer.js'
import type { CommandPattern, ParsedIntent } from './types.js'

/**
 * Attempt to extract validated parameters from rawInput using a pattern's regexes.
 * Returns the validated input record, or null if no regex matches.
 */
export function extractPatternInput(
  pattern: CommandPattern,
  rawInput: string,
): Record<string, unknown> | null {
  const normalized = normalizeText(rawInput)
  for (const nlPattern of pattern.patterns) {
    const match = normalized.match(nlPattern.regex)
    if (match) {
      const extracted = nlPattern.extract(match, rawInput)
      const validated = pattern.inputSchema.safeParse(extracted)
      if (validated.success) {
        return validated.data as Record<string, unknown>
      }
    }
  }
  return null
}

/**
 * Build a ParsedIntent for a pattern when only the intent (not params) is known.
 * Attempts parameter extraction first; falls back to empty input.
 */
export function buildIntentFromPattern(
  pattern: CommandPattern,
  rawInput: string,
  confidence: number,
  matchedPattern: string,
): ParsedIntent {
  const extracted = extractPatternInput(pattern, rawInput)
  return {
    patternId: pattern.id,
    intent: pattern.intent,
    input: extracted ?? {},
    confidence,
    rawInput,
    matchedPattern,
    alternatives: [],
    resolvedAt: Date.now(),
    capabilityId: pattern.capabilityId,
  }
}
