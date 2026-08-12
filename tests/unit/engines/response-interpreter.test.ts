// tests/unit/engines/response-interpreter.test.ts
// Unit tests for ResponseInterpreter — text extraction, hedging, and continuity.

import { describe, expect, it } from 'bun:test'
import {
  applyDialogueContinuity,
  applyHedging,
  createNoOpResponseInterpreter,
  createResponseInterpreter,
  extractFromOutput,
  isMeaningful,
} from '../../../src/engines/nlcl/response-interpreter.js'
import type { CommandResult } from '../../../src/engines/nlcl/types.js'

// ── Test Helpers ────────────────────────────────────────────────────────

function makeResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    ok: true,
    intent: 'test.intent',
    latencyMs: 10,
    traceId: 'test-trace',
    classification: 'read',
    ...overrides,
  }
}

// ── isMeaningful ────────────────────────────────────────────────────────

describe('isMeaningful', () => {
  it('returns true for meaningful text', () => {
    expect(isMeaningful('Opened config.json (3 sections)')).toBe(true)
    expect(isMeaningful('Found 12 files matching "query"')).toBe(true)
    expect(isMeaningful('Email sent to user@example.com')).toBe(true)
  })

  it('returns false for undefined', () => {
    expect(isMeaningful(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isMeaningful('')).toBe(false)
  })

  it('returns false for short text (< 10 chars)', () => {
    expect(isMeaningful('hello')).toBe(false)
    expect(isMeaningful('123456789')).toBe(false)
  })

  it('returns false for template pattern "X executed"', () => {
    expect(isMeaningful('File Open executed')).toBe(false)
    expect(isMeaningful('System Logs executed')).toBe(false)
    expect(isMeaningful('Command executed')).toBe(false)
  })

  it('returns false for "Interpretation failed"', () => {
    expect(isMeaningful('Interpretation failed')).toBe(false)
  })
})

// ── extractFromOutput ───────────────────────────────────────────────────

describe('extractFromOutput', () => {
  it('returns undefined for null/undefined', () => {
    expect(extractFromOutput(null)).toBeUndefined()
    expect(extractFromOutput(undefined)).toBeUndefined()
  })

  it('returns string output directly', () => {
    expect(extractFromOutput('hello')).toBe('hello')
  })

  it('extracts .text from object', () => {
    expect(extractFromOutput({ text: '14:32 UTC' })).toBe('14:32 UTC')
  })

  it('extracts .message from object', () => {
    expect(extractFromOutput({ message: 'File saved' })).toBe('File saved')
  })

  it('extracts .content from object', () => {
    expect(extractFromOutput({ content: 'line 1\nline 2' })).toBe('line 1\nline 2')
  })

  it('extracts .summary from object', () => {
    expect(extractFromOutput({ summary: 'All systems operational' })).toBe(
      'All systems operational',
    )
  })

  it('joins .lines array', () => {
    expect(extractFromOutput({ lines: ['a', 'b', 'c'] })).toBe('a\nb\nc')
  })

  it('counts .entries array', () => {
    expect(extractFromOutput({ entries: [1, 2, 3] })).toBe('Found 3 entries')
  })

  it('extracts .content from .file + .content', () => {
    expect(extractFromOutput({ file: 'config.json', content: '...' })).toBe('...')
  })

  it('formats .path', () => {
    expect(extractFromOutput({ path: '/etc/config' })).toBe('Opened /etc/config')
  })

  it('counts pure array', () => {
    expect(extractFromOutput([1, 2, 3])).toBe('Found 3 items')
  })

  it('handles empty array', () => {
    expect(extractFromOutput([])).toBe('No results found')
  })

  it('extracts .error from object', () => {
    expect(extractFromOutput({ error: 'File not found' })).toBe('File not found')
  })

  it('returns undefined for number', () => {
    expect(extractFromOutput(42)).toBeUndefined()
  })

  it('returns undefined for boolean', () => {
    expect(extractFromOutput(true)).toBeUndefined()
  })

  it('returns undefined for empty object', () => {
    expect(extractFromOutput({})).toBeUndefined()
  })

  it('returns undefined for object with non-string .text', () => {
    expect(extractFromOutput({ text: 123 })).toBeUndefined()
  })
})

// ── applyHedging ────────────────────────────────────────────────────────

describe('applyHedging', () => {
  it('no hedge on deterministic', () => {
    expect(applyHedging('Opened file', 'deterministic', 1.0)).toBe('Opened file')
  })

  it('no hedge on none', () => {
    expect(applyHedging('Opened file', 'none', 0.5)).toBe('Opened file')
  })

  it('no hedge when layer is undefined', () => {
    expect(applyHedging('Opened file', undefined, undefined)).toBe('Opened file')
  })

  it('no hedge on fuzzy with high confidence', () => {
    expect(applyHedging('Opened file', 'fuzzy', 0.9)).toBe('Opened file')
  })

  it('no hedge on semantic with high confidence', () => {
    expect(applyHedging('Opened file', 'semantic', 0.85)).toBe('Opened file')
  })

  it('adds hedge on semantic with low confidence', () => {
    const result = applyHedging('Opened file', 'semantic', 0.65)
    expect(result).toContain('let me know')
    expect(result).toContain('Opened file')
  })

  it('no hedge on llm', () => {
    expect(applyHedging('Opened file', 'llm', 0.8)).toBe('Opened file')
  })
})

// ── applyDialogueContinuity ─────────────────────────────────────────────

describe('applyDialogueContinuity', () => {
  it('no continuity on turn 1', () => {
    const result = applyDialogueContinuity('Edited line 42', ['config.json'], 1)
    expect(result).toBe('Edited line 42')
  })

  it('no continuity with no entities', () => {
    const result = applyDialogueContinuity('Edited line 42', [], 3)
    expect(result).toBe('Edited line 42')
  })

  it('no continuity with undefined entities', () => {
    const result = applyDialogueContinuity('Edited line 42', undefined, 3)
    expect(result).toBe('Edited line 42')
  })

  it('adds continuity on turn 2+ with entities', () => {
    const result = applyDialogueContinuity('Edited line 42', ['config.json'], 3)
    expect(result).toContain('re: config.json')
    expect(result).toContain('Edited line 42')
  })

  it('no continuity when text already contains entity', () => {
    const result = applyDialogueContinuity('Opened config.json', ['config.json'], 3)
    expect(result).toBe('Opened config.json')
  })
})

// ── ResponseInterpreter.enrich ──────────────────────────────────────────

describe('ResponseInterpreter.enrich', () => {
  const interpreter = createResponseInterpreter()
  const baseCtx = { resolutionLayer: 'deterministic' as const, confidence: 1.0 }

  describe('Rule 1: already-meaningful passthrough', () => {
    it('passes through meaningful text', () => {
      const result = makeResult({ text: 'Opened config.json (3 sections)' })
      expect(interpreter.enrich(result, baseCtx).text).toBe('Opened config.json (3 sections)')
    })

    it('does NOT passthrough template pattern when output is available', () => {
      const result = makeResult({ text: 'File Open executed', output: { text: 'Actual content' } })
      const enriched = interpreter.enrich(result, baseCtx)
      expect(enriched.text).toBe('Actual content')
    })
  })

  describe('Rule 2: structured output extraction', () => {
    it('extracts .text from output', () => {
      const result = makeResult({ output: { text: '14:32 UTC' } })
      expect(interpreter.enrich(result, baseCtx).text).toBe('14:32 UTC')
    })

    it('extracts .message from output', () => {
      const result = makeResult({ output: { message: 'File saved' } })
      expect(interpreter.enrich(result, baseCtx).text).toBe('File saved')
    })

    it('extracts .content from output', () => {
      const result = makeResult({ output: { content: 'line 1\nline 2' } })
      expect(interpreter.enrich(result, baseCtx).text).toBe('line 1\nline 2')
    })

    it('extracts string output directly', () => {
      const result = makeResult({ output: 'some result' })
      expect(interpreter.enrich(result, baseCtx).text).toBe('some result')
    })

    it('joins .lines array', () => {
      const result = makeResult({ output: { lines: ['a', 'b', 'c'] } })
      expect(interpreter.enrich(result, baseCtx).text).toBe('a\nb\nc')
    })

    it('counts .entries array', () => {
      const result = makeResult({ output: { entries: [1, 2, 3] } })
      expect(interpreter.enrich(result, baseCtx).text).toBe('Found 3 entries')
    })

    it('formats .path', () => {
      const result = makeResult({ output: { path: '/etc/config' } })
      expect(interpreter.enrich(result, baseCtx).text).toBe('Opened /etc/config')
    })

    it('counts array output', () => {
      const result = makeResult({ output: [1, 2, 3] })
      expect(interpreter.enrich(result, baseCtx).text).toBe('Found 3 items')
    })

    it('handles empty array', () => {
      const result = makeResult({ output: [] })
      expect(interpreter.enrich(result, baseCtx).text).toBe('No results found')
    })

    it('extracts .error from output', () => {
      const result = makeResult({ ok: false, output: { error: 'File not found' } })
      expect(interpreter.enrich(result, baseCtx).text).toBe('File not found')
    })
  })

  describe('Rule 3: confidence hedging', () => {
    it('no hedge on deterministic', () => {
      const result = makeResult({ output: { text: 'Opened file' } })
      const ctx = { resolutionLayer: 'deterministic' as const, confidence: 1.0 }
      expect(interpreter.enrich(result, ctx).text).toBe('Opened file')
    })

    it('hedge on semantic with low confidence', () => {
      const result = makeResult({ output: { text: 'Opened file' } })
      const ctx = { resolutionLayer: 'semantic' as const, confidence: 0.65 }
      const text = interpreter.enrich(result, ctx).text
      expect(text).toContain('let me know')
    })

    it('no hedge on semantic with high confidence', () => {
      const result = makeResult({ output: { text: 'Opened file' } })
      const ctx = { resolutionLayer: 'semantic' as const, confidence: 0.85 }
      expect(interpreter.enrich(result, ctx).text).toBe('Opened file')
    })
  })

  describe('Rule 4: dialogue continuity', () => {
    it('adds continuity on turn 2+', () => {
      const result = makeResult({ output: { text: 'Edited line 42' } })
      const ctx = { ...baseCtx, dialogueTurnCount: 3, recentEntities: ['config.json'] }
      const text = interpreter.enrich(result, ctx).text
      expect(text).toContain('re: config.json')
    })

    it('no continuity on turn 1', () => {
      const result = makeResult({ output: { text: 'Edited line 42' } })
      const ctx = { ...baseCtx, dialogueTurnCount: 1, recentEntities: ['config.json'] }
      expect(interpreter.enrich(result, ctx).text).toBe('Edited line 42')
    })

    it('no continuity with no entities', () => {
      const result = makeResult({ output: { text: 'Edited line 42' } })
      const ctx = { ...baseCtx, dialogueTurnCount: 5, recentEntities: [] }
      expect(interpreter.enrich(result, ctx).text).toBe('Edited line 42')
    })
  })

  describe('error resilience', () => {
    it('returns original on exception', () => {
      const result = makeResult({ text: 'test' })
      expect(() => interpreter.enrich(result, null as any)).not.toThrow()
    })

    it('returns original when no extraction possible', () => {
      const result = makeResult({ output: 42 })
      const enriched = interpreter.enrich(result, baseCtx)
      expect(enriched.text).toBeUndefined()
    })
  })
})

// ── NoOpResponseInterpreter ─────────────────────────────────────────────

describe('NoOpResponseInterpreter', () => {
  const interpreter = createNoOpResponseInterpreter()
  const baseCtx = { resolutionLayer: 'deterministic' as const, confidence: 1.0 }

  it('always returns original result', () => {
    const result = makeResult({ text: 'test', output: { text: 'should not extract' } })
    const enriched = interpreter.enrich(result, baseCtx)
    expect(enriched.text).toBe('test')
    expect(enriched.output).toEqual({ text: 'should not extract' })
  })
})
