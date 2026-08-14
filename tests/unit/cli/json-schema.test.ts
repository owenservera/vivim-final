// tests/unit/cli/json-schema.test.ts
// Unit 24.8 — JSON Schema ⇄ Zod / argv helpers (promoted from the deleted
// cli/commands/registry-bridge.ts).
import { describe, expect, it } from 'bun:test'
import { argvToInput, type JsonSchema, jsonSchemaToZod } from '../../../src/cli/json-schema.js'

describe('jsonSchemaToZod', () => {
  it('builds an object schema with required coercion', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: { providerId: { type: 'string' }, limit: { type: 'number' } },
      required: ['providerId'],
    })
    const parsed = schema.parse({ providerId: 'claude' })
    expect(parsed).toEqual({ providerId: 'claude' })
  })
})

describe('argvToInput', () => {
  const inputSchema: JsonSchema = {
    type: 'object',
    properties: {
      providerId: { type: 'string' },
      url: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['providerId', 'url'],
  }

  it('maps positional args to required props in order', () => {
    const out = argvToInput(inputSchema, ['claude', 'https://claude.ai'], {})
    expect(out).toEqual({ providerId: 'claude', url: 'https://claude.ai' })
  })

  it('maps --flags by name and coerces numbers', () => {
    const out = argvToInput(inputSchema, ['claude'], { url: 'https://claude.ai', limit: '10' })
    expect(out).toEqual({ providerId: 'claude', url: 'https://claude.ai', limit: 10 })
  })

  it('supports --flag=val syntax', () => {
    const out = argvToInput(inputSchema, [], { providerId: 'claude', url: 'https://x.ai' })
    expect(out).toEqual({ providerId: 'claude', url: 'https://x.ai' })
  })
})
