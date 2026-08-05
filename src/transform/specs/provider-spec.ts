// src/transform/specs/provider-spec.ts
// Provider entity transformation spec.
// Maps ProviderDefinitionRow (backend, snake_case) to Provider (frontend, camelCase).
//
// Key transformations:
//   - snake_case field names → camelCase
//   - Numeric timestamps → ISO date strings
//   - 0/1 integer flags → booleans (isActive)
//   - Internal fields (fleet_config_json, capabilities_json, etc.) excluded

import type { ProviderDefinitionRow } from '../../schema/types.js'
import type { EntityTransformSpec, FieldMapping } from '../types.js'
import { intToBool, snakeToCamel, toISO } from '../types.js'

// ── Frontend domain shape (mirrored for spec typing) ───────────────────────

export interface ProviderDomain {
  id: string
  slug: string
  displayName: string
  description?: string
  category?: string
  providerType?: string
  isActive?: boolean
  protocolStatus?: string
  websiteUrl?: string
  createdAt?: string
  updatedAt?: string
}

// ── Provider spec ───────────────────────────────────────────────────────────

const providerFields: FieldMapping[] = [
  { from: 'id', to: 'id' },
  { from: 'slug', to: 'slug' },
  { from: 'display_name', to: 'displayName' },
  { from: 'description', to: 'description' },
  { from: 'category', to: 'category' },
  { from: 'provider_type', to: 'providerType' },
  { from: 'is_active', to: 'isActive', transform: (v) => intToBool(v as number) },
  { from: 'protocol_status', to: 'protocolStatus' },
  { from: 'website_url', to: 'websiteUrl' },
  { from: 'created_at', to: 'createdAt', transform: (v) => toISO(v as number) },
  { from: 'updated_at', to: 'updatedAt', transform: (v) => toISO(v as number) },
  // Deprecated: documentation_url was exposed in v1 but removed from frontend UI.
  { from: 'documentation_url', to: 'documentationUrl', deprecated: true },
  // Deprecated: auth_type was exposed for debugging.
  { from: 'auth_type', to: 'authType', deprecated: true, removedIn: 'v2' },
]

export const providerTransformSpec: EntityTransformSpec<ProviderDefinitionRow, ProviderDomain> = {
  entity: 'provider',
  fields: providerFields,
  exclude: [
    'fleet_config_json',
    'capabilities_json',
    'models_json',
    'has_multi_account',
    'profile_strategy',
  ],
}

// ── Helper: auto-generate field mappings from snake_case Row → camelCase domain ─

/**
 * Auto-generate FieldMapping[] for a row with snake_case keys, converting all
 * keys to camelCase. Useful for quick prototyping of new entity specs.
 *
 * @param rowKeys  The keys of the Row type.
 * @param exclude  Keys to skip.
 * @param overrides  Per-key overrides (custom transform, deprecation, etc.).
 */
export function autoSnakeMappings(
  rowKeys: string[],
  exclude: string[] = [],
  overrides: Record<string, Partial<FieldMapping>> = {},
): FieldMapping[] {
  return rowKeys
    .filter((key) => !exclude.includes(key))
    .map((key) => {
      const camel = snakeToCamel(key)
      const override = overrides[key]
      return {
        from: key,
        to: camel,
        ...(override ?? {}),
      }
    })
}
