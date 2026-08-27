import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { zodToJsonSchema } from '../../../src/mcp/zod-schema.js'

describe('zodToJsonSchema', () => {
  test('object with required and optional fields', () => {
    const schema = z.object({
      url: z.string(),
      timeoutMs: z.number().optional(),
    })
    const json = zodToJsonSchema(schema)
    expect(json.type).toBe('object')
    expect(json.properties).toEqual({
      url: { type: 'string' },
      timeoutMs: { type: 'number' },
    })
    expect(json.required).toEqual(['url'])
  })

  test('nested object', () => {
    const schema = z.object({
      region: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    })
    const json = zodToJsonSchema(schema) as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(json.properties.region).toEqual({
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' },
      },
      required: ['x', 'y', 'w', 'h'],
    })
    expect(json.required).toEqual(['region'])
  })

  test('array of strings', () => {
    const json = zodToJsonSchema(z.object({ files: z.array(z.string()) })) as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(json.properties.files).toEqual({ type: 'array', items: { type: 'string' } })
    expect(json.required).toEqual(['files'])
  })

  test('enum with default', () => {
    const schema = z.object({ which: z.enum(['local', 'session']).default('local') })
    const json = zodToJsonSchema(schema) as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(json.properties.which).toEqual({
      type: 'string',
      enum: ['local', 'session'],
      default: 'local',
    })
    // default → not required
    expect(json.required).toEqual([])
  })

  test('defaulted field is not required', () => {
    const json = zodToJsonSchema(z.object({ timeoutMs: z.number().default(5000) })) as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(json.properties.timeoutMs).toEqual({ type: 'number', default: 5000 })
    expect(json.required).toEqual([])
  })

  test('record<string, string> passthrough', () => {
    const json = zodToJsonSchema(
      z.object({
        headers: z.record(
          z.string({ error: 'Invalid string' }),
          z.string({ error: 'Invalid string' }),
        ),
      }),
    ) as { type: string; properties: Record<string, unknown>; required: string[] }
    expect(json.properties.headers).toEqual({
      type: 'object',
      additionalProperties: { type: 'string' },
    })
  })

  test('empty object has no properties', () => {
    const json = zodToJsonSchema(z.object({})) as {
      type: string
      properties: Record<string, unknown>
      required: string[]
    }
    expect(json).toEqual({ type: 'object', properties: {}, required: [] })
  })

  test('unsupported shape throws EngineError instead of silently failing', () => {
    // z.union is not used by the registry defs — it must fail loudly.
    expect(() => zodToJsonSchema(z.object({ v: z.union([z.string(), z.number()]) }))).toThrow(
      'zodToJsonSchema',
    )
  })
})
