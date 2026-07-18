// src/schema/repair-metadata.ts
// Repair metadata carried in a SIDE-TABLE keyed by Zod type — NOT on the Zod
// prototype. Fixes the pasted design's `z.ZodType.prototype.repair` monkey-patch
// (which is unsafe: global mutation, breaks under multiple schema instances, and
// the `declare module 'zod'` only adds a type, not a runtime method).

import { z } from 'zod'

export interface RepairMetadata {
  aliases?: string[]
  coerceFrom?: z.ZodType[]
  defaultValue?: unknown
  semanticValidator?: (val: unknown) => boolean
  description?: string
}

// Module-level side-table. Immutable registration; no prototype pollution.
const REPAIR_METADATA = new Map<z.ZodType, RepairMetadata>()

export function registerRepair(schema: z.ZodType, meta: RepairMetadata): z.ZodType {
  REPAIR_METADATA.set(schema, meta)
  return schema
}

export function getRepairMetadata(schema: z.ZodType): RepairMetadata | undefined {
  return REPAIR_METADATA.get(schema)
}

// ── Repair-aware field builders ────────────────────────────────────────────
// Each returns the Zod type and registers its metadata in the side-table.

export function repairString(
  opts: {
    aliases?: string[]
    default?: string
    coerce?: boolean
  } = {},
): z.ZodString {
  const schema = z.string().min(1)
  registerRepair(schema, {
    aliases: opts.aliases,
    coerceFrom: opts.coerce ? [z.number(), z.boolean()] : [],
    defaultValue: opts.default,
  })
  return schema
}

export function repairNumber(
  opts: {
    aliases?: string[]
    default?: number
    min?: number
    max?: number
  } = {},
): z.ZodNumber {
  const schema = z.coerce
    .number()
    .min(opts.min ?? Number.NEGATIVE_INFINITY)
    .max(opts.max ?? Number.POSITIVE_INFINITY)
  registerRepair(schema, {
    aliases: opts.aliases,
    coerceFrom: [z.string()],
    defaultValue: opts.default,
  })
  return schema
}

export function repairBoolean(
  opts: {
    aliases?: string[]
    default?: boolean
  } = {},
): z.ZodDefault<z.ZodBoolean> {
  const schema = z.coerce.boolean().default(opts.default ?? true)
  registerRepair(schema, {
    aliases: opts.aliases,
    coerceFrom: [z.string(), z.number()],
    defaultValue: opts.default,
  })
  return schema
}
