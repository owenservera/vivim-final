// src/reprogrammability/variant-schema.ts
// Phase 1 of ROADMAP-REPROGRAMMABLE-CANVAS.md
//
// A `SurfaceVariant` is a saved alternative spec for a surface. Users can
// switch between variants without losing any. Variants are the first-class
// "saved reprogramming" unit; they become the seed of the versioning layer
// in Phase 8.
//
// CONTRACT_VERSION: 1

import { z } from 'zod'
import { SurfaceSpecSchema } from './schema/spec.js'
import { ProvenanceEnumSchema } from './mutation-schema.js'

/**
 * A saved alternative spec for a surface.
 *
 * - One surface has many variants.
 * - Exactly one variant is "active" per surface at a time.
 * - Switching variants is itself a `replace` mutation (Phase 3) and gets
 *   logged with `provenance: 'manual'`.
 * - Variants are persisted (Phase 8 adds Prisma backing).
 */
export const SurfaceVariantSchema = z.object({
  /** Variant id (ulid). */
  id: z.string().min(1),
  /** The surface this variant belongs to. */
  surfaceId: z.string().min(1),
  /** Display name (user-editable). */
  name: z.string().min(1).max(80),
  /** Optional description. */
  description: z.string().max(280).optional(),
  /** The saved spec. */
  spec: SurfaceSpecSchema,
  /** Whether this is the currently-active variant. */
  isActive: z.boolean().default(false),
  /** Whether this variant is locked (cannot be edited or deleted). */
  isLocked: z.boolean().default(false),
  /** Provenance of the variant's creation. */
  provenance: ProvenanceEnumSchema,
  /** Creation timestamp (epoch ms). */
  createdAt: z.number().int().nonnegative(),
  /** Last update timestamp (epoch ms). */
  updatedAt: z.number().int().nonnegative(),
  /** Optional tags for search/filter. */
  tags: z.array(z.string()).default([]),
})

/**
 * A request to create or update a variant.
 */
export const UpsertSurfaceVariantInputSchema = z.object({
  surfaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  spec: SurfaceSpecSchema,
  tags: z.array(z.string()).optional(),
})

export type SurfaceVariant = z.infer<typeof SurfaceVariantSchema>
export type SurfaceVariantSchema = typeof SurfaceVariantSchema
export type UpsertSurfaceVariantInput = z.infer<
  typeof UpsertSurfaceVariantInputSchema
>
