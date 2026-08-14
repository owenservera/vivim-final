// src/schema/conceptual-model.ts
// Zod schemas for the conceptual UI model — RegionRect, ComponentConstraints,
// SandboxPolicy, UiComponent input, ComponentContract, SlotCatalog entry.
// Enables strict contract enforcement at every write boundary.
// See docs/vivim-canvas/implementation/10-conceptual-matrix.md §3.

import { z } from 'zod'

// ── Layout ──────────────────────────────────────────────────────────────────

export const RegionRectSchema = z.object({
  x: z.number({ error: 'Invalid number' }),
  y: z.number({ error: 'Invalid number' }),
  z: z.number({ error: 'Invalid number' }).default(0),
  w: z.number({ error: 'Invalid number' }).min(1).max(10000),
  h: z.number({ error: 'Invalid number' }).min(1).max(10000),
})

// ── Constraints ──────────────────────────────────────────────────────────────

export const ComponentConstraintsSchema = z.object({
  minWidth: z.number({ error: 'Invalid number' }).min(1).optional(),
  minHeight: z.number({ error: 'Invalid number' }).min(1).optional(),
  maxWidth: z.number({ error: 'Invalid number' }).max(10000).optional(),
  maxHeight: z.number({ error: 'Invalid number' }).max(10000).optional(),
  aspectRatio: z.number({ error: 'Invalid number' }).positive().optional(),
  resizable: z.boolean({ error: 'Invalid boolean' }).default(true),
  resizeAxes: z.enum(['both', 'x', 'y', 'none']).default('both'),
})

// ── Sandbox ─────────────────────────────────────────────────────────────────

export const SandboxPolicySchema = z.object({
  csp: z
    .string({ error: 'Invalid string' })
    .default(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none';",
    ),
  allowNetwork: z.boolean({ error: 'Invalid boolean' }).default(false),
  allowCapabilities: z.array(z.string({ error: 'Invalid string' })).default([]),
  budgetMs: z.number({ error: 'Invalid number' }).min(100).max(60000).default(5000),
  allowInlineScript: z.literal(true),
})

// ── Scope ───────────────────────────────────────────────────────────────────

export const PrimitiveScopeSchema = z.enum(['cross-type', 'family', 'provider'])

// ── Component contract (input/output) ────────────────────────────────────────

export const ComponentContractSchema = z.object({
  inputs: z
    .record(
      z.string(),
      z.object({
        type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
        required: z.boolean({ error: 'Invalid boolean' }).default(false),
        description: z.string({ error: 'Invalid string' }).optional(),
        default: z.unknown().optional(),
      }),
    )
    .default({}),
  outputs: z
    .array(
      z.object({
        event: z.string({ error: 'Invalid string' }),
        payload: z.record(z.string(), z.string({ error: 'Invalid string' })).optional(),
        description: z.string({ error: 'Invalid string' }).optional(),
      }),
    )
    .default([]),
  subscriptions: z.array(z.string({ error: 'Invalid string' })).default([]),
})

// ── Component archetype ─────────────────────────────────────────────────────

export const ComponentArchetypeSchema = z.enum([
  'list',
  'form',
  'display',
  'overlay',
  'card',
  'grid',
])

// ── UiComponent input ────────────────────────────────────────────────────────

export const UiComponentInputSchema = z.object({
  primitiveId: z.string({ error: 'Invalid string' }).min(1),
  scope: PrimitiveScopeSchema,
  ownerId: z.string({ error: 'Invalid string' }).min(1),
  variant: z.string({ error: 'Invalid string' }).nullable().optional(),
  componentKey: z
    .string({ error: 'Invalid string' })
    .min(1)
    .regex(/^[a-z0-9._-]+$/i, 'componentKey must be dot-separated identifier'),
  displayName: z.string({ error: 'Invalid string' }).min(1).max(200),
  html: z.string({ error: 'Invalid string' }).default(''),
  css: z.string({ error: 'Invalid string' }).default(''),
  scriptUrl: z.string({ error: 'Invalid string' }).nullable().optional(),
  sandbox: SandboxPolicySchema.optional(),
  constraints: ComponentConstraintsSchema.optional(),
  defaultRegion: RegionRectSchema.nullable().optional(),
  contract: ComponentContractSchema.optional(),
  archetype: ComponentArchetypeSchema.optional(),
  tags: z.array(z.string({ error: 'Invalid string' })).default([]),
  status: z.enum(['draft', 'published', 'deprecated']).default('published'),
  author: z.enum(['system', 'user', 'agent']).default('system'),
  version: z.number({ error: 'Invalid number' }).int().positive().default(1),
})

// ── Layout update input ──────────────────────────────────────────────────────

export const LayoutUpdateSchema = z.object({
  x: z.number({ error: 'Invalid number' }).optional(),
  y: z.number({ error: 'Invalid number' }).optional(),
  z: z.number({ error: 'Invalid number' }).optional(),
  w: z.number({ error: 'Invalid number' }).min(1).max(10000).optional(),
  h: z.number({ error: 'Invalid number' }).min(1).max(10000).optional(),
})

// ── Slot catalog entry ──────────────────────────────────────────────────────

export const SlotCatalogEntrySchema = z.object({
  primitiveId: z.string({ error: 'Invalid string' }).min(1),
  required: z.boolean({ error: 'Invalid boolean' }).default(false),
  minInstances: z.number({ error: 'Invalid number' }).int().min(1).default(1),
  maxInstances: z.number({ error: 'Invalid number' }).int().min(1).default(3),
  accepts: z.array(z.string({ error: 'Invalid string' })).default(['text/html']),
  contract: ComponentContractSchema.optional(),
})

export const SlotCatalogSchema = z.array(SlotCatalogEntrySchema)

// ── View preset ──────────────────────────────────────────────────────────────

export const ViewPresetLayoutEntrySchema = z.object({
  componentKey: z.string({ error: 'Invalid string' }).min(1),
  region: RegionRectSchema,
})

export const ViewPresetSchema = z.object({
  name: z.string({ error: 'Invalid string' }).min(1).max(200),
  description: z.string({ error: 'Invalid string' }).optional(),
  layout: z.array(ViewPresetLayoutEntrySchema),
  workspaceId: z.string({ error: 'Invalid string' }).optional(),
  isPublic: z.boolean({ error: 'Invalid boolean' }).default(false),
  createdBy: z.string({ error: 'Invalid string' }).default('system'),
})

// ── User component layout ────────────────────────────────────────────────────

export const UserComponentLayoutSchema = z.object({
  componentKey: z.string({ error: 'Invalid string' }).min(1),
  instanceId: z.string({ error: 'Invalid string' }).min(1),
  workspaceId: z.string({ error: 'Invalid string' }).optional(),
  x: z.number({ error: 'Invalid number' }),
  y: z.number({ error: 'Invalid number' }),
  z: z.number({ error: 'Invalid number' }).default(0),
  w: z.number({ error: 'Invalid number' }).min(1).max(10000),
  h: z.number({ error: 'Invalid number' }).min(1).max(10000),
  minimized: z.boolean({ error: 'Invalid boolean' }).default(false),
  userId: z.string({ error: 'Invalid string' }).default('default'),
})

// ── Interaction grammar ────────────────────────────────────────────────────

export const GestureCatalogSchema = z.object({
  send: z.enum(['click', 'enter', 'both']).optional(),
  navigate: z.enum(['click', 'tap']).optional(),
  contextMenu: z.enum(['right-click', 'long-press']).optional(),
  drag: z.array(z.string()).optional(),
})

export const LayoutRulesSchema = z.record(
  z.string(),
  z.object({
    affinity: z.enum(['top', 'bottom', 'left', 'right', 'overlay']).optional(),
    anchorTo: z.string().optional(),
  }),
)

export const InteractionGrammarSchema = z.object({
  basePrimitive: z.string().optional(),
  gesture: GestureCatalogSchema.optional(),
  layoutRules: LayoutRulesSchema.optional(),
  scrollModel: z.enum(['infinite', 'paginated', 'fixed']).default('infinite'),
})
