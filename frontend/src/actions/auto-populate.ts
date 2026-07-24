// web/ui/src/actions/auto-populate.ts
// Unit 24.9 — auto-populate the frontend ActionRegistry from the unified
// capability registry so the frontend action set is always in sync with the
// server. Replaces the hand-written catalog.ts. Every capability with the
// `ui` surface becomes a registered action that POSTs to the universal
// execute route — the same transport the CLI and /api/interpret use.
//
// PRINCIPLE: FRONTEND = BACKEND
// Uses the shared api/client.ts which sets X-Source: frontend on every request.

import { z } from 'zod'
import { ActionRegistry } from './registry'
import { capabilityApi } from '../api/client'

interface UiCapability {
  id: string
  slug: string
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, { type: string }>
    required?: string[]
  }
}

/** Self-contained JSON Schema → Zod (mirrors src/cli/json-schema.ts). */
function jsonSchemaToZod(schema: UiCapability['inputSchema']): z.ZodSchema {
  const properties = schema.properties ?? {}
  const required = schema.required ?? []
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

export async function autoPopulateActions(_apiBase = '/api'): Promise<void> {
  const caps = await capabilityApi.listBySurface('ui')
  for (const cap of caps) {
    // Idempotent: re-registration upserts (registry.register relaxes dupes).
    ActionRegistry.register(cap.slug, {
      description: cap.name,
      params: z.object({}),
      run: async (params) => {
        return capabilityApi.execute(cap.id, params as Record<string, unknown>)
      },
    })
  }
}
