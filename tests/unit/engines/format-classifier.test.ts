// tests/unit/engines/format-classifier.test.ts
// FormatClassifier — LLM-driven format classification and parser generation.
import { describe, expect, it, mock } from 'bun:test'
import { FormatClassifier, type LlmClient } from '../../../src/engines/format-classifier.js'

function createMockLlmClient(response: string): LlmClient {
  return { complete: mock(() => Promise.resolve(response)) }
}

describe('FormatClassifier', () => {
  it('classifies SSE format', async () => {
    const llmResponse = JSON.stringify({
      transport: 'sse',
      eventName: 'message',
      confidence: 0.9,
      dataPath: 'choices[0].delta.content',
      schemaDescription: 'OpenAI SSE streaming format',
      rationale: 'Standard Server-Sent Events with data: prefix',
    })
    const client = createMockLlmClient(llmResponse)
    const classifier = new FormatClassifier(client)
    const result = await classifier.classify('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n')
    expect(result.transport).toBe('sse')
    expect(result.confidence).toBe(0.9)
    expect(result.dataPath).toBe('choices[0].delta.content')
  })

  it('classifies SSE format from markdown-wrapped JSON', async () => {
    const llmResponse = `\`\`\`json\n${JSON.stringify({
      transport: 'sse',
      confidence: 0.85,
      schemaDescription: 'Anthropic SSE',
      rationale: 'event: prefix pattern',
    })}\n\`\`\``
    const client = createMockLlmClient(llmResponse)
    const classifier = new FormatClassifier(client)
    const result = await classifier.classify('event: content_block_delta\ndata: {"text":"Hi"}')
    expect(result.transport).toBe('sse')
    expect(result.confidence).toBe(0.85)
  })

  it('clamps confidence to [0, 1]', async () => {
    const llmResponse = JSON.stringify({
      transport: 'unknown',
      confidence: 1.5,
      schemaDescription: 'test',
      rationale: 'test',
    })
    const client = createMockLlmClient(llmResponse)
    const classifier = new FormatClassifier(client)
    const result = await classifier.classify('some data')
    expect(result.confidence).toBe(1.0)
  })

  it('defaults confidence to 0.5 when missing', async () => {
    const llmResponse = JSON.stringify({
      transport: 'sse',
      schemaDescription: 'test',
      rationale: 'test',
    })
    const client = createMockLlmClient(llmResponse)
    const classifier = new FormatClassifier(client)
    const result = await classifier.classify('some data')
    expect(result.confidence).toBe(0.5)
  })

  it('normalizes invalid transport to unknown', async () => {
    const llmResponse = JSON.stringify({
      transport: 'invalid_transport',
      confidence: 0.7,
      schemaDescription: 'test',
      rationale: 'test',
    })
    const client = createMockLlmClient(llmResponse)
    const classifier = new FormatClassifier(client)
    const result = await classifier.classify('some data')
    expect(result.transport).toBe('unknown')
  })

  it('throws FormatClassifierError on empty body', async () => {
    const client = createMockLlmClient('{}')
    const classifier = new FormatClassifier(client)
    await expect(classifier.classify('')).rejects.toThrow('FormatClassifierError')
  })

  it('throws FormatClassifierError on invalid JSON response', async () => {
    const client = createMockLlmClient('not json at all')
    const classifier = new FormatClassifier(client)
    await expect(classifier.classify('some data')).rejects.toThrow('FormatClassifierError')
  })

  it('generateParser returns code from markdown block', async () => {
    const code = `exports.default = {
      name: 'test/inferred',
      version: 1,
      providerId: 'test',
      parse(rawBody) { return [{ type: 'text', text: rawBody }] },
      detectCompletion(rawBody) { return rawBody.includes('[DONE]') },
      getConfidence() { return 0.8 }
    }`
    const client = createMockLlmClient(`\`\`\`javascript\n${code}\n\`\`\``)
    const classifier = new FormatClassifier(client)
    const result = await classifier.generateParser(
      'data: [DONE]',
      { transport: 'sse', confidence: 0.9, schemaDescription: 'test', rationale: 'test' },
      'test',
    )
    expect(result).toContain('exports.default')
    expect(result).toContain('test/inferred')
  })

  it('generateParser extracts raw exports.default pattern', async () => {
    const code = `exports.default = { name: 'x', parse() { return [] }, detectCompletion() { return false }, getConfidence() { return 0 } }`
    const client = createMockLlmClient(code)
    const classifier = new FormatClassifier(client)
    const result = await classifier.generateParser(
      'some data',
      { transport: 'sse', confidence: 0.5, schemaDescription: 'test', rationale: 'test' },
      'x',
    )
    expect(result).toContain('exports.default')
  })

  it('generateParser throws FormatClassifierError on empty body', async () => {
    const client = createMockLlmClient('{}')
    const classifier = new FormatClassifier(client)
    await expect(
      classifier.generateParser(
        '',
        { transport: 'sse', confidence: 0.5, schemaDescription: '', rationale: '' },
        'test',
      ),
    ).rejects.toThrow('FormatClassifierError')
  })

  it('generateParser throws FormatClassifierError on empty LLM response', async () => {
    const client = createMockLlmClient('   ')
    const classifier = new FormatClassifier(client)
    await expect(
      classifier.generateParser(
        'data',
        { transport: 'sse', confidence: 0.5, schemaDescription: '', rationale: '' },
        'test',
      ),
    ).rejects.toThrow('FormatClassifierError')
  })
})
