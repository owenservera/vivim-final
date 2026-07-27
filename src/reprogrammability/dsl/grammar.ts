// src/reprogrammability/dsl/grammar.ts
// Phase 3 of ROADMAP-REPROGRAMMABLE-CANVAS.md — The Mutation DSL.
//
// Re-exports the grammar (SurfaceMutationSchema, SurfaceMutationPlanSchema)
// from mutation-schema.ts so callers have a single DSL entry point.
// Also exports the parser + executor.
//
// CONTRACT_VERSION: 1

export {
  SurfaceMutationSchema,
  SurfaceMutationPlanSchema,
  MUTATION_OPS,
  PROVENANCE_TAGS,
  ProvenanceEnumSchema,
} from '../mutation-schema.js'
export type {
  SurfaceMutation,
  SurfaceMutationPlan,
  ReplaceMutation,
  InsertMutation,
  RemoveMutation,
  ReorderMutation,
  RestyleMutation,
  RebindMutation,
  SetPropertyMutation,
  SetSlotMutation,
} from '../mutation-schema.js'

export { parseMutation, parseMutationList, parseShorthand, DslParseError } from './parser.js'

export { MutationExecutor, mutationExecutor } from './executor.js'
export type { AppliedMutationRecord, ApplyPlanResult } from './executor.js'
