// src/reprogrammability/dsl/grammar.ts
// Phase 3 of ROADMAP-REPROGRAMMABLE-CANVAS.md — The Mutation DSL.
//
// Re-exports the grammar (SurfaceMutationSchema, SurfaceMutationPlanSchema)
// from mutation-schema.ts so callers have a single DSL entry point.
// Also exports the parser + executor.
//
// CONTRACT_VERSION: 1

export type {
  InsertMutation,
  RebindMutation,
  RemoveMutation,
  ReorderMutation,
  ReplaceMutation,
  RestyleMutation,
  SetPropertyMutation,
  SetSlotMutation,
  SurfaceMutation,
  SurfaceMutationPlan,
} from '../mutation-schema.js'
export {
  MUTATION_OPS,
  PROVENANCE_TAGS,
  ProvenanceEnumSchema,
  SurfaceMutationPlanSchema,
  SurfaceMutationSchema,
} from '../mutation-schema.js'
export type { AppliedMutationRecord, ApplyPlanResult } from './executor.js'

export { MutationExecutor, mutationExecutor } from './executor.js'
export { DslParseError, parseMutation, parseMutationList, parseShorthand } from './parser.js'
