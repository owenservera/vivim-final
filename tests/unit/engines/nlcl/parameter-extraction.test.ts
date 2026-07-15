// tests/unit/engines/nlcl/parameter-extraction.test.ts
// Unit tests for Phase 25.5 parameter extraction

import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import {
  extractParameters,
  validateInput,
} from '../../../../src/engines/nlcl/parameter-extraction.js'

describe('extractParameters', () => {
  test('extracts providerId from NL tokens', () => {
    const schema = z.object({ providerId: z.string().optional() })
    const ctx = { surface: 'cli' as const, metadata: {} }
    const result = extractParameters('switch to claude', schema, ctx)
    expect(result.input.providerId).toBe('claude')
    expect(result.missing).toEqual([])
  })

  test('detects missing required properties', () => {
    const schema = z.object({ providerId: z.string() })
    const ctx = { surface: 'cli' as const, metadata: {} }
    const result = extractParameters('do something', schema, ctx)
    expect(result.missing).toContain('providerId')
  })

  test('extracts quoted strings for string properties', () => {
    const schema = z.object({ query: z.string() })
    const ctx = { surface: 'cli' as const, metadata: {} }
    const result = extractParameters('search for "quantum computing"', schema, ctx)
    expect((result.input as Record<string, unknown>).query).toBe('quantum computing')
  })

  test('extracts numbers for limit property', () => {
    const schema = z.object({ limit: z.number().optional() })
    const ctx = { surface: 'cli' as const, metadata: {} }
    const result = extractParameters('show me 7 items', schema, ctx)
    expect((result.input as Record<string, unknown>).limit).toBe(7)
  })

  test('uses context values for missing optional props', () => {
    const schema = z.object({
      providerId: z.string().optional(),
      conversationId: z.string().optional(),
    })
    const ctx = {
      surface: 'cli' as const,
      providerId: 'gemini',
      conversationId: 'conv_123',
      metadata: {},
    }
    const result = extractParameters('do something', schema, ctx)
    expect(result.input.providerId).toBe('gemini')
    expect(result.input.conversationId).toBe('conv_123')
  })
})

describe('validateInput', () => {
  test('passes valid input against schema', () => {
    const schema = z.object({ name: z.string(), count: z.number() })
    const input = { name: 'test', count: 5 }
    const result = validateInput(input, schema)
    expect(result.ok).toBe(true)
  })

  test('fails on invalid input type', () => {
    const schema = z.object({ count: z.number() })
    const input = { count: 'not a number' }
    const result = validateInput(input, schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  test('reports missing required fields', () => {
    const schema = z.object({ required: z.string() })
    const input = {}
    const result = validateInput(input, schema)
    expect(result.ok).toBe(false)
  })
})
