// scripts/taxonomy-gen/lib/merge.ts
// Merge all generated nodes/edges into ONE canonical TaxonomyDocument — the master
// schema-driven DB pool. This single document is the source of truth that the Prisma
// schema persists and that the runtime loads.
//
// After Round 2 drill-downs, merge runs Round 3 (UI slot mapping) and
// Round 4 (cross-surface binding) on all capability nodes, producing a
// fully unified taxonomy where every capability knows its frontend slot,
// CLI command, API endpoint, MCP tool, and workflow node type.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  type TaxonomyDocument,
  type TaxonomyNode,
  type TaxonomyEdge,
  TaxonomyDocumentSchema,
} from './taxonomy-model.ts'
import { runUIMapping } from './ui-slot-mapper.ts'
import { runCrossSurfaceBinding } from './cross-surface-binder.ts'

const OUTPUT_DIR = join(import.meta.dir, '..', 'output')
const LIVE_DIR = join(OUTPUT_DIR, 'live')
const SEED_TARGET = join(import.meta.dir, '..', '..', '..', 'seeds', 'taxonomy', 'pool.taxonomy.json')

export function collectNodes(): { nodes: TaxonomyNode[]; edges: TaxonomyEdge[] } {
  const nodes: TaxonomyNode[] = []
  const edges: TaxonomyEdge[] = []

  // shared pool
  const sharedPath = join(OUTPUT_DIR, 'shared', 'pool.json')
  if (existsSync(sharedPath)) {
    const doc = JSON.parse(readFileSync(sharedPath, 'utf-8')) as { nodes?: TaxonomyNode[]; edges?: TaxonomyEdge[] }
    nodes.push(...(doc.nodes ?? []))
    edges.push(...(doc.edges ?? []))
  }

  // per-platform drill-downs (output/live/<slug>.taxonomy.json)
  if (existsSync(LIVE_DIR)) {
    for (const f of readdirSync(LIVE_DIR)) {
      if (!f.endsWith('.taxonomy.json')) continue
      const taxPath = join(LIVE_DIR, f)
      const doc = JSON.parse(readFileSync(taxPath, 'utf-8')) as TaxonomyDocument
      nodes.push(...doc.nodes)
      edges.push(...doc.edges)
    }
  }

  return { nodes, edges }
}

export function runMerge(): TaxonomyDocument {
  const { nodes, edges } = collectNodes()

  // Round 3: UI slot mapping
  const uiMapped = runUIMapping(nodes)
  console.log(`  Round 3 (UI mapping): ${uiMapped} capabilities mapped`)

  // Round 4: Cross-surface binding
  const bound = runCrossSurfaceBinding(nodes)
  console.log(`  Round 4 (cross-surface): ${bound} capabilities bound`)

  const doc: TaxonomyDocument = TaxonomyDocumentSchema.parse({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  })

  if (!existsSync(join(SEED_TARGET, '..'))) mkdirSync(join(SEED_TARGET, '..'), { recursive: true })
  writeFileSync(SEED_TARGET, JSON.stringify(doc, null, 2))

  const byKind = countByKind(doc.nodes)
  const uiCoverage = countUICoverage(doc.nodes)
  const bindingCoverage = countBindingCoverage(doc.nodes)
  console.log(
    `✅ Merged master taxonomy pool → ${SEED_TARGET}\n` +
      `   nodes: ${doc.nodes.length}  edges: ${doc.edges.length}\n` +
      `   ${byKind}\n` +
      `   UI coverage: ${uiCoverage}\n` +
      `   Binding coverage: ${bindingCoverage}`,
  )
  return doc
}

function countByKind(nodes: TaxonomyNode[]): string {
  const m = new Map<string, number>()
  for (const n of nodes) m.set(n.kind, (m.get(n.kind) ?? 0) + 1)
  return [...m.entries()].map(([k, v]) => `${k}=${v}`).join('  ')
}

function countUICoverage(nodes: TaxonomyNode[]): string {
  const caps = nodes.filter(n => n.kind === 'capability')
  if (caps.length === 0) return 'no capabilities'
  const withUI = caps.filter(n => n.kind === 'capability' && n.ui_component)
  return `${withUI.length}/${caps.length} have ui_component`
}

function countBindingCoverage(nodes: TaxonomyNode[]): string {
  const caps = nodes.filter(n => n.kind === 'capability')
  if (caps.length === 0) return 'no capabilities'
  const withBindings = caps.filter(n => n.kind === 'capability' && n.capId)
  return `${withBindings.length}/${caps.length} have cross-surface bindings`
}
