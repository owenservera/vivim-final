// src/cli/json-schema.ts
// Unit 24.8 — JSON Schema → Zod (for CLI arg validation) + the inverse
// (argv → input object matching the schema). Promoted/reworked from the old
// cli/commands/registry-bridge.ts so the CLI auto-generates commands from the
// unified capability registry via HTTP introspection.

import { z } from 'zod'

interface JsonProp {
  type?: string
  enum?: string[]
}

export interface JsonSchema {
  type?: string
  properties?: Record<string, JsonProp>
  required?: string[]
}

/** Build a best-effort Zod object schema from a JSON Schema (common cases). */
export function jsonSchemaToZod(jsonSchema: JsonSchema): z.ZodSchema {
  const properties = jsonSchema.properties ?? {}
  const required = jsonSchema.required ?? []

  const shape: Record<string, z.ZodSchema> = {}
  for (const [key, prop] of Object.entries(properties)) {
    const isRequired = required.includes(key)
    let field: z.ZodSchema

    switch (prop.type) {
      case 'string':
        field = prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string()
        break
      case 'number':
        field = z.number()
        break
      case 'boolean':
        field = z.boolean()
        break
      case 'array':
        field = z.array(z.unknown())
        break
      default:
        field = z.unknown()
    }

    shape[key] = isRequired ? field : field.optional()
  }

  return z.object(shape)
}

/** Coerce a raw argv token to the JSON-schema property type. */
function coerce(prop: JsonProp | undefined, raw: string): unknown {
  switch (prop?.type) {
    case 'number':
      return Number(raw)
    case 'boolean':
      return raw === 'true' || raw === ''
    default:
      return raw
  }
}

/**
 * Inverse of jsonSchemaToZod: map positional args + `--flag val` tokens onto
 * an input object that matches `inputSchema`.
 * - Positionals fill the declared required props in order.
 * - `--flag` / `--flag=val` fills the property with the matching name.
 */
export function argvToInput(
  jsonSchema: JsonSchema,
  args: string[],
  flags: Record<string, string>,
): Record<string, unknown> {
  const properties = jsonSchema.properties ?? {}
  const required = (jsonSchema.required ?? []).filter((k) => k in properties)
  const result: Record<string, unknown> = {}

  for (let i = 0; i < args.length && i < required.length; i++) {
    const key = required[i]
    const argVal = args[i]
    if (key && argVal && key in properties) {
      result[key] = coerce(properties[key], argVal)
    }
  }

  for (const [key, raw] of Object.entries(flags)) {
    if (key in properties) {
      result[key] = coerce(properties[key], raw)
    }
  }

  return result
}
