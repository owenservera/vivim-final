// src/schema/conceptual-model.ts
// Zod schemas for the conceptual UI model — RegionRect, ComponentConstraints,
// SandboxPolicy, UiComponent input, ComponentContract, SlotCatalog entry.
// Enables strict contract enforcement at every write boundary.
// See docs/vivim-canvas/implementation/10-conceptual-matrix.md §3.

import { z } from 'zod'

// ── Layout ──────────────────────────────────────────────────────────────────

export const RegionRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().default(0),
  w: z.number().min(1).max(10000),
  h: z.number().min(1).max(10000),
})

// ── Constraints ──────────────────────────────────────────────────────────────

export const ComponentConstraintsSchema = z.object({
  minWidth: z.number().min(1).optional(),
  minHeight: z.number().min(1).optional(),
  maxWidth: z.number().max(10000).optional(),
  maxHeight: z.number().max(10000).optional(),
  aspectRatio: z.number().positive().optional(),
  resizable: z.boolean().default(true),
  resizeAxes: z.enum(['both', 'x', 'y', 'none']).default('both'),
})

// ── Sandbox ─────────────────────────────────────────────────────────────────

export const SandboxPolicySchema = z.object({
  csp: z
    .string()
    .default(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none';",
    ),
  allowNetwork: z.boolean().default(false),
  allowCapabilities: z.array(z.string()).default([]),
  budgetMs: z.number().min(100).max(60000).default(5000),
  allowInlineScript: z.literal(true),
})

// ── Scope ───────────────────────────────────────────────────────────────────

export const PrimitiveScopeSchema = z.enum(['cross-type', 'family', 'provider'])

// ── Component contract (input/output) ────────────────────────────────────────

export const ComponentContractSchema = z.object({
  inputs: z
    .record(
      z.object({
        type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
        required: z.boolean().default(false),
        description: z.string().optional(),
        default: z.unknown().optional(),
      }),
    )
    .default({}),
  outputs: z
    .array(
      z.object({
        event: z.string(),
        payload: z.record(z.string()).optional(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  subscriptions: z.array(z.string()).default([]),
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
  primitiveId: z.string().min(1),
  scope: PrimitiveScopeSchema,
  ownerId: z.string().min(1),
  variant: z.string().nullable().optional(),
  componentKey: z
    .string()
    .min(1)
    .regex(/^[a-z0-9._-]+$/i, 'componentKey must be dot-separated identifier'),
  displayName: z.string().min(1).max(200),
  html: z.string().default(''),
  css: z.string().default(''),
  scriptUrl: z.string().nullable().optional(),
  sandbox: SandboxPolicySchema.optional(),
  constraints: ComponentConstraintsSchema.optional(),
  defaultRegion: RegionRectSchema.nullable().optional(),
  contract: ComponentContractSchema.optional(),
  archetype: ComponentArchetypeSchema.optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'deprecated']).default('published'),
  author: z.enum(['system', 'user', 'agent']).default('system'),
  version: z.number().int().positive().default(1),
})

// ── Layout update input ──────────────────────────────────────────────────────

export const LayoutUpdateSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  z: z.number().optional(),
  w: z.number().min(1).max(10000).optional(),
  h: z.number().min(1).max(10000).optional(),
})

// ── Slot catalog entry ──────────────────────────────────────────────────────

export const SlotCatalogEntrySchema = z.object({
  primitiveId: z.string().min(1),
  required: z.boolean().default(false),
  minInstances: z.number().int().min(1).default(1),
  maxInstances: z.number().int().min(1).default(3),
  accepts: z.array(z.string()).default(['text/html']),
  contract: ComponentContractSchema.optional(),
})

export const SlotCatalogSchema = z.array(SlotCatalogEntrySchema)

// ── View preset ──────────────────────────────────────────────────────────────

export const ViewPresetLayoutEntrySchema = z.object({
  componentKey: z.string().min(1),
  region: RegionRectSchema,
})

export const ViewPresetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  layout: z.array(ViewPresetLayoutEntrySchema),
  workspaceId: z.string().optional(),
  isPublic: z.boolean().default(false),
  createdBy: z.string().default('system'),
})

// ── User component layout ────────────────────────────────────────────────────

export const UserComponentLayoutSchema = z.object({
  componentKey: z.string().min(1),
  instanceId: z.string().min(1),
  workspaceId: z.string().optional(),
  x: z.number(),
  y: z.number(),
  z: z.number().default(0),
  w: z.number().min(1).max(10000),
  h: z.number().min(1).max(10000),
  minimized: z.boolean().default(false),
  userId: z.string().default('default'),
})

// ── Interaction grammar ────────────────────────────────────────────────────

export const GestureCatalogSchema = z.object({
  send: z.enum(['click', 'enter', 'both']).optional(),
  navigate: z.enum(['click', 'tap']).optional(),
  contextMenu: z.enum(['right-click', 'long-press']).optional(),
  drag: z.array(z.string()).optional(),
})

export const LayoutRulesSchema = z.record(
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
