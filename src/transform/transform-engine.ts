// src/transform/transform-engine.ts
// Data transformation engine — converts backend Row types to frontend domain models.
// Supports declarative field mapping, API versioning, nested transforms, and
// backward-compatible deprecated fields.

import type {
  ApiVersion,
  EntityTransformSpec,
  FieldMapping,
  TransformDirection,
  TransformResult,
} from './types.js'
import { compareVersions, nullToUndefined } from './types.js'

export class TransformEngine {
  private readonly specs = new Map<string, EntityTransformSpec<unknown, unknown>>()
  private currentVersion: ApiVersion = 'v1'

  constructor(version?: ApiVersion) {
    if (version) this.currentVersion = version
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Register a transformation spec for an entity. Overwrites any existing spec. */
  register<TRow, TModel>(spec: EntityTransformSpec<TRow, TModel>): void {
    this.specs.set(spec.entity, spec as EntityTransformSpec<unknown, unknown>)
  }

  /** Unregister a transformation spec. */
  unregister(entity: string): boolean {
    return this.specs.delete(entity)
  }

  /** Check if a spec is registered for the given entity. */
  has(entity: string): boolean {
    return this.specs.has(entity)
  }

  /** Transform a single entity from Row → domain or domain → Row. */
  transform<TRow, TModel>(
    entity: string,
    row: TRow,
    direction: TransformDirection = 'toFrontend',
    version?: ApiVersion,
  ): TransformResult<TModel> {
    const v = version ?? this.currentVersion
    const warnings: string[] = []
    const spec = this.specs.get(entity)

    if (!spec) {
      throw new Error(
        `[TransformEngine] No spec registered for entity "${entity}". ` +
          `Registered entities: ${[...this.specs.keys()].join(', ') || '(none)'}`,
      )
    }

    let data: unknown

    // If the spec has a custom transform function, use it directly.
    if (spec.transform) {
      data = spec.transform(row as never, direction, v)
    } else {
      // Apply declarative field mappings.
      const source = row as Record<string, unknown>
      const result = this.applyMappings(source, spec.fields, direction, v, warnings)

      // Handle nested transforms.
      if (spec.nested) {
        for (const [field, nestedSpec] of Object.entries(spec.nested)) {
          const nestedValue = result[field]
          if (nestedValue != null) {
            const nestedWarnings: string[] = []
            if (Array.isArray(nestedValue)) {
              result[field] = nestedValue.map((item) => {
                const nestedResult = this.applyMappings(
                  item as Record<string, unknown>,
                  nestedSpec.fields,
                  direction,
                  v,
                  nestedWarnings,
                )
                return nestedResult
              })
            } else if (typeof nestedValue === 'object') {
              result[field] = this.applyMappings(
                nestedValue as Record<string, unknown>,
                nestedSpec.fields,
                direction,
                v,
                nestedWarnings,
              )
            }
            warnings.push(...nestedWarnings)
          }
        }
      }

      // Apply exclusions.
      if (spec.exclude) {
        for (const field of spec.exclude) {
          delete result[field]
        }
      }

      // Apply defaults for missing fields.
      if (spec.defaults) {
        for (const [key, defaultValue] of Object.entries(spec.defaults)) {
          if (result[key] === undefined) {
            result[key] = defaultValue
          }
        }
      }

      // Convert remaining null values to undefined for toFrontend.
      if (direction === 'toFrontend') {
        for (const key of Object.keys(result)) {
          result[key] = nullToUndefined(result[key])
        }
      }

      data = result
    }

    return {
      data: data as TModel,
      version: v,
      transformedAt: Date.now(),
      warnings,
    }
  }

  /** Transform an array of entities. */
  transformArray<TRow, TModel>(
    entity: string,
    rows: TRow[],
    direction: TransformDirection = 'toFrontend',
    version?: ApiVersion,
  ): TransformResult<TModel[]> {
    const v = version ?? this.currentVersion
    const allWarnings: string[] = []
    const items = rows.map((row) => {
      const result = this.transform<TRow, TModel>(entity, row, direction, v)
      const rowId = (row as Record<string, unknown>).id
      const idStr = rowId != null ? String(rowId) : '?'
      allWarnings.push(...result.warnings.map((w) => `[${entity}:${idStr}] ${w}`))
      return result.data
    })

    return {
      data: items,
      version: v,
      transformedAt: Date.now(),
      warnings: allWarnings,
    }
  }

  /** Set the current API version for this engine instance. */
  setVersion(version: ApiVersion): void {
    this.currentVersion = version
  }

  /** Get the current API version. */
  getVersion(): ApiVersion {
    return this.currentVersion
  }

  /** List all registered entity names. */
  listEntities(): string[] {
    return [...this.specs.keys()]
  }

  // ── Private ────────────────────────────────────────────────────────────

  /**
   * Apply declarative field mappings to a source object.
   * For `toFrontend`: source fields come from the Row (`from`), targets are domain fields (`to`).
   * For `toBackend`: source fields come from the domain model (`to`), targets are Row fields (`from`).
   */
  private applyMappings(
    source: Record<string, unknown>,
    fields: FieldMapping[],
    direction: TransformDirection,
    version: ApiVersion,
    warnings: string[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const mapping of fields) {
      // Version gating: skip if field was introduced after the target version.
      if (mapping.since && compareVersions(version, mapping.since) < 0) {
        continue
      }
      // Version gating: skip if field was removed before or at the target version.
      if (mapping.removedIn && compareVersions(version, mapping.removedIn) >= 0) {
        continue
      }

      // Determine source and target field names based on direction.
      let sourceField: string
      let targetField: string
      if (direction === 'toFrontend') {
        sourceField = mapping.from
        targetField = mapping.to
      } else {
        sourceField = mapping.to
        targetField = mapping.from
      }

      // Skip if source field is absent.
      if (!(sourceField in source)) {
        continue
      }

      let value = source[sourceField]

      // Apply custom transform function if provided.
      if (mapping.transform) {
        value = mapping.transform(value)
      }

      // Warn on deprecated fields that are present.
      if (mapping.deprecated && value !== undefined && value !== null) {
        warnings.push(
          `Field "${targetField}" (from "${sourceField}") is deprecated and will be removed in a future version.`,
        )
      }

      result[targetField] = value
    }

    return result
  }
}
