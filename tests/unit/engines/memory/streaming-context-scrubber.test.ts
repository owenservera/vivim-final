// tests/unit/engines/memory/streaming-context-scrubber.test.ts
// Unit tests for StreamingContextScrubber + sanitizeContext (decision D5 / FR-004).

import { describe, expect, it } from 'bun:test'
import {
  StreamingContextScrubber,
  sanitizeContext,
} from '../../../../src/engines/memory/streaming-context-scrubber.js'

describe('StreamingContextScrubber', () => {
  it('drops a complete <memory-context> span', () => {
    const s = new StreamingContextScrubber()
    expect(s.feed('a <memory-context>SECRET</memory-context> b')).toBe('a  b')
  })

  it('holds a span open across split deltas', () => {
    const s = new StreamingContextScrubber()
    expect(s.feed('pre <memory-context>sec')).toBe('pre ')
    expect(s.feed('ret</memory-context> post')).toBe(' post')
  })

  it('never emits the secret even when the close tag is partial', () => {
    const s = new StreamingContextScrubber()
    s.feed('x <memory-context>hidden')
    const out = s.feed(' more text')
    expect(out).toBe('')
    expect(out).not.toContain('hidden')
  })

  it('flush discards an unterminated span', () => {
    const s = new StreamingContextScrubber()
    const out = s.feed('keep <memory-context>orphan')
    expect(out).toBe('keep ')
    expect(s.flush()).toBe('')
  })

  it('handles multiple spans', () => {
    const s = new StreamingContextScrubber()
    const out = s.feed('a<memory-context>1</memory-context>b<memory-context>2</memory-context>c')
    expect(out).toBe('abc')
  })
})

describe('sanitizeContext', () => {
  it('one-shot sanitize removes the span', () => {
    expect(sanitizeContext('hi <memory-context>SECRET</memory-context> bye')).toBe('hi  bye')
  })
  it('returns text unchanged when no span', () => {
    expect(sanitizeContext('plain text')).toBe('plain text')
  })
})
