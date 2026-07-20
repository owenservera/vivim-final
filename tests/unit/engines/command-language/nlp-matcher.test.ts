import { describe, expect, test } from 'bun:test'
import {
  detectIntent,
  getCategoryColor,
  getConfidenceLevel,
  getShade,
  isHighConfidence,
  matchPatterns,
} from '../../../../src/engines/command-language/nlp-matcher.js'
import type { CommandDescriptionRow } from '../../../../src/engines/command-language/types.js'

const sampleDescriptions: CommandDescriptionRow[] = [
  {
    id: 'desc-1',
    commandId: 'health',
    description: 'Check system health status',
    patterns: ['health', 'check health', 'system health', 'status check'],
    category: 'system',
    prefix: '/',
    confidence: 0.9,
    enabled: true,
  },
  {
    id: 'desc-2',
    commandId: 'switch_provider',
    description: 'Switch to a different AI provider',
    patterns: ['switch provider', 'change provider', 'use claude', 'switch to chatgpt'],
    category: 'provider',
    prefix: '/',
    confidence: 0.85,
    enabled: true,
  },
  {
    id: 'desc-3',
    commandId: 'send_message',
    description: 'Send a message to the current conversation',
    patterns: ['send message', 'send', 'say', 'tell'],
    category: 'conversation',
    prefix: '/',
    confidence: 0.8,
    enabled: true,
  },
  {
    id: 'desc-4',
    commandId: 'tag_add',
    description: 'Add a tag to the current conversation',
    patterns: ['add tag', 'tag', 'label'],
    category: 'tag',
    prefix: '#',
    confidence: 0.75,
    enabled: true,
  },
  {
    id: 'desc-5',
    commandId: 'disabled_cmd',
    description: 'This command is disabled',
    patterns: ['disabled'],
    category: 'system',
    prefix: '/',
    confidence: 0.5,
    enabled: false,
  },
]

describe('matchPatterns', () => {
  // ─── Exact Matches ───────────────────────────────────────────
  test('matches exact pattern', () => {
    const results = matchPatterns('health', sampleDescriptions)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.commandId).toBe('health')
    expect(results[0]!.confidence).toBeGreaterThanOrEqual(0.8)
  })

  test('matches partial pattern', () => {
    const results = matchPatterns('check health', sampleDescriptions)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.commandId).toBe('health')
  })

  // ─── Fuzzy Matching ──────────────────────────────────────────
  test('matches fuzzy input', () => {
    const results = matchPatterns('health check', sampleDescriptions, { minConfidence: 0.2 })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.commandId).toBe('health')
  })

  test('matches partial word', () => {
    const results = matchPatterns('switch', sampleDescriptions)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.commandId).toBe('switch_provider')
  })

  // ─── Confidence Threshold ────────────────────────────────────
  test('respects minConfidence threshold', () => {
    const results = matchPatterns('health', sampleDescriptions, { minConfidence: 0.95 })
    expect(results.length).toBe(0)
  })

  test('returns results above threshold', () => {
    const results = matchPatterns('health', sampleDescriptions, { minConfidence: 0.3 })
    expect(results.length).toBeGreaterThan(0)
  })

  // ─── Category Filtering ──────────────────────────────────────
  test('filters by category', () => {
    const results = matchPatterns('health', sampleDescriptions, { category: 'provider' })
    expect(results.every((r) => r.category === 'provider')).toBe(true)
  })

  // ─── Disabled Commands ───────────────────────────────────────
  test('excludes disabled commands', () => {
    const results = matchPatterns('disabled', sampleDescriptions)
    expect(results.every((r) => r.commandId !== 'disabled_cmd')).toBe(true)
  })

  // ─── Limit ───────────────────────────────────────────────────
  test('respects limit', () => {
    const results = matchPatterns('health', sampleDescriptions, { limit: 1 })
    expect(results.length).toBeLessThanOrEqual(1)
  })

  // ─── Empty Input ─────────────────────────────────────────────
  test('handles empty input', () => {
    const results = matchPatterns('', sampleDescriptions)
    expect(results).toEqual([])
  })

  // ─── No Match ────────────────────────────────────────────────
  test('returns empty for no matches', () => {
    const results = matchPatterns('zzzznonexistent', sampleDescriptions)
    expect(results).toEqual([])
  })
})

describe('detectIntent', () => {
  test('detects health intent', () => {
    const intent = detectIntent('health check', sampleDescriptions)
    expect(intent).not.toBeNull()
    expect(intent!.commandId).toBe('health')
    expect(intent!.confidence).toBeGreaterThanOrEqual(0.4)
    expect(intent!.source).toBe('nlp')
  })

  test('detects provider switch intent', () => {
    const intent = detectIntent('switch to claude', sampleDescriptions)
    expect(intent).not.toBeNull()
    expect(intent!.commandId).toBe('switch_provider')
  })

  test('returns null for low confidence', () => {
    const intent = detectIntent('zzzznonexistent', sampleDescriptions)
    expect(intent).toBeNull()
  })

  test('returns color for detected intent', () => {
    const intent = detectIntent('health', sampleDescriptions)
    expect(intent).not.toBeNull()
    expect(intent!.color).toBeDefined()
    expect(typeof intent!.color.primary).toBe('string')
  })

  test('filters by category', () => {
    const intent = detectIntent('health', sampleDescriptions, { category: 'provider' })
    expect(intent).toBeNull()
  })
})

describe('isHighConfidence', () => {
  test('returns true for >= 0.7', () => {
    expect(isHighConfidence(0.7)).toBe(true)
    expect(isHighConfidence(0.9)).toBe(true)
    expect(isHighConfidence(1.0)).toBe(true)
  })

  test('returns false for < 0.7', () => {
    expect(isHighConfidence(0.69)).toBe(false)
    expect(isHighConfidence(0.5)).toBe(false)
    expect(isHighConfidence(0.0)).toBe(false)
  })
})

describe('getConfidenceLevel', () => {
  test('high for >= 0.7', () => {
    expect(getConfidenceLevel(0.7)).toBe('high')
    expect(getConfidenceLevel(1.0)).toBe('high')
  })

  test('medium for 0.55-0.69', () => {
    expect(getConfidenceLevel(0.55)).toBe('medium')
    expect(getConfidenceLevel(0.69)).toBe('medium')
  })

  test('low for < 0.55', () => {
    expect(getConfidenceLevel(0.54)).toBe('low')
    expect(getConfidenceLevel(0.0)).toBe('low')
  })
})

describe('getCategoryColor', () => {
  test('returns color for each category', () => {
    const categories = [
      'conversation',
      'memory',
      'email',
      'file',
      'browser',
      'llm',
      'system',
      'canvas',
      'channel',
      'session',
      'workflow',
      'automation',
      'provider',
      'agent',
      'tag',
      'discovery',
    ] as const

    for (const cat of categories) {
      const color = getCategoryColor(cat)
      expect(color.category).toBe(cat)
      expect(color.primary).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(color.shades.light).toContain('hsl')
      expect(color.shades.medium).toContain('hsl')
      expect(color.shades.dark).toContain('hsl')
    }
  })
})

describe('getShade', () => {
  test('returns specific shade', () => {
    const light = getShade('system', 'light')
    const medium = getShade('system', 'medium')
    const dark = getShade('system', 'dark')
    expect(light).toContain('hsl')
    expect(medium).toContain('hsl')
    expect(dark).toContain('hsl')
    expect(light).not.toBe(medium)
    expect(medium).not.toBe(dark)
  })
})
