import { describe, expect, it } from 'bun:test'
import { ClaudeExportParserImpl } from '../../../../src/engines/parsers/claude-import.js'

const sample = JSON.stringify([
  {
    uuid: 'conv-1',
    name: 'Architecture Review',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T01:00:00.000Z',
    chat_messages: [
      {
        sender: 'human',
        text: 'Can you review this design?',
        created_at: '2024-01-01T00:00:01.000Z',
      },
      {
        sender: 'assistant',
        text: 'Sure, let me take a look.',
        created_at: '2024-01-01T00:00:02.000Z',
      },
    ],
  },
])

describe('ClaudeExportParserImpl', () => {
  it('parses sample Claude export with correct conversation count', () => {
    const parser = new ClaudeExportParserImpl()
    const result = parser.parse(sample)
    expect(result.length).toBe(1)
    expect(result[0]?.title).toBe('Architecture Review')
    expect(result[0]?.externalId).toBe('conv-1')
  })

  it('maps sender correctly: human → user, assistant → assistant', () => {
    const parser = new ClaudeExportParserImpl()
    const result = parser.parse(sample)
    const conversation = result[0]
    const messages = conversation?.messages ?? []
    expect(messages[0]?.role).toBe('user')
    expect(messages[1]?.role).toBe('assistant')
  })

  it('parses timestamps correctly', () => {
    const parser = new ClaudeExportParserImpl()
    const result = parser.parse(sample)
    expect(result[0]?.createdAt).toBeGreaterThan(0)
    const messages = result[0]?.messages ?? []
    expect(messages[0]?.createdAt).toBeGreaterThan(0)
  })
})
