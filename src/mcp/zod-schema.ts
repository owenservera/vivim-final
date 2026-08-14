// src/mcp/zod-schema.ts
// Convert a zod schema to a JSON Schema (for MCP tool inputSchema).
// Handles only the shapes used by the browser-automation capability defs:
// object / string / number / boolean / array / enum / record, plus
// optional / default wrappers. Anything else throws loudly (surfaced in
// tests) rather than silently producing a wrong schema.

import type { ZodType } from 'zod'
import { EngineError } from '../errors.js'

export function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  return convert(schema) as Record<string, unknown>
}

function convert(schema: ZodType): unknown {
  const def = schema._def
  const typeName = (def as unknown as { typeName: string }).typeName

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' }
    case 'ZodNumber':
      return { type: 'number' }
    case 'ZodBoolean':
      return { type: 'boolean' }
    case 'ZodUnknown':
    case 'ZodAny':
      return {}
    case 'ZodLiteral': {
      const v = (def as unknown as { value: unknown }).value
      return { type: typeof v, const: v }
    }
    case 'ZodEnum':
      return { type: 'string', enum: (def as unknown as { values: string[] }).values }
    case 'ZodArray': {
      const items = (def as unknown as { type: ZodType }).type
      return { type: 'array', items: convert(items) }
    }
    case 'ZodRecord': {
      const valueType = (def as unknown as { valueType: ZodType }).valueType
      return { type: 'object', additionalProperties: convert(valueType) }
    }
    case 'ZodObject': {
      const shape = (def as unknown as { shape: () => Record<string, ZodType> }).shape()
      const properties: Record<string, unknown> = {}
      const required: string[] = []
      for (const [key, field] of Object.entries(shape)) {
        const converted = convertField(field)
        properties[key] = converted.schema
        if (!converted.optional) required.push(key)
      }
      return { type: 'object', properties, required }
    }
    case 'ZodOptional': {
      const inner = (def as unknown as { innerType: ZodType }).innerType
      const converted = convertField(inner)
      // Bubble up "optional": a defaulted field is also not required.
      return { schema: converted.schema, optional: true }
    }
    case 'ZodDefault': {
      const inner = (def as unknown as { innerType: ZodType }).innerType
      const defaultValue = (def as unknown as { defaultValue: () => unknown }).defaultValue
      const converted = convertField(inner)
      const schema = {
        ...(converted.schema as Record<string, unknown>),
        default: typeof defaultValue === 'function' ? defaultValue() : defaultValue,
      }
      return { schema, optional: true }
    }
    case 'ZodEffects':
      // e.g. z.string().url() is a ZodString with effects at the inner level;
      // but a bare ZodEffects (e.g. z.string().refine(...)) unwraps to its inner.
      return convertField((def as unknown as { innerType: ZodType }).innerType).schema
    default:
      throw new EngineError(`zodToJsonSchema: unsupported zod type "${typeName}"`)
  }
}

function convertField(schema: ZodType): { schema: unknown; optional?: boolean } {
  const result = convert(schema)
  if (result && typeof result === 'object' && 'optional' in (result as Record<string, unknown>)) {
    return result as { schema: unknown; optional?: boolean }
  }
  return { schema: result }
}
