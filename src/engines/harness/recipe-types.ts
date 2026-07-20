// src/engines/harness/recipe-types.ts
// Unit 21.3 - Recipe types (cap-store ActionProgram shape, vivim-styled).
// A Recipe is the portable, serialisable description of a capability's
// programmatic action. It is stored as CapabilityProgramRow.configJson and
// compiled to a ChromeGovernor HarnessDAG by recipe-compiler.ts.

import { EngineError } from '../../errors.js'
import type { Recipe, RecipeBranch, RecipeStep } from '../../storage/contracts/program-store.js'

export type { RecipeStep, RecipeBranch, Recipe }

export const RECIPE_META = {
  schemaVersion: 1,
} as const

/** Validate a parsed recipe against the minimum shape. Throws EngineError on bad input. */
export function assertRecipe(value: unknown): asserts value is Recipe {
  if (!value || typeof value !== 'object') throw new EngineError('Recipe must be an object')
  const r = value as Record<string, unknown>
  if (typeof r.id !== 'string') throw new EngineError('Recipe.id must be a string')
  if (typeof r.providerId !== 'string') throw new EngineError('Recipe.providerId must be a string')
  if (typeof r.capabilitySlug !== 'string')
    throw new EngineError('Recipe.capabilitySlug must be a string')
  if (!Array.isArray(r.steps)) throw new EngineError('Recipe.steps must be an array')
}
