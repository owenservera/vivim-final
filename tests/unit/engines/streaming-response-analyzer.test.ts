// tests/unit/engines/streaming-response-analyzer.test.ts
// StreamingResponseAnalyzer — transport detection, provider classification.
import { describe, expect, it } from 'bun:test'
import { StreamingResponseAnalyzer } from '../../../src/engines/streaming-response-analyzer.js'

describe('StreamingResponseAnalyzer', () => {
  const analyzer = new StreamingResponseAnalyzer()

  it('detects Anthropic SSE format', () => {
    const body = `event: message_start
data: {"type":"message_start"}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"text":"Hello"}}

event: message_stop
data: {"type":"message_stop"}`
    const result = analyzer.analyze(body)
    expect(result.transport).toBe('sse')
    expect(result.confidence).toBeGreaterThan(0.7)
  })

  it('detects OpenAI SSE format', () => {
    const body = `data: {"choices":[{"delta":{"content":"Hi"}}]}

data: {"choices":[{"delta":{}}]}

data: [DONE]`
    const result = analyzer.analyze(body)
    expect(result.transport).toBe('sse')
    expect(result.confidence).toBeGreaterThan(0.7)
  })

  it('returns unknown for unrecognized format', () => {
    const result = analyzer.analyze('just plain text')
    expect(result.transport).toBe('unknown')
    expect(result.confidence).toBeLessThan(0.7)
  })

  it('returns unknown for empty body', () => {
    const result = analyzer.analyze('')
    expect(result.transport).toBe('unknown')
  })

  it('generates logicCode for recognized formats', () => {
    const body = `data: {"choices":[{"delta":{"content":"Hi"}}]}

data: [DONE]`
    const result = analyzer.analyze(body)
    expect(result.logicCode).toBeTruthy()
    expect(typeof result.logicCode).toBe('string')
  })
})
