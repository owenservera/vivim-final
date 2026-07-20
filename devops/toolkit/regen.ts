// devops/toolkit/regen.ts
//
// Surface regeneration engine. Reads the canonical capability pool
// (seeds/taxonomy/pool.taxonomy.json) and re-derives every surface projection
// (cli / api / sdk / ui / mcp / workflow) from the single `slug` + declarative
// metadata. This is the FRONTEND = BACKEND = SDK = CLI = API guarantee: a single
// edit to the pool regenerates all surfaces, then `parity` proves they line up.
//
// Additive: it READS the pool and WRITES a regenerated projection manifest
// (seeds/taxonomy/surface-projections.json) consumed by verify-cross-surface
// and the SDK/UI generators. It never mutates engine code.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CORE_SURFACES,
  type CapabilityNode,
  PROJECTORS,
  type SurfaceName,
} from './surface-parity.js'

const SEED_TARGET = join(process.cwd(), 'seeds', 'taxonomy', 'pool.taxonomy.json')
const OUT_TARGET = join(process.cwd(), 'seeds', 'taxonomy', 'surface-projections.json')

export interface RegenResult {
  nodeCount: number
  regeneratedSurfaces: number
  projections: Record<string, Record<SurfaceName, unknown>>
}

export function loadPool(): CapabilityNode[] {
  if (!existsSync(SEED_TARGET)) {
    throw new Error(`pool not found: ${SEED_TARGET} — run \`bun run taxonomy-gen merge\` first`)
  }
  const doc = JSON.parse(readFileSync(SEED_TARGET, 'utf-8')) as { nodes?: unknown[] }
  return (doc.nodes ?? []).filter(
    (n): n is CapabilityNode => (n as { kind?: string })?.kind === 'capability',
  )
}

/** Re-derive all surface projections for every capability node. */
export function regenerate(): RegenResult {
  const nodes = loadPool()
  const projections: Record<string, Record<SurfaceName, unknown>> = {}
  let regenerated = 0

  for (const node of nodes) {
    const allSurfaces: SurfaceName[] = [...CORE_SURFACES, 'mcp', 'workflow']
    const entry: Record<SurfaceName, unknown> = {} as Record<SurfaceName, unknown>
    for (const surface of allSurfaces) {
      const spec = PROJECTORS[surface].project(node)
      if (spec.defined) {
        entry[surface] = spec.spec
        regenerated++
      }
    }
    projections[node.slug] = entry
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'seeds/taxonomy/pool.taxonomy.json',
    invariant: 'FRONTEND = BACKEND = SDK = CLI = API (derived from single slug)',
    projections,
  }
  writeFileSync(OUT_TARGET, JSON.stringify(manifest, null, 2), 'utf-8')
  return { nodeCount: nodes.length, regeneratedSurfaces: regenerated, projections }
}
