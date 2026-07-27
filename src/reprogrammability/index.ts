// src/reprogrammability/index.ts
// Phase 1 of ROADMAP-REPROGRAMMABLE-CANVAS.md
//
// Barrel export for the reprogrammability substrate.
//
// CONTRACT_VERSION: 1

export {
  CONTRACT_VERSION,
  UnsupportedMutationError,
  InvalidMutationPayloadError,
} from './contract.js'
export type {
  ReprogrammableSurface,
  SurfaceKind,
  MutationProvenance,
  MutationOp,
} from './contract.js'

export {
  SurfaceSpecSchema,
  CardSpecSchema,
  PanelSpecSchema,
  LayerSpecSchema,
  PrimitiveSpecSchema,
  ChromeSpecSchema,
  SlotSpecSchema,
  CustomSpecSchema,
  defaultSpecSchemaForKind,
} from './schema/spec.js'
export type {
  SurfaceSpec,
  CardSpec,
  PanelSpec,
  LayerSpec,
  PrimitiveSpec,
  ChromeSpec,
  SlotSpec,
  CustomSpec,
} from './schema/spec.js'

export {
  SurfaceMutationSchema,
  SurfaceMutationPlanSchema,
  MUTATION_OPS,
  PROVENANCE_TAGS,
  ProvenanceEnumSchema,
  MutationTargetSchema,
  ReplaceMutationSchema,
  InsertMutationSchema,
  RemoveMutationSchema,
  ReorderMutationSchema,
  RestyleMutationSchema,
  RebindMutationSchema,
  SetPropertyMutationSchema,
  SetSlotMutationSchema,
} from './mutation-schema.js'
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
} from './mutation-schema.js'

export {
  SurfaceVariantSchema,
  UpsertSurfaceVariantInputSchema,
} from './variant-schema.js'
export type {
  SurfaceVariant,
  UpsertSurfaceVariantInput,
} from './variant-schema.js'

export {
  SurfaceRegistry,
  surfaceRegistry,
  SurfaceNotFoundError,
  DuplicateSurfaceError,
} from './registry.js'
export type { SurfaceRegistryListener } from './registry.js'
