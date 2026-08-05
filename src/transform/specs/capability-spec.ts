// src/transform/specs/capability-spec.ts
// Capability entity transformation spec.
// Maps CapabilityTaxonomyRow (backend) to Capability (frontend domain).
//
// Key transformations:
//   - Filters out internal UI/layout fields the frontend doesn't consume
//   - Parses JSON strings (inputSchema, outputSchema, searchHints)
//   - Converts 0/1 requiresUserConfirmation → boolean
//   - Excludes taxonomy internals (mutationEffectsJson, recoveryBehavior, etc.)

import type { CapabilityTaxonomyRow } from '../../storage/contracts/capability-store.js'
import type { EntityTransformSpec, FieldMapping } from '../types.js'
import { intToBool, safeJsonParse } from '../types.js'

// ── Frontend domain shape (mirrored for spec typing) ───────────────────────

export interface CapabilityDomain {
  id: string
  slug: string
  name: string
  description?: string
  surfaces?: string[]
  category?: string
  inputSchema?: unknown
  outputSchema?: unknown
  tags?: string[]
  requiresConfirmation?: boolean
}

// ── Capability spec ─────────────────────────────────────────────────────────

const capabilityFields: FieldMapping[] = [
  { from: 'id', to: 'id' },
  { from: 'slug', to: 'slug' },
  { from: 'name', to: 'name' },
  { from: 'description', to: 'description' },
  { from: 'category', to: 'category' },
  {
    from: 'inputType',
    to: 'surfaces',
    transform: (v) => {
      // inputType is a comma-separated surface list in the backend.
      const raw = v as string | null
      if (!raw) return undefined
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    },
  },
  { from: 'uiInputSchema', to: 'inputSchema', transform: (v) => safeJsonParse(v as string) },
  {
    from: 'requiresUserConfirmation',
    to: 'requiresConfirmation',
    transform: (v) => intToBool(v as number),
  },
  // v2: output schema exposure (from a new column that doesn't exist yet in v1).
  {
    from: 'outputSchema',
    to: 'outputSchema',
    transform: (v) => safeJsonParse(v as string),
    since: 'v2',
  },
  // Deprecated: tags were stored in searchHintsJson in v1.
  {
    from: 'searchHintsJson',
    to: 'tags',
    transform: (v) => {
      const parsed = safeJsonParse<Array<{ tag: string }>>(v as string)
      return parsed?.map((h) => h.tag)
    },
    deprecated: true,
  },
]

export const capabilityTransformSpec: EntityTransformSpec<CapabilityTaxonomyRow, CapabilityDomain> =
  {
    entity: 'capability',
    fields: capabilityFields,
    exclude: [
      'uiComponent',
      'uiLabel',
      'uiIcon',
      'uiPosition',
      'uiOrder',
      'uiLayerDepth',
      'parentCapabilityId',
      'uiGroup',
      'uiPriority',
      'interactionMode',
      'uiStatesJson',
      'uiVisibilityRule',
      'existentialRule',
      'mutationEffectsJson',
      'recoveryBehavior',
      'statePersistence',
      'dataFlow',
      'minPlanTier',
      'dependsOnJson',
      'concurrencySafe',
      'opClassification',
      'maxResultSize',
      'resultComponent',
      'resultLayout',
      'aliasesJson',
      'availabilityJson',
      'prefetch',
      'createdAt',
      'updatedAt',
    ],
  }
