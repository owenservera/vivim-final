// scripts/taxonomy-gen/lib/merge.ts
// Merge all generated nodes/edges into ONE canonical TaxonomyDocument — the master
// schema-driven DB pool. This single document is the source of truth that the Prisma
// schema persists and that the runtime loads.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  type TaxonomyDocument,
  type TaxonomyNode,
  type TaxonomyEdge,
  TaxonomyDocumentSchema,
} from './taxonomy-model.ts'

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
  const doc: TaxonomyDocument = TaxonomyDocumentSchema.parse({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
  })

  if (!existsSync(join(SEED_TARGET, '..'))) mkdirSync(join(SEED_TARGET, '..'), { recursive: true })
  writeFileSync(SEED_TARGET, JSON.stringify(doc, null, 2))

  const byKind = countByKind(doc.nodes)
  console.log(
    `✅ Merged master taxonomy pool → ${SEED_TARGET}\n` +
      `   nodes: ${doc.nodes.length}  edges: ${doc.edges.length}\n` +
      `   ${byKind}`,
  )
  return doc
}

function countByKind(nodes: TaxonomyNode[]): string {
  const m = new Map<string, number>()
  for (const n of nodes) m.set(n.kind, (m.get(n.kind) ?? 0) + 1)
  return [...m.entries()].map(([k, v]) => `${k}=${v}`).join('  ')
}
