// tests/unit/engines/stream-align.test.ts
// StreamAlignmentEngine (Phase 23.1) — format inference, delta path, hashing.

import { describe, expect, it } from 'bun:test'
import { StreamAlignmentEngine } from '../../../src/engines/stream-align.js'

function mockParser() {
  return {
    parse: async (body: string, _providerId: string) => ({
      parserName: 'mock',
      confidence: body.includes('content') ? 0.9 : 0.3,
      blocks:
        body.includes('content') || body.includes('text') ? [{ kind: 'text', text: 'hi' }] : [],
    }),
  } as any
}

describe('StreamAlignmentEngine (Phase 23.1)', () => {
  it('infers sse, json, html and custom formats', () => {
    const eng = new StreamAlignmentEngine(mockParser())
    expect(eng.inferFormat('data: {"x":1}\n\ndata: [DONE]')).toBe('sse')
    expect(eng.inferFormat('{"choices":[]}')).toBe('json')
    expect(eng.inferFormat('<html><body>x</body></html>')).toBe('html')
    expect(eng.inferFormat('just text no structure')).toBe('custom')
  })

  it('detects the response delta path from a JSON sample', () => {
    const eng = new StreamAlignmentEngine(mockParser())
    const { path, candidates } = eng.detectDeltaPath('{"choices":[{"delta":{"content":"hi"}}]}')
    expect(path).toBe('choices[0].delta.content')
    expect(candidates.length).toBeGreaterThan(0)
  })

  it('returns no delta path for invalid JSON', () => {
    const eng = new StreamAlignmentEngine(mockParser())
    expect(eng.detectDeltaPath('not json').path).toBeNull()
  })

  it('validates a configured delta path', () => {
    const eng = new StreamAlignmentEngine(mockParser())
    const ok = eng.validateDeltaPath(
      'choices[0].delta.content',
      '{"choices":[{"delta":{"content":"hi"}}]}',
    )
    expect(ok.valid).toBe(true)
    expect(ok.resolvedValue).toBe('hi')
    const bad = eng.validateDeltaPath('nope.path', '{"a":1}')
    expect(bad.valid).toBe(false)
    const invalidJson = eng.validateDeltaPath('a', 'not json')
    expect(invalidJson.valid).toBe(false)
  })

  it('computes a deterministic parser hash (instance + static)', () => {
    const eng = new StreamAlignmentEngine(mockParser())
    const h1 = eng.computeParserHash('function parse() {}')
    const h2 = StreamAlignmentEngine.computeParserHash('function parse() {}')
    expect(h1).toBe(h2)
    expect(h1.length).toBe(64)
    expect(() => eng.computeParserHash('')).toThrow()
  })

  it('reports a mismatch when no stream body is captured', async () => {
    const eng = new StreamAlignmentEngine(mockParser())
    const report = await eng.alignCaptured([], 'chatgpt', 'sse')
    expect(report.ok).toBe(false)
    expect(report.sampleCount).toBe(0)
    expect(report.mismatches.length).toBeGreaterThan(0)
  })

  it('aligns captured bodies against the parser', async () => {
    const eng = new StreamAlignmentEngine(mockParser())
    const report = await eng.alignCaptured(
      ['{"choices":[{"delta":{"content":"hi"}}]}'],
      'chatgpt',
      'json',
    )
    expect(report.sampleCount).toBe(1)
    expect(report.textBlocks).toBe(1)
    expect(report.detectedDeltaPath).toBe('choices[0].delta.content')
  })
})
