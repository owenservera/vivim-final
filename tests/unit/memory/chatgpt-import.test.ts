import { describe, expect, it } from 'bun:test'
import { parseChatGPT } from '../../../seeds/adapters/chatgpt.js'
import { parseClaude } from '../../../seeds/adapters/claude.js'
import { parseGemini } from '../../../seeds/adapters/gemini.js'

describe('ChatGPT import adapter', () => {
  const chatgptExport = [
    {
      id: 'conv-123',
      title: 'Learning TypeScript',
      create_time: 1700000000,
      mapping: {
        'node-1': {
          id: 'node-1',
          parent: null,
          children: ['node-2'],
          message: {
            id: 'msg-1',
            author: { role: 'user' },
            content: {
              content_type: 'text',
              parts: ['What is TypeScript?'],
            },
            create_time: 1700000001,
          },
        },
        'node-2': {
          id: 'node-2',
          parent: 'node-1',
          children: ['node-3'],
          message: {
            id: 'msg-2',
            author: { role: 'assistant' },
            content: {
              content_type: 'text',
              parts: ['TypeScript is a typed superset of JavaScript.'],
            },
            create_time: 1700000002,
          },
        },
        'node-3': {
          id: 'node-3',
          parent: 'node-2',
          children: [],
          message: {
            id: 'msg-3',
            author: { role: 'user' },
            content: {
              content_type: 'text',
              parts: [
                { content_type: 'code', text: 'const x: number = 1', language: 'typescript' },
              ],
            },
            create_time: 1700000003,
          },
        },
      },
      current_node: 'node-3',
    },
  ]

  it('parses ChatGPT export with correct conversation metadata', () => {
    const result = parseChatGPT(chatgptExport)
    expect(result).toHaveLength(1)
    expect(result[0]?.externalId).toBe('conv-123')
    expect(result[0]?.title).toBe('Learning TypeScript')
    expect(result[0]?.createdAt).toBe(1700000000)
  })

  it('walks the mapping tree in chronological order', () => {
    const result = parseChatGPT(chatgptExport)
    const messages = result[0]?.messages
    expect(messages).toHaveLength(3)
    expect(messages![0]?.role).toBe('user')
    expect(messages![0]?.content).toContain('What is TypeScript?')
    expect(messages![1]?.role).toBe('assistant')
    expect(messages![1]?.content).toContain('typed superset')
    expect(messages![2]?.role).toBe('user')
  })

  it('extracts code parts correctly', () => {
    const result = parseChatGPT(chatgptExport)
    const parts = result[0]?.messages[2]?.parts
    expect(parts).toBeDefined()
    expect(parts).toHaveLength(1)
    expect(parts?.[0]?.kind).toBe('code')
    expect(parts?.[0]?.language).toBe('typescript')
  })
})

describe('Claude import adapter', () => {
  it('parses Claude root-wrapped export', () => {
    const data = {
      conversations: [
        {
          uuid: 'abc-123',
          name: 'Claude Chat',
          chat_messages: [
            { sender: 'human', text: 'Hello Claude', uuid: 'm1' },
            { sender: 'assistant', text: 'Hello! How can I help?', uuid: 'm2' },
          ],
        },
      ],
    }
    const result = parseClaude(data)
    expect(result).toHaveLength(1)
    expect(result[0]?.externalId).toBe('abc-123')
    expect(result[0]?.title).toBe('Claude Chat')
    expect(result[0]?.messages).toHaveLength(2)
    expect(result[0]?.messages[0]?.role).toBe('user')
    expect(result[0]?.messages[1]?.role).toBe('assistant')
  })

  it('parses Claude array export', () => {
    const data = [
      {
        uuid: 'def-456',
        name: 'Array Chat',
        chat_messages: [
          { sender: 'human', text: 'Hi', uuid: 'm1' },
          { sender: 'assistant', text: 'Hello!', uuid: 'm2' },
        ],
      },
    ]
    const result = parseClaude(data)
    expect(result).toHaveLength(1)
    expect(result[0]?.externalId).toBe('def-456')
    expect(result[0]?.messages).toHaveLength(2)
  })
})

describe('Gemini import adapter', () => {
  it('parses Gemini Takeout export', () => {
    const data = [
      {
        conversationId: 'gem-789',
        title: 'Gemini Chat',
        messages: [
          { author: 'user', content: 'Tell me about AI' },
          { author: 'model', content: 'AI stands for Artificial Intelligence.' },
        ],
      },
    ]
    const result = parseGemini(data)
    expect(result).toHaveLength(1)
    expect(result[0]?.externalId).toBe('gem-789')
    expect(result[0]?.title).toBe('Gemini Chat')
    expect(result[0]?.messages).toHaveLength(2)
    expect(result[0]?.messages[0]?.role).toBe('user')
    expect(result[0]?.messages[1]?.role).toBe('assistant')
  })

  it('handles empty exports', () => {
    const result = parseGemini([])
    expect(result).toEqual([])
  })

  it('handles non-array input gracefully', () => {
    const result = parseGemini({ not: 'an array' })
    expect(result).toEqual([])
  })
})
