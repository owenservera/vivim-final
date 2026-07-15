// src/canvas/schema.ts
// Zod schemas + structural validators for vivim-canvas (P1/P6/P8).
//
// Validation is the gate that keeps the shell "re-programmable by design" but
// never unsafe: no inline <script>, no raw DOM escape, no capability the layer
// was not granted. Definitions are rejected closed at publish time.

import { z } from 'zod'
import { CanvasMutationError, CanvasSpawnError, SandboxPermissionError } from '../errors.js'
import type { CanvasDefinition, CanvasDefinitionInput, SandboxPolicy } from './types.js'

export const primitiveKindSchema = z.enum([
  'workspace',
  'projects',
  'knowledge',
  'agents',
  'providers',
  'conversations',
])

export const layerCategorySchema = z.enum([
  'system',
  'chat',
  'automation',
  'agents',
  'projects',
  'knowledge',
  'designer',
  'plugin',
])

export const layerAuthorSchema = z.enum(['system', 'user', 'agent'])
export const layerStatusSchema = z.enum(['draft', 'published', 'deprecated'])

export const sandboxPolicySchema = z
  .object({
    csp: z.string().min(1),
    allowNetwork: z.boolean(),
    allowCapabilities: z.array(z.string()),
    budgetMs: z.number().int().positive().max(30000),
    allowInlineScript: z.literal(false),
  })
  .strict()

export const canvasLayoutSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    z: z.number().int(),
    w: z.number().positive(),
    h: z.number().positive(),
    minimized: z.boolean().optional(),
    detailZoom: z.number().positive().optional(),
  })
  .strict()

export const layerBindingSchema = z
  .object({
    regionId: z.string().min(1),
    role: z.string().min(1),
    selector: z.string().min(1),
    primitive: primitiveKindSchema.optional(),
    capabilitySlug: z.string().min(1).optional(),
    direction: z.enum(['read', 'write', 'bidirectional']),
  })
  .strict()
  // A binding may reference a primitive, a capability, or neither (a
  // passive region the oracle fills). It must NOT reference both.
  .refine((b) => !(b.primitive && b.capabilitySlug), {
    message: 'binding must not reference both a primitive and a capability',
  })

export const canvasDefinitionSchema = z
  .object({
    id: z.string().min(1),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
    name: z.string().min(1),
    description: z.string(),
    category: layerCategorySchema,
    version: z.number().int().positive(),
    html: z.string(),
    css: z.string(),
    scriptUrl: z.string().url().optional(),
    bindings: z.array(layerBindingSchema),
    layout: canvasLayoutSchema,
    author: layerAuthorSchema,
    sandbox: sandboxPolicySchema,
    status: layerStatusSchema,
    tags: z.array(z.string()),
    createdAt: z.number().int().positive(),
    updatedAt: z.number().int().positive(),
  })
  .strict()

export const canvasDefinitionInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
    name: z.string().min(1),
    description: z.string(),
    category: layerCategorySchema,
    html: z.string(),
    css: z.string(),
    scriptUrl: z.string().url().optional(),
    bindings: z.array(layerBindingSchema),
    layout: canvasLayoutSchema,
    author: layerAuthorSchema,
    sandbox: sandboxPolicySchema,
    status: layerStatusSchema.default('draft'),
    tags: z.array(z.string()).default([]),
  })
  .strict()

// Full definition schema (includes id/version/createdAt/updatedAt). Used
// when re-validating a stored definition during update.
export const canvasDefinitionFullSchema = canvasDefinitionInputSchema
  .extend({
    id: z.string().min(1).optional(),
    version: z.number().int().positive().optional(),
    createdAt: z.number().int().positive().optional(),
    updatedAt: z.number().int().positive().optional(),
  })
  .strict()

const INLINE_SCRIPT = /<script\b/i

/** Reject inline <script> at definition time (closed; render-time re-checks). */
export function assertNoInlineScript(def: {
  html: string
  css: string
  scriptUrl?: string | null
}): void {
  if (INLINE_SCRIPT.test(def.html)) {
    throw new SandboxPermissionError('definition', 'inline <script> in html')
  }
  if (INLINE_SCRIPT.test(def.css)) {
    throw new SandboxPermissionError('definition', 'inline <script> in css')
  }
  if (def.scriptUrl?.startsWith('javascript:')) {
    throw new SandboxPermissionError('definition', 'disallowed javascript: script url')
  }
}

/**
 * Validate a candidate definition structurally. Throws typed CapStoreError
 * subclasses (never `new Error()`), so callers get classified failures.
 */
export function validateDefinition(input: unknown): CanvasDefinitionInput {
  const parsed = canvasDefinitionFullSchema.parse(input)
  assertNoInlineScript(parsed)
  return parsed as CanvasDefinitionInput
}

/**
 * Whether a layer is permitted to execute a given capability. Sandbox enforcement
 * (P8): a layer can only drive capabilities it was whitelisted for.
 */
export function canUseCapability(
  def: Pick<CanvasDefinition, 'sandbox'> | Pick<CanvasDefinition, 'sandbox'>['sandbox'],
  capabilitySlug: string,
): boolean {
  const allowed = Array.isArray(def)
    ? ((def as unknown as SandboxPolicy[])[0]?.allowCapabilities ?? [])
    : (def as Pick<CanvasDefinition, 'sandbox'>).sandbox.allowCapabilities
  return allowed.includes(capabilitySlug)
}

/**
 * Construct a default, safe sandbox policy. Network is off, no capabilities,
 * tight CSP, and `allowInlineScript` is structurally `false`.
 */
export function defaultSandbox(overrides?: Partial<SandboxPolicy>): SandboxPolicy {
  return {
    csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none';",
    allowNetwork: false,
    allowCapabilities: [],
    budgetMs: 5000,
    allowInlineScript: false,
    ...overrides,
  }
}

/** Finalize a validated input into a stored CanvasDefinition (assigns ids/version). */
export function finalizeDefinition(
  input: CanvasDefinitionInput,
  opts: { id: string; version?: number; now?: number },
): CanvasDefinition {
  const now = opts.now ?? Date.now()
  return {
    ...input,
    id: opts.id,
    version: opts.version ?? 1,
    createdAt: now,
    updatedAt: now,
  }
}

export { CanvasSpawnError, CanvasMutationError, SandboxPermissionError }
