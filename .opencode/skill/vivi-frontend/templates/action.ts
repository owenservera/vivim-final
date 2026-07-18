// templates/action.ts
// ACTION ENTRY — register a capability as a UI action in ActionRegistry
// (invariant B8: every UI action goes through ActionRegistry, Zod-validated).
// Canonical action id = capability slug (mirrors autoPopulateActions).
//
// Copy into: web/ui/src/actions/<slug>-action.ts  (or extend auto-populate.ts)

import { z } from 'zod'
import { ActionRegistry } from './registry.js'

interface UiCapability {
  id: string
  slug: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, { type: string }>
    required?: string[]
  }
}

/** Self-contained JSON Schema → Zod (mirrors src/cli/json-schema.ts + auto-populate.ts). */
export function jsonSchemaToZod(schema: UiCapability['inputSchema']): z.ZodSchema {
  const properties = schema.properties ?? {}
  const required = schema.required ?? []
  const shape: Record<string, z.ZodSchema> = {}
  for (const [key, prop] of Object.entries(properties)) {
    const isRequired = required.includes(key)
    let field: z.ZodSchema
    switch (prop.type) {
      case 'string': field = z.string(); break
      case 'number': field = z.number(); break
      case 'boolean': field = z.boolean(); break
      case 'array': field = z.array(z.unknown()); break
      default: field = z.unknown()
    }
    shape[key] = isRequired ? field : field.optional()
  }
  return z.object(shape)
}

/** Register one capability as an ActionRegistry action keyed by slug. */
export function registerCapabilityAction(cap: UiCapability, apiBase = '/api'): void {
  ActionRegistry.register(cap.slug, {
    description: cap.description,
    params: jsonSchemaToZod(cap.inputSchema),
    run: async (params) => {
      const res = await fetch(`${apiBase}/capabilities/${encodeURIComponent(cap.id)}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: params }),
      })
      if (!res.ok) throw new Error(`execute failed: ${res.status}`)
      return res.json()
    },
  })
}

/** Dispatch helper (canonical id = slug). */
export function dispatchCapability(slug: string, params: Record<string, unknown>): Promise<unknown> {
  return ActionRegistry.dispatch(slug, params)
}

// Example registration (call once at startup, e.g. from autoPopulateActions):
// registerCapabilityAction({ id, slug, description, inputSchema })
