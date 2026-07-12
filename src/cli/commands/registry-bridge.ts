// src/cli/commands/registry-bridge.ts
// Bridge between UnifiedCapabilityRegistry and existing CommandRegistry.
// All capabilities registered in UnifiedCapabilityRegistry automatically become CLI commands.

import { z } from 'zod'
import type { UnifiedCapabilityRegistry } from '../../engines/unified-registry.js'
import type { CommandRegistry } from '../command-registry.js'

export function syncCliFromUnified(
  registry: UnifiedCapabilityRegistry,
  cliRegistry: CommandRegistry,
): void {
  const capabilities = registry.exportForCli()
  for (const cap of capabilities) {
    // Build a Zod schema from the JSON Schema inputSchema
    const schema = jsonSchemaToZod(cap.schema)
    // Find the original capability to get its id
    const original = registry
      .list({ surface: 'cli' })
      .find((c) => (c.cliCommand?.name ?? c.slug) === cap.name)
    const capId = original?.id ?? cap.name
    cliRegistry.register({
      name: cap.name,
      description: cap.description,
      subsystem: 'backend',
      schema,
      handler: async (args) => ({
        data: await registry.execute(capId, args as Record<string, unknown>, { metadata: {} }),
      }),
      examples: [],
    })
  }
}

/** Convert a simple JSON Schema to a Zod schema (best-effort, handles common cases). */
function jsonSchemaToZod(jsonSchema: Record<string, unknown>): z.ZodSchema {
  const properties = (jsonSchema.properties as Record<string, Record<string, unknown>>) ?? {}
  const required = (jsonSchema.required as string[]) ?? []

  const shape: Record<string, z.ZodSchema> = {}
  for (const [key, prop] of Object.entries(properties)) {
    const isRequired = required.includes(key)
    let field: z.ZodSchema

    switch (prop.type) {
      case 'string':
        field = z.string()
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
