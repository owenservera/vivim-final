import { describe, expect, it } from 'bun:test'
import { ChatGPTExportParserImpl } from '../../../../src/engines/parsers/chatgpt-import.js'

const sample = JSON.stringify([
  {
    title: 'Project Discussion',
    create_time: 1700000000.0,
    update_time: 1700000100.0,
    mapping: {
      node_0: { id: 'node_0', message: null, parent: null },
      node_1: {
        id: 'node_1',
        message: {
          id: 'msg_1',
          author: { role: 'user' },
          content: { parts: ['Hello world'] },
          create_time: 1700000001.0,
        },
        parent: 'node_0',
      },
      node_2: {
        id: 'node_2',
        message: {
          id: 'msg_2',
          author: { role: 'assistant' },
          content: { parts: ['Hi there', 'How can I help?'] },
          model: 'gpt-4',
          create_time: 1700000002.0,
        },
        parent: 'node_1',
      },
      node_3: {
        id: 'node_3',
        message: {
          id: 'msg_3',
          author: { role: 'system' },
          content: { parts: ['You are a helper'] },
          create_time: 1700000000.5,
        },
        parent: 'node_0',
      },
    },
  },
])

describe('ChatGPTExportParserImpl', () => {
  it('parses sample ChatGPT export with correct conversation count', () => {
    const parser = new ChatGPTExportParserImpl()
    const result = parser.parse(sample)
    expect(result.length).toBe(1)
    expect(result[0]!.title).toBe('Project Discussion')
    expect(result[0]!.source).toBe('chatgpt')
  })

  it('orders messages by creation time', () => {
    const parser = new ChatGPTExportParserImpl()
    const result = parser.parse(sample)
    const messages = result[0]!.messages
    expect(messages.length).toBe(3)
    expect(messages[0]!.role).toBe('system')
    expect(messages[1]!.role).toBe('user')
    expect(messages[2]!.role).toBe('assistant')
  })

  it('concatenates multi-part content', () => {
    const parser = new ChatGPTExportParserImpl()
    const result = parser.parse(sample)
    const messages = result[0]!.messages
    const assistant = messages.find(m => m.role === 'assistant')
    expect(assistant).toBeDefined()
    expect(assistant!.content).toContain('Hi there')
    expect(assistant!.content).toContain('How can I help?')
  })

  it('filters null messages out', () => {
    const parser = new ChatGPTExportParserImpl()
    const result = parser.parse(sample)
    const messages = result[0]!.messages
    for (const m of messages) {
      expect(m.externalId).toBeTruthy()
    }
  })
})
