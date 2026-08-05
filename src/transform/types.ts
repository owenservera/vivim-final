// src/transform/types.ts
// Data transformation layer types.
// Provides a declarative, version-aware contract for converting backend Row types
// (snake_case, numeric timestamps, JSON strings) into frontend domain models
// (camelCase, ISO date strings, parsed objects).

// ── Versioning ─────────────────────────────────────────────────────────────

/** API version (semver-like, e.g., 'v1', 'v2'). */
export type ApiVersion = `v${number}`

/** Transform direction — backend Row → frontend domain or vice-versa. */
export type TransformDirection = 'toFrontend' | 'toBackend'

// ── Field Mapping ───────────────────────────────────────────────────────────

/**
 * Describes how a single field maps between a Row type and a domain model.
 * When `direction` is `'toFrontend'`, `from` is the Row field and `to` is the domain field.
 * When `direction` is `'toBackend'`, the mapping is reversed.
 */
export interface FieldMapping {
  /** Source field name (in Row type for toFrontend, in domain model for toBackend). */
  from: string
  /** Target field name (in domain model for toFrontend, in Row type for toBackend). */
  to: string
  /** Optional custom transform function applied to the value. */
  transform?: (value: unknown) => unknown
  /** Whether this field is deprecated (included for backward compat, generates a warning). */
  deprecated?: boolean
  /** API version when this field was introduced. Skipped if current version < since. */
  since?: ApiVersion
  /** API version when this field was removed. Skipped if current version >= removedIn. */
  removedIn?: ApiVersion
}

// ── Entity Spec ─────────────────────────────────────────────────────────────

/**
 * Declarative specification for transforming one entity type.
 * The engine applies `fields` mappings unless `transform` is provided,
 * in which case the custom function takes precedence.
 */
export interface EntityTransformSpec<TRow, TModel> {
  /** Entity name (used as the key for spec registration). */
  entity: string
  /** Field-level mappings (applied when no custom transform is provided). */
  fields: FieldMapping[]
  /** Custom transform function — when provided, overrides field-level mappings entirely. */
  transform?: (row: TRow, direction: TransformDirection, version: ApiVersion) => TModel
  /** Nested entity transforms keyed by field name. */
  nested?: Record<string, EntityTransformSpec<unknown, unknown>>
  /** Fields to exclude from the output (applied after mapping). */
  exclude?: string[]
  /** Default values for missing fields (merged after mapping). */
  defaults?: Partial<TModel>
}

// ── Result ──────────────────────────────────────────────────────────────────

/**
 * Wraps a transformed value with metadata about the transformation.
 * The `warnings` array collects non-fatal issues (deprecated fields, missing data, etc.).
 */
export interface TransformResult<T> {
  /** The transformed domain model or Row. */
  data: T
  /** The API version that governed this transformation. */
  version: ApiVersion
  /** Epoch milliseconds when the transformation occurred. */
  transformedAt: number
  /** Non-fatal warnings collected during transformation. */
  warnings: string[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the numeric part of an ApiVersion for comparison. */
export function versionNum(v: ApiVersion): number {
  return Number(v.replace(/^v/, ''))
}

/** Compare two ApiVersions. Returns -1, 0, or 1. */
export function compareVersions(a: ApiVersion, b: ApiVersion): number {
  const na = versionNum(a)
  const nb = versionNum(b)
  return na < nb ? -1 : na > nb ? 1 : 0
}

/** Parse a JSON string safely, returning undefined on failure. */
export function safeJsonParse<T = unknown>(json: string | null | undefined): T | undefined {
  if (json == null) return undefined
  try {
    return JSON.parse(json) as T
  } catch {
    return undefined
  }
}

/** Convert a numeric epoch-milliseconds timestamp to an ISO string, or undefined if nullish. */
export function toISO(ts: number | null | undefined): string | undefined {
  if (ts == null) return undefined
  return new Date(ts).toISOString()
}

/** Convert null to undefined (common Row → domain pattern). */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined
}

/** Convert a numeric 0/1 flag to a boolean. */
export function intToBool(value: number | null | undefined): boolean | undefined {
  if (value == null) return undefined
  return value === 1
}

/** Convert a boolean to a numeric 0/1 flag. */
export function boolToInt(value: boolean | null | undefined): number | undefined {
  if (value == null) return undefined
  return value ? 1 : 0
}

/** Convert a snake_case string to camelCase. */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** Convert a camelCase string to snake_case. */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}
