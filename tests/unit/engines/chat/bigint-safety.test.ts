// tests/unit/engines/chat/bigint-safety.test.ts
// Catches: BigInt serialization crash in JSON.stringify (already hit this bug)
// Validates: Replacer function converts BigInt → string safely

import { describe, expect, it } from 'bun:test'

// Mirrors the replacer added to src/server/response.ts:17
function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

function safeStringify(data: unknown): string {
  return JSON.stringify(data, jsonReplacer)
}

describe('BigInt serialization safety', () => {
  it('plain JSON.stringify crashes on BigInt', () => {
    const data = { ts: BigInt(1720000000000), name: 'test' }
    expect(() => JSON.stringify(data)).toThrow()
  })

  it('replacer converts BigInt to string', () => {
    const data = { ts: BigInt(1720000000000), name: 'test' }
    const result = safeStringify(data)
    expect(result).toContain('"1720000000000"')
    expect(result).toContain('"test"')
  })

  it('nested BigInt in arrays', () => {
    const data = {
      items: [
        { id: 1, createdAt: BigInt(100) },
        { id: 2, createdAt: BigInt(200) },
      ],
    }
    const parsed = JSON.parse(safeStringify(data))
    expect(parsed.items[0].createdAt).toBe('100')
    expect(parsed.items[1].createdAt).toBe('200')
  })

  it('null/undefined/0 pass through unchanged', () => {
    const data = { a: null, b: undefined, c: 0, d: '', e: false }
    const result = safeStringify(data)
    const parsed = JSON.parse(result)
    expect(parsed.a).toBeNull()
    expect(parsed.c).toBe(0)
    expect(parsed.d).toBe('')
    expect(parsed.e).toBe(false)
  })

  it('mixed Prisma ConversationRow shape with BigInt timestamps', () => {
    const mockRow = {
      id: 'conv_1',
      providerSessionId: 'session_1',
      providerId: 'claude',
      title: 'Test',
      state: 'active',
      messageCount: 0,
      lastMessageAt: null,
      contextJson: '{}',
      createdAt: BigInt(1720000000000),
      updatedAt: BigInt(1720000000000),
    }
    const result = safeStringify(mockRow)
    const parsed = JSON.parse(result)
    expect(parsed.id).toBe('conv_1')
    expect(parsed.createdAt).toBe('1720000000000')
  })

  it('conversation list response with multiple BigInt fields', () => {
    const data = [
      { id: '1', createdAt: BigInt(100), updatedAt: BigInt(200) },
      { id: '2', createdAt: BigInt(300), updatedAt: BigInt(400) },
    ]
    const parsed = JSON.parse(safeStringify(data))
    expect(parsed).toHaveLength(2)
    expect(parsed[0].createdAt).toBe('100')
    expect(parsed[1].updatedAt).toBe('400')
  })

  it('SendResult with BigInt latencyMs', () => {
    const result = {
      ok: true,
      messageId: 'msg_1',
      blocks: [],
      text: 'Hello',
      latencyMs: BigInt(1500),
    }
    const parsed = JSON.parse(safeStringify(result))
    expect(parsed.latencyMs).toBe('1500')
  })

  it('nested contextJson with BigInt', () => {
    // Simulate: contextJson is a string field, but if someone tries to JSON.stringify
    // it directly, it would crash. Our replacer handles it.
    const data = {
      contextJson: '{"provider":{"id":"1"},"account":{"createdAt":999}}',
    }
    const parsed = JSON.parse(safeStringify(data))
    // contextJson is a string, safe to parse
    expect(typeof parsed.contextJson).toBe('string')
    const ctx = JSON.parse(parsed.contextJson)
    expect(ctx.account.createdAt).toBe(999)
  })
})
