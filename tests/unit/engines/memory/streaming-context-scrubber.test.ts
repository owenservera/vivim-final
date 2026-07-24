import { beforeEach, describe, expect, it } from 'bun:test'
import {
  StreamingContextScrubber,
  sanitizeContext,
} from '../../../../src/engines/memory/streaming-context-scrubber.js'

describe('streaming-context-scrubber', () => {
  let scrubber: StreamingContextScrubber

  beforeEach(() => {
    scrubber = new StreamingContextScrubber()
  })

  it('passes through plain text', () => {
    expect(scrubber.feed('hello world')).toBe('hello world')
  })

  it('scrubs a complete memory-context span', () => {
    const result = scrubber.feed('before <memory-context>secret</memory-context> after')
    expect(result).toBe('before  after')
  })

  it('scrubs multiple spans', () => {
    const result = scrubber.feed(
      'a <memory-context>x</memory-context> b <memory-context>y</memory-context> c',
    )
    expect(result).toBe('a  b  c')
  })

  it('scrubs when open tag is complete across one delta', () => {
    scrubber.feed('before <memory-context>')
    const result = scrubber.feed('secret</memory-context> after')
    expect(result).toBe(' after')
  })

  it('holds partial tag at start of buffer when no close tag yet', () => {
    const r1 = scrubber.feed('<memory-')
    expect(r1).toBe('')
    const r2 = scrubber.feed('context>secret</memory-context> world')
    expect(r2).toBe(' world')
  })

  it('emits text before partial tag when prefix precedes it', () => {
    const r1 = scrubber.feed('hello <memory-')
    expect(r1).toBe('hello <memory-')
  })

  it('flush returns empty when buffer already consumed', () => {
    scrubber.feed('held text')
    expect(scrubber.flush()).toBe('')
  })

  it('flush returns held partial tag at start of buffer', () => {
    scrubber.feed('<memory-')
    expect(scrubber.flush()).toBe('<memory-')
  })

  it('sanitizeContext one-shot scrubs', () => {
    expect(sanitizeContext('a <memory-context>secret</memory-context> b')).toBe('a  b')
  })

  it('sanitizeContext with no tags passes through', () => {
    expect(sanitizeContext('plain text')).toBe('plain text')
  })
})
