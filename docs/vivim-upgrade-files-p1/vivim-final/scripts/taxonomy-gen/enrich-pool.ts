// scripts/taxonomy-gen/enrich-pool.ts
// Enrich the shared pool with new capabilities from raw.json.
// Runs Round 3 (UI mapping) and Round 4 (cross-surface binding) on new caps,
// merges with existing pool, and writes back.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  type TaxonomyNode,
  type TaxonomyEdge,
  CapabilityNodeSchema,
} from './lib/taxonomy-model.ts'
import { runUIMapping } from './lib/ui-slot-mapper.ts'
import { runCrossSurfaceBinding } from './lib/cross-surface-binder.ts'

const OUTPUT_DIR = join(import.meta.dir, 'output')
const SHARED_RAW = join(import.meta.dir, '..', '..', 'seeds', 'taxonomy', 'shared', 'raw.json')
const POOL_PATH = join(OUTPUT_DIR, 'shared', 'pool.json')

interface RawCapability {
  slug: string
  label: string
  description: string
  capabilityKind: string
  tags: string[]
}

async function main() {
  // Load existing pool
  const poolDoc = existsSync(POOL_PATH)
    ? JSON.parse(readFileSync(POOL_PATH, 'utf-8')) as { nodes: TaxonomyNode[]; edges: TaxonomyEdge[] }
    : { nodes: [] as TaxonomyNode[], edges: [] as TaxonomyEdge[] }

  const existingCaps = poolDoc.nodes.filter((n) => n.kind === 'capability')
  const existingSlugs = new Set(existingCaps.map((c) => c.slug))
  console.log(`Existing pool capabilities: ${existingCaps.length}`)

  // Load new capabilities from raw.json
  const raw = JSON.parse(readFileSync(SHARED_RAW, 'utf-8')) as { capabilities?: RawCapability[] }
  const rawCaps = raw.capabilities ?? []
  console.log(`Raw capabilities: ${rawCaps.length}`)

  // Create new capability nodes
  const newCaps: TaxonomyNode[] = []
  for (const c of rawCaps) {
    if (existingSlugs.has(c.slug)) continue
    const node = CapabilityNodeSchema.parse({
      id: `cap-${randomUUID().slice(0, 8)}`,
      kind: 'capability',
      shared: true,
      slug: c.slug,
      label: c.label,
      description: c.description,
      capabilityKind: c.capabilityKind ?? 'action',
      tags: c.tags ?? [],
      sourceConfidence: 'medium',
    })
    newCaps.push(node)
  }
  console.log(`New capabilities to add: ${newCaps.length}`)

  // Run Round 3 (UI mapping) on new caps
  const uiMapped = runUIMapping(newCaps)
  console.log(`Round 3 (UI mapping): ${uiMapped} capabilities mapped`)

  // Run Round 4 (cross-surface binding) on new caps
  const bound = runCrossSurfaceBinding(newCaps)
  console.log(`Round 4 (cross-surface): ${bound} capabilities bound`)

  // Merge all nodes (existing + new)
  const allNodes = [...poolDoc.nodes, ...newCaps]
  const doc = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    nodes: allNodes,
    edges: poolDoc.edges,
  }

  // Write back
  writeFileSync(POOL_PATH, JSON.stringify(doc, null, 2))
  console.log(`✅ Pool updated: ${allNodes.length} total nodes (${existingCaps.length} existing + ${newCaps.length} new)`)
  console.log(`   → ${POOL_PATH}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
