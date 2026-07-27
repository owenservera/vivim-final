// src/reprogrammability/mutation-schema.ts
// Phase 1 of ROADMAP-REPROGRAMMABLE-CANVAS.md
//
// The `SurfaceMutation` Zod schema. A mutation is a declarative description
// of a change to a surface's spec. The MutationExecutor (Phase 3) applies
// mutations transactionally with undo/redo.
//
// The 8 ops are codified in the contract (contract.ts) and locked in
// REPROGRAMMABILITY.md (Phase 10). No escape hatches; novel ops require
// a contract amendment.
//
// CONTRACT_VERSION: 1

import { z } from 'zod'
import type { MutationOp, MutationProvenance } from './contract.js'

/** Re-exported for the executor. */
export const MUTATION_OPS: readonly MutationOp[] = [
  'replace',
  'insert',
  'remove',
  'reorder',
  'restyle',
  'rebind',
  'set_property',
  'set_slot',
] as const

export const PROVENANCE_TAGS = [
  'manual',
  'nlcl',
  'prefix',
  'plugin',
  'llm-harness',
  'system',
] as const satisfies readonly MutationProvenance[]

/** Zod enum derived from the PROVENANCE_TAGS tuple (zod v3 needs a tuple). */
export const ProvenanceEnumSchema = z.enum(PROVENANCE_TAGS)

/** Target identifier — either a surface id or a `surfaceId/childId` path. */
export const MutationTargetSchema = z
  .string()
  .min(1)
  .describe(
    'Surface id, optionally with a child path: "panel:conversations" or "panel:conversations/item:abc"',
  )

/** Common fields for all mutation ops. */
const BaseMutationSchema = z.object({
  /** Target surface (and optional child path). */
  target: MutationTargetSchema,
  /** Provenance — who/what produced this mutation. Drives trust scoring. */
  provenance: ProvenanceEnumSchema,
  /**
   * Idempotency key. Re-applying a mutation with the same key is a no-op
   * within a 24h window. Required for `llm-harness` and `system` provenance.
   */
  idempotencyKey: z.string().min(1).optional(),
  /** Optional human-readable reason, shown in the History panel. */
  reason: z.string().max(280).optional(),
  /** Optional correlation id linking this mutation to a parent plan. */
  planId: z.string().optional(),
})

/** Replace the entire spec of the target surface. */
export const ReplaceMutationSchema = BaseMutationSchema.extend({
  op: z.literal('replace'),
  /** The new spec (validated against the surface's specSchema). */
  payload: z.unknown(),
})

/** Insert a child surface into a container. */
export const InsertMutationSchema = BaseMutationSchema.extend({
  op: z.literal('insert'),
  /** The child spec to insert. */
  payload: z.unknown(),
  /** Insert position; omit to append. */
  index: z.number().int().min(0).optional(),
})

/** Remove the target surface, or a child by id. */
export const RemoveMutationSchema = BaseMutationSchema.extend({
  op: z.literal('remove'),
  /** No payload — the target identifies what to remove. */
  payload: z.undefined().optional(),
})

/** Reorder children in a container. */
export const ReorderMutationSchema = BaseMutationSchema.extend({
  op: z.literal('reorder'),
  /** The new order of child ids. */
  payload: z.array(z.string()),
})

/** Apply a style patch (CSS-in-JS object) to the surface. */
export const RestyleMutationSchema = BaseMutationSchema.extend({
  op: z.literal('restyle'),
  /** Style patch; deep-merged with existing style. */
  payload: z.record(z.string(), z.unknown()),
})

/** Rebind a capability to the surface. */
export const RebindMutationSchema = BaseMutationSchema.extend({
  op: z.literal('rebind'),
  payload: z.object({
    /** The capability id to bind (or unbind if `unbind`). */
    capabilityId: z.string(),
    /** Optional slot within the surface. */
    slot: z.string().optional(),
    /** Bind or unbind. */
    action: z.enum(['bind', 'unbind']).default('bind'),
  }),
})

/** Set a single property on the spec (deep path). */
export const SetPropertyMutationSchema = BaseMutationSchema.extend({
  op: z.literal('set_property'),
  payload: z.object({
    /** Dot-notation path, e.g. "style.backgroundColor" or "title". */
    path: z.string().min(1),
    /** The new value. */
    value: z.unknown(),
  }),
})

/** Change which slot a surface is mounted in. */
export const SetSlotMutationSchema = BaseMutationSchema.extend({
  op: z.literal('set_slot'),
  payload: z.object({
    /** The new slot id. */
    slotId: z.string().min(1),
  }),
})

/** Discriminated union of all 8 mutation ops. */
export const SurfaceMutationSchema = z.discriminatedUnion('op', [
  ReplaceMutationSchema,
  InsertMutationSchema,
  RemoveMutationSchema,
  ReorderMutationSchema,
  RestyleMutationSchema,
  RebindMutationSchema,
  SetPropertyMutationSchema,
  SetSlotMutationSchema,
])

/**
 * A `SurfaceMutationPlan` is an ordered sequence of mutations applied
 * transactionally. Produced by:
 *   - The Composer (Phase 4) — single-mutation plans from NLCL.
 *   - The LLM Harness (Phase 7) — multi-mutation plans.
 *   - The Visual Builder (Phase 6) — multi-mutation plans from graph edits.
 *   - Plugins (Phase 9).
 */
export const SurfaceMutationPlanSchema = z.object({
  /** Plan id (ulid). */
  id: z.string().min(1),
  /** Ordered mutations. */
  mutations: z.array(SurfaceMutationSchema).min(1),
  /** Optional rollback plan — applied if any mutation fails. */
  rollback: z.array(SurfaceMutationSchema).optional(),
  /** Plan provenance — usually the same as the mutations, but can differ
   * if e.g. a plugin produced a plan that contains `system` mutations. */
  provenance: ProvenanceEnumSchema,
  /** Optional human-readable description. */
  description: z.string().max(280).optional(),
  /** Optional correlation id linking this plan to a parent (e.g. an LLM session). */
  parentPlanId: z.string().optional(),
})

export type SurfaceMutation = z.infer<typeof SurfaceMutationSchema>
export type SurfaceMutationPlan = z.infer<typeof SurfaceMutationPlanSchema>
export type SurfaceMutationSchema = typeof SurfaceMutationSchema
export type SurfaceMutationPlanSchema = typeof SurfaceMutationPlanSchema

/** Per-op payload type (for executor convenience). */
export type ReplaceMutation = z.infer<typeof ReplaceMutationSchema>
export type InsertMutation = z.infer<typeof InsertMutationSchema>
export type RemoveMutation = z.infer<typeof RemoveMutationSchema>
export type ReorderMutation = z.infer<typeof ReorderMutationSchema>
export type RestyleMutation = z.infer<typeof RestyleMutationSchema>
export type RebindMutation = z.infer<typeof RebindMutationSchema>
export type SetPropertyMutation = z.infer<typeof SetPropertyMutationSchema>
export type SetSlotMutation = z.infer<typeof SetSlotMutationSchema>
