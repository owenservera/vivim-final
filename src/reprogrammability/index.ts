// src/reprogrammability/index.ts
// Phase 1 of ROADMAP-REPROGRAMMABLE-CANVAS.md
//
// Barrel export for the reprogrammability substrate.
//
// CONTRACT_VERSION: 1

export type {
  MutationOp,
  MutationProvenance,
  ReprogrammableSurface,
  SurfaceKind,
} from './contract.js'
export {
  CONTRACT_VERSION,
  InvalidMutationPayloadError,
  UnsupportedMutationError,
} from './contract.js'
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
} from './mutation-schema.js'
export {
  InsertMutationSchema,
  MUTATION_OPS,
  MutationTargetSchema,
  PROVENANCE_TAGS,
  ProvenanceEnumSchema,
  RebindMutationSchema,
  RemoveMutationSchema,
  ReorderMutationSchema,
  ReplaceMutationSchema,
  RestyleMutationSchema,
  SetPropertyMutationSchema,
  SetSlotMutationSchema,
  SurfaceMutationPlanSchema,
  SurfaceMutationSchema,
} from './mutation-schema.js'
export type { SurfaceRegistryListener } from './registry.js'
export {
  DuplicateSurfaceError,
  SurfaceNotFoundError,
  SurfaceRegistry,
  surfaceRegistry,
} from './registry.js'
export type {
  CardSpec,
  ChromeSpec,
  CustomSpec,
  LayerSpec,
  PanelSpec,
  PrimitiveSpec,
  SlotSpec,
  SurfaceSpec,
} from './schema/spec.js'
export {
  CardSpecSchema,
  ChromeSpecSchema,
  CustomSpecSchema,
  defaultSpecSchemaForKind,
  LayerSpecSchema,
  PanelSpecSchema,
  PrimitiveSpecSchema,
  SlotSpecSchema,
  SurfaceSpecSchema,
} from './schema/spec.js'
export type {
  SurfaceVariant,
  UpsertSurfaceVariantInput,
} from './variant-schema.js'
export {
  SurfaceVariantSchema,
  UpsertSurfaceVariantInputSchema,
} from './variant-schema.js'
