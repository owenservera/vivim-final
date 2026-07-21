import type {
  CategoryColor,
  CommandCategory,
  CommandDescriptionRow,
  CommandIntent,
  PatternMatchResult,
} from './types.js'

// ─── Category → Color Map ────────────────────────────────────────────
const CATEGORY_COLORS: Record<CommandCategory, CategoryColor> = {
  conversation: {
    category: 'conversation',
    primary: '#3B82F6',
    hsl: [217, 91, 60],
    shades: {
      light: 'hsl(217, 91%, 80%)',
      medium: 'hsl(217, 91%, 60%)',
      dark: 'hsl(217, 91%, 45%)',
    },
  },
  memory: {
    category: 'memory',
    primary: '#F59E0B',
    hsl: [38, 92, 50],
    shades: { light: 'hsl(38, 92%, 70%)', medium: 'hsl(38, 92%, 50%)', dark: 'hsl(38, 92%, 35%)' },
  },
  email: {
    category: 'email',
    primary: '#10B981',
    hsl: [160, 84, 39],
    shades: {
      light: 'hsl(160, 84%, 59%)',
      medium: 'hsl(160, 84%, 39%)',
      dark: 'hsl(160, 84%, 24%)',
    },
  },
  file: {
    category: 'file',
    primary: '#64748B',
    hsl: [215, 16, 47],
    shades: {
      light: 'hsl(215, 16%, 67%)',
      medium: 'hsl(215, 16%, 47%)',
      dark: 'hsl(215, 16%, 32%)',
    },
  },
  browser: {
    category: 'browser',
    primary: '#06B6D4',
    hsl: [189, 94, 43],
    shades: {
      light: 'hsl(189, 94%, 63%)',
      medium: 'hsl(189, 94%, 43%)',
      dark: 'hsl(189, 94%, 28%)',
    },
  },
  llm: {
    category: 'llm',
    primary: '#8B5CF6',
    hsl: [258, 90, 66],
    shades: {
      light: 'hsl(258, 90%, 86%)',
      medium: 'hsl(258, 90%, 66%)',
      dark: 'hsl(258, 90%, 51%)',
    },
  },
  system: {
    category: 'system',
    primary: '#F43F5E',
    hsl: [347, 90, 60],
    shades: {
      light: 'hsl(347, 90%, 80%)',
      medium: 'hsl(347, 90%, 60%)',
      dark: 'hsl(347, 90%, 45%)',
    },
  },
  canvas: {
    category: 'canvas',
    primary: '#EC4899',
    hsl: [330, 81, 60],
    shades: {
      light: 'hsl(330, 81%, 80%)',
      medium: 'hsl(330, 81%, 60%)',
      dark: 'hsl(330, 81%, 45%)',
    },
  },
  channel: {
    category: 'channel',
    primary: '#14B8A6',
    hsl: [168, 76, 40],
    shades: {
      light: 'hsl(168, 76%, 60%)',
      medium: 'hsl(168, 76%, 40%)',
      dark: 'hsl(168, 76%, 25%)',
    },
  },
  session: {
    category: 'session',
    primary: '#6366F1',
    hsl: [245, 58, 61],
    shades: {
      light: 'hsl(245, 58%, 81%)',
      medium: 'hsl(245, 58%, 61%)',
      dark: 'hsl(245, 58%, 46%)',
    },
  },
  workflow: {
    category: 'workflow',
    primary: '#F97316',
    hsl: [25, 95, 53],
    shades: { light: 'hsl(25, 95%, 73%)', medium: 'hsl(25, 95%, 53%)', dark: 'hsl(25, 95%, 38%)' },
  },
  automation: {
    category: 'automation',
    primary: '#84CC16',
    hsl: [84, 81, 44],
    shades: { light: 'hsl(84, 81%, 64%)', medium: 'hsl(84, 81%, 44%)', dark: 'hsl(84, 81%, 29%)' },
  },
  provider: {
    category: 'provider',
    primary: '#6366F1',
    hsl: [245, 58, 61],
    shades: {
      light: 'hsl(245, 58%, 81%)',
      medium: 'hsl(245, 58%, 61%)',
      dark: 'hsl(245, 58%, 46%)',
    },
  },
  agent: {
    category: 'agent',
    primary: '#8B5CF6',
    hsl: [258, 90, 66],
    shades: {
      light: 'hsl(258, 90%, 86%)',
      medium: 'hsl(258, 90%, 66%)',
      dark: 'hsl(258, 90%, 51%)',
    },
  },
  tag: {
    category: 'tag',
    primary: '#10B981',
    hsl: [160, 84, 39],
    shades: {
      light: 'hsl(160, 84%, 59%)',
      medium: 'hsl(160, 84%, 39%)',
      dark: 'hsl(160, 84%, 24%)',
    },
  },
  discovery: {
    category: 'discovery',
    primary: '#F59E0B',
    hsl: [38, 92, 50],
    shades: { light: 'hsl(38, 92%, 70%)', medium: 'hsl(38, 92%, 50%)', dark: 'hsl(38, 92%, 35%)' },
  },
}

/**
 * Get color for a command category.
 */
export function getCategoryColor(category: CommandCategory): CategoryColor {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.system
}

/**
 * Get a specific shade for a category.
 */
export function getShade(category: CommandCategory, shade: 'light' | 'medium' | 'dark'): string {
  return getCategoryColor(category).shades[shade]
}

// ─── Fuzzy Pattern Matching ──────────────────────────────────────────

/**
 * Calculate fuzzy match score between query and pattern.
 * Returns 0.0-1.0.
 */
function patternScore(query: string, pattern: string): number {
  const q = query.toLowerCase().trim()
  const p = pattern.toLowerCase().trim()

  if (q === p) return 1.0
  if (p.startsWith(q)) return 0.9
  if (p.includes(q)) return 0.75

  // Word-level matching
  const qWords = q.split(/\s+/)
  const pWords = p.split(/\s+/)
  const matchedWords = qWords.filter((qw) =>
    pWords.some((pw) => pw.startsWith(qw) || pw.includes(qw)),
  )
  const wordScore = matchedWords.length / Math.max(qWords.length, 1)

  if (wordScore > 0.5) return wordScore * 0.85

  // Levenshtein fallback
  const maxLen = Math.max(q.length, p.length)
  if (maxLen === 0) return 1.0
  const dist = levenshtein(q, p)
  const sim = 1 - dist / maxLen
  return sim > 0.6 ? sim * 0.7 : 0
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0))

  // biome-ignore lint/style/noNonNullAssertion: dp rows are initialized above and always defined
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  // biome-ignore lint/style/noNonNullAssertion: dp rows are initialized above and always defined
  for (let j = 0; j <= n; j++) dp[0]![j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      // biome-ignore lint/style/noNonNullAssertion: dp rows are initialized above and always defined
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
    }
  }

  // biome-ignore lint/style/noNonNullAssertion: dp rows are initialized above and always defined
  return dp[m]![n]!
}

// ─── NLP Intent Matching ─────────────────────────────────────────────

const DEFAULT_CONFIDENCE_THRESHOLD = 0.4
const HIGH_CONFIDENCE_THRESHOLD = 0.7

/**
 * Match user input against CommandDescription patterns.
 * Returns top matches with confidence scores.
 */
export function matchPatterns(
  input: string,
  descriptions: CommandDescriptionRow[],
  options: {
    limit?: number
    category?: string
    prefix?: string
    minConfidence?: number
  } = {},
): PatternMatchResult[] {
  const { limit = 5, category, prefix, minConfidence = DEFAULT_CONFIDENCE_THRESHOLD } = options

  // Early return for empty input
  if (!input || input.trim().length === 0) {
    return []
  }

  const filtered = descriptions.filter((d) => {
    if (!d.enabled) return false
    if (category && d.category !== category) return false
    if (prefix && d.prefix !== prefix) return false
    return true
  })

  const results: PatternMatchResult[] = []

  for (const desc of filtered) {
    let bestScore = 0
    let bestPattern = ''

    for (const pattern of desc.patterns) {
      const score = patternScore(input, pattern)
      if (score > bestScore) {
        bestScore = score
        bestPattern = pattern
      }
    }

    // Also match against description itself
    const descScore = patternScore(input, desc.description)
    if (descScore > bestScore) {
      bestScore = descScore
      bestPattern = desc.description
    }

    // Apply base confidence weight
    const finalScore = bestScore * desc.confidence

    if (finalScore >= minConfidence) {
      results.push({
        commandId: desc.commandId,
        description: desc.description,
        confidence: finalScore,
        category: desc.category as CommandCategory,
        matchedPattern: bestPattern,
      })
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, limit)
}

/**
 * Detect intent from plain text input.
 * Returns the best matching CommandIntent or null.
 */
export function detectIntent(
  input: string,
  descriptions: CommandDescriptionRow[],
  options: {
    threshold?: number
    category?: string
  } = {},
): CommandIntent | null {
  const { threshold = DEFAULT_CONFIDENCE_THRESHOLD, category } = options

  const matches = matchPatterns(input, descriptions, {
    limit: 1,
    category,
    minConfidence: threshold,
  })

  const best = matches[0]
  if (!best) return null

  const color = getCategoryColor(best.category)

  return {
    commandId: best.commandId,
    confidence: best.confidence,
    category: best.category,
    args: {},
    source: 'nlp',
    color,
    interpretation: best.description,
  }
}

/**
 * Check if confidence is high enough for auto-execution.
 */
export function isHighConfidence(confidence: number): boolean {
  return confidence >= HIGH_CONFIDENCE_THRESHOLD
}

/**
 * Get confidence level label.
 */
export function getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return 'high'
  if (confidence >= 0.55) return 'medium'
  return 'low'
}
