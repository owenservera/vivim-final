// src/engines/nlcl/parameter-extraction.ts
// ParameterExtraction — extracts and validates parameters from NL input against Zod schema.

import type { ZodSchema } from 'zod'
import { z } from 'zod'
import type { NLCContext } from './types.js'

export interface ExtractResult {
  input: Record<string, unknown>
  missing: string[]
  ambiguous: string[]
}

/**
 * Extracts parameters from NL tokens + context metadata matching schema properties.
 */
export function extractParameters(
  rawInput: string,
  schema: ZodSchema,
  ctx: NLCContext,
): ExtractResult {
  const input: Record<string, unknown> = {}
  const missing: string[] = []
  const ambiguous: string[] = []

  // Get schema shape (works for Zod object schemas)
  const shape = schema instanceof z.ZodObject ? schema.shape : {}
  const schemaKeys = Object.keys(shape)

  // Heuristic extraction by type
  for (const key of schemaKeys) {
    const value = extractValueForProperty(key, rawInput, ctx)
    if (value.found !== undefined) {
      input[key] = value.found
    }
    if (value.ambiguous) {
      ambiguous.push(key)
    }
  }

  // Check for missing required properties
  for (const key of schemaKeys) {
    const zodType = shape[key] as z.ZodTypeAny | undefined
    const isOptional = zodType?.isOptional?.() ?? false
    if (!isOptional && !(key in input)) {
      // Check if context provides default
      const _ctxValue = ctx.providerId || ctx.conversationId || ctx.slaveId
      if (key === 'providerId' && ctx.providerId) continue
      if (key === 'conversationId' && ctx.conversationId) continue
      if (key === 'slaveId' && ctx.slaveId) continue
      missing.push(key)
    }
  }

  return { input, missing, ambiguous }
}

interface ValueResult {
  found?: unknown
  ambiguous?: boolean
}

/**
 * Heuristic value extraction for a schema property.
 */
function extractValueForProperty(property: string, rawInput: string, ctx: NLCContext): ValueResult {
  const _lower = rawInput.toLowerCase()

  // ProviderId extraction
  if (property === 'providerId' || property === 'provider') {
    const match = rawInput.match(/\b(chatgpt|claude|gemini|openai|anthropic)\b/i)
    if (match) return { found: match[1]?.toLowerCase() }
    if (ctx.providerId) return { found: ctx.providerId }
  }

  // ConversationId extraction
  if (property === 'conversationId' || property === 'conversation') {
    // Look for quoted strings or explicit mentions
    const quoted = rawInput.match(/['"]([^'"]+)['"]/i)
    if (quoted) return { found: quoted[1] }
    if (ctx.conversationId) return { found: ctx.conversationId }
  }

  // SlaveId extraction
  if (property === 'slaveId') {
    const match = rawInput.match(/\b[a-f0-9]{8}\b/i) // ULID short form heuristic
    if (match) return { found: match[0] }
    if (ctx.slaveId) return { found: ctx.slaveId }
  }

  // Number extraction for limit/count/quantity properties
  if (/limit|count|number|n\b/i.test(property)) {
    const numMatch = rawInput.match(/\b(\d+)\b/)
    if (numMatch?.[1]) {
      return { found: Number.parseInt(numMatch[1], 10) }
    }
  }

  // Quoted string extraction for any text property
  if (property.endsWith('text') || property.endsWith('query') || property.endsWith('name')) {
    const quoted = rawInput.match(/"([^"]+)"/i)
    if (quoted) return { found: quoted[1] }
  }

  // Boolean extraction
  if (/true|false|yes|no/i.test(rawInput)) {
    const boolMatch = rawInput.match(/\b(true|false|yes|no)\b/i)
    if (boolMatch?.[1]) {
      return { found: ['yes', 'true'].includes(boolMatch[1].toLowerCase()) }
    }
  }

  return {}
}

/**
 * Validates input against Zod schema.
 */
export function validateInput(
  input: Record<string, unknown>,
  schema: ZodSchema,
): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  const result = schema.safeParse(input)
  if (result.success) {
    return { ok: true, value: result.data }
  }
  return {
    ok: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  }
}

/**
 * Coerces extracted values to match schema types.
 */
export function coerceValues(
  input: Record<string, unknown>,
  schema: ZodSchema,
): Record<string, unknown> {
  const shape = schema instanceof z.ZodObject ? schema.shape : {}
  if (!shape) return input

  const coerced: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    const zodType = shape[key] as z.ZodTypeAny | undefined
    const typeName = zodType?._def?.typeName

    if (typeName === 'ZodNumber' && typeof value === 'string') {
      const num = Number.parseInt(value, 10)
      if (!Number.isNaN(num)) coerced[key] = num
      else coerced[key] = value
    } else if (typeName === 'ZodBoolean' && typeof value === 'string') {
      coerced[key] = ['true', 'yes', '1'].includes(value.toLowerCase())
    } else {
      coerced[key] = value
    }
  }
  return coerced
}
