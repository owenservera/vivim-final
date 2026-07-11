import { describe, expect, it } from 'bun:test'
import { GeminiExportParserImpl } from '../../../../src/engines/parsers/gemini-import.js'

const sample = JSON.stringify([
  {
    id: 'gemini-conv-1',
    title: 'Gemini Chat',
    messages: [
      { author: 'user', content: 'What is TypeScript?', timestamp: '2024-01-01T00:00:00.000Z' },
      {
        author: 'model',
        content: 'TypeScript is a typed superset of JavaScript.',
        timestamp: '2024-01-01T00:00:01.000Z',
      },
    ],
  },
])

describe('GeminiExportParserImpl', () => {
  it('parses sample Gemini export with correct conversation count', () => {
    const parser = new GeminiExportParserImpl()
    const result = parser.parse(sample)
    expect(result.length).toBe(1)
    expect(result[0]?.title).toBe('Gemini Chat')
    expect(result[0]?.externalId).toBe('gemini-conv-1')
    expect(result[0]?.source).toBe('gemini')
  })

  it('maps author correctly: user → user, model → assistant', () => {
    const parser = new GeminiExportParserImpl()
    const result = parser.parse(sample)
    const conversation = result[0]
    const messages = conversation?.messages ?? []
    expect(messages[0]?.role).toBe('user')
    expect(messages[1]?.role).toBe('assistant')
  })
})
