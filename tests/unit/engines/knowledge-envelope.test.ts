// tests/unit/engines/knowledge-envelope.test.ts
// Phase 0 — Tests for the canonical knowledge envelope.

import { describe, expect, test } from 'bun:test'
import {
  normalizeKnowledge,
  KnowledgeEnvelopeSchema,
} from '../../../src/engines/knowledge-envelope.js'

describe('KnowledgeEnvelopeSchema', () => {
  test('parses a minimal envelope', () => {
    const env = KnowledgeEnvelopeSchema.parse({
      sourceType: 'conversation',
      sourceId: 'conv-1',
      content: 'Hello world',
    })
    expect(env.sourceType).toBe('conversation')
    expect(env.content).toBe('Hello world')
    expect(env.version).toBe(1)
  })

  test('rejects empty sourceType', () => {
    expect(() =>
      KnowledgeEnvelopeSchema.parse({
        sourceType: '',
        sourceId: 'x',
        content: 'y',
      }),
    ).toThrow()
  })

  test('defaults participants to empty array', () => {
    const env = KnowledgeEnvelopeSchema.parse({
      sourceType: 'file',
      sourceId: 'f-1',
      content: 'test',
    })
    expect(env.participants).toEqual([])
  })
})

describe('normalizeKnowledge', () => {
  test('trims content and computes hash', () => {
    const env = normalizeKnowledge({
      sourceType: 'conversation',
      sourceId: 'conv-1',
      content: '  Hello world  \r\n',
    })
    expect(env.content).toBe('Hello world')
    expect(env.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  test('same content produces same hash', () => {
    const a = normalizeKnowledge({
      sourceType: 'file',
      sourceId: 'f-1',
      content: 'same content',
    })
    const b = normalizeKnowledge({
      sourceType: 'file',
      sourceId: 'f-1',
      content: 'same content',
    })
    expect(a.contentHash).toBe(b.contentHash)
  })

  test('different content produces different hash', () => {
    const a = normalizeKnowledge({
      sourceType: 'file',
      sourceId: 'f-1',
      content: 'content A',
    })
    const b = normalizeKnowledge({
      sourceType: 'file',
      sourceId: 'f-1',
      content: 'content B',
    })
    expect(a.contentHash).not.toBe(b.contentHash)
  })

  test('different sourceType produces different hash', () => {
    const a = normalizeKnowledge({
      sourceType: 'conversation',
      sourceId: 'x',
      content: 'same',
    })
    const b = normalizeKnowledge({
      sourceType: 'file',
      sourceId: 'x',
      content: 'same',
    })
    expect(a.contentHash).not.toBe(b.contentHash)
  })
})
