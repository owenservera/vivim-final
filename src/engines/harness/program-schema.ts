// src/engines/harness/program-schema.ts
// Unit 22.1 - Program schema (cap-store CapabilityProgramRow, vivim-styled).
// The CapabilityProgramRow already exists in capability-store.ts with
// `configJson`. This module defines how that JSON is interpreted: a Recipe
// (recipe-types.ts) plus status metadata. We do NOT mutate the Prisma
// CapabilityBindingRow (Governor Canon over schema) — the binding<->program
// link is owned by ProgramStore (22.2/22.4).

import type { ProgramStatus } from '../../storage/contracts/program-store.js'
import type { Recipe } from './recipe-types.js'
import { ValidationError } from '../../errors.js'

/** The serialisable payload stored in CapabilityProgramRow.configJson. */
export interface ProgramConfig {
  schemaVersion: number
  recipe: Recipe
}

export const PROGRAM_STATUS = {
  DRAFT: 'draft',
  CANDIDATE: 'candidate',
  PROMOTED: 'promoted',
  FAILED: 'failed',
} as const

export type { ProgramStatus }

/** Serialise a recipe to the stored config JSON. */
export function recipeToConfig(recipe: Recipe): string {
  const cfg: ProgramConfig = { schemaVersion: 1, recipe }
  return JSON.stringify(cfg)
}

/** Parse stored config JSON back into a ProgramConfig (throws on bad shape). */
export function configToProgram(configJson: string): ProgramConfig {
  const parsed = JSON.parse(configJson) as unknown
  if (!parsed || typeof parsed !== 'object') throw new ValidationError('ProgramConfig must be an object')
  const cfg = parsed as Record<string, unknown>
  if (typeof cfg.schemaVersion !== 'number') throw new ValidationError('ProgramConfig.schemaVersion missing')
  if (!cfg.recipe || typeof cfg.recipe !== 'object') throw new ValidationError('ProgramConfig.recipe missing')
  return cfg as unknown as ProgramConfig
}
