import type { CommandContext, ParsedCommand, UnifiedCommandSpec } from './types.js'

/**
 * Fuzzy match score between query and target string.
 * Returns 0.0-1.0 where 1.0 is perfect match.
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()

  if (q === t) return 1.0
  if (t.startsWith(q)) return 0.9
  if (t.includes(q)) return 0.7

  // Levenshtein-based similarity
  const maxLen = Math.max(q.length, t.length)
  if (maxLen === 0) return 1.0

  const distance = levenshtein(q, t)
  const similarity = 1 - distance / maxLen

  // Only return meaningful scores
  return similarity > 0.6 ? similarity * 0.8 : 0
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0))

  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }

  return dp[m]![n]!
}

/**
 * Calculate ranking score for a command spec against parsed input.
 *
 * Score formula (from edge-pwa):
 *   0.45 * fuzzy + 0.20 * mru + 0.25 * boost(ctx) + 0.10 * namespacePrefix
 */
function rankingScore(
  spec: UnifiedCommandSpec,
  parsed: ParsedCommand,
  ctx: CommandContext,
  mruSet: Set<string>,
): number {
  // Fuzzy match on command name and aliases
  const targets = [spec.id, spec.namespace, spec.title, ...(spec.aliases ?? [])]
  const bestFuzzy = Math.max(...targets.map((t) => fuzzyScore(parsed.command, t)))

  // MRU bonus
  const mruScore = mruSet.has(spec.id) ? 1.0 : 0

  // Context boost
  const boostScore = spec.boost?.(ctx) ?? 0

  // Namespace prefix match bonus
  const nsScore = spec.namespace.toLowerCase().startsWith(parsed.command.toLowerCase()) ? 1.0 : 0

  return 0.45 * bestFuzzy + 0.2 * mruScore + 0.25 * boostScore + 0.1 * nsScore
}

/**
 * Resolve a parsed command to the best-matching UnifiedCommandSpec.
 *
 * @param parsed - The parsed command input
 * @param ctx - Current command context
 * @param registry - All registered commands
 * @param mruCommands - Recently used command IDs (for MRU boost)
 * @returns Best matching spec, or null if no match above threshold
 */
export function resolveCommand(
  parsed: ParsedCommand,
  ctx: CommandContext,
  registry: UnifiedCommandSpec[],
  mruCommands: string[] = [],
): UnifiedCommandSpec | null {
  const mruSet = new Set(mruCommands)

  // Filter by prefix if present
  const candidates = parsed.prefix ? registry.filter((s) => s.prefix === parsed.prefix) : registry

  // Score all candidates
  const scored = candidates
    .filter((spec) => {
      // Apply visibility gate
      if (spec.when && !spec.when(ctx)) return false
      return true
    })
    .map((spec) => ({
      spec,
      score: rankingScore(spec, parsed, ctx, mruSet),
    }))
    .filter((s) => s.score > 0.3) // Minimum threshold
    .sort((a, b) => b.score - a.score)

  return scored[0]?.spec ?? null
}

/**
 * Get top N suggestions for autocomplete.
 */
export function getSuggestions(
  query: string,
  ctx: CommandContext,
  registry: UnifiedCommandSpec[],
  mruCommands: string[] = [],
  limit = 10,
): Array<{ spec: UnifiedCommandSpec; score: number }> {
  const mruSet = new Set(mruCommands)
  const parsed: ParsedCommand = {
    prefix: null,
    command: query,
    rawArgs: '',
    tokens: [query],
    isCombo: false,
  }

  return registry
    .filter((spec) => {
      if (spec.when && !spec.when(ctx)) return false
      return true
    })
    .map((spec) => ({
      spec,
      score: rankingScore(spec, parsed, ctx, mruSet),
    }))
    .filter((s) => s.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
