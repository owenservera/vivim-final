// src/canvas/oracle-reader.ts
// OracleReader — global access & visibility for the vivim-home canvas (P4).
//
// The home canvas is privileged: it sees and reaches everything — every
// provider, store, engine health, open layer, project, the knowledge graph.
// Visibility is total; mutation still flows through capability contracts and
// the Governor Canon. The oracle *sees* all and *routes* all, but does
// not bypass the rules. It also emits a self-describing manifest (P9) so
// agents can navigate and mutate the canvas safely.

import type {
  CanvasDefinition,
  CanvasManifest,
  LayerInstance,
  ManifestEntry,
  OracleReadProvider,
  OracleVisibility,
  RegionSpec,
} from './types.js'
import { PRIMITIVE_KINDS } from './types.js'

export interface OracleSources {
  visibility: OracleReadProvider
  listDefinitions(): Promise<CanvasDefinition[]>
  listInstances(opts?: { status?: LayerInstance['status'] }): Promise<LayerInstance[]>
}

export class OracleReader {
  constructor(private sources: OracleSources) {}

  /** Total visibility snapshot of the whole system (P4). */
  async visibility(): Promise<OracleVisibility> {
    return this.sources.visibility.visibility()
  }

  /**
   * Build the living manifest (P9): a machine-readable description of every
   * definition's regions, the open instances, and current oracle visibility.
   * Agents ground their canvas mutations in this instead of brittle coordinates.
   */
  async buildManifest(): Promise<CanvasManifest> {
    const defs = await this.sources.listDefinitions()
    const visibility = await this.sources.visibility.visibility()
    const _instances = await this.sources.listInstances({ status: 'live' })

    const definitions: ManifestEntry[] = defs.map((def) => ({
      definitionId: def.id,
      slug: def.slug,
      category: def.category,
      regions: def.bindings.map<RegionSpec>((b) => ({
        regionId: b.regionId,
        role: b.role,
        selector: b.selector,
        boundPrimitive: b.primitive,
        boundCapability: b.capabilitySlug,
        readScope: def.category === 'system' ? 'oracle' : 'scoped',
      })),
    }))

    return {
      version: 1,
      generatedAt: Date.now(),
      definitions,
      oracle: visibility,
    }
  }

  /** Confirm a manifest region binds only to the closed primitive set (P6). */
  static regionIsWellFormed(region: RegionSpec): boolean {
    if (region.boundPrimitive) {
      return (PRIMITIVE_KINDS as readonly string[]).includes(region.boundPrimitive)
    }
    return true
  }
}
