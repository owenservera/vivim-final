// scripts/taxonomy-gen/lib/shared-pool.ts
// Round 0: generate the SHARED node pool (capabilities, protocols, webapp tech stacks,
// parsers). These are defined once and referenced by every platform (taxonomies are shared).
//
// Flow (agent mode):
//   1. `shared-pool --mode agent`          → prints the prompt
//   2. agent writes seeds/taxonomy/shared/raw.json (the LLM output)
//   3. `shared-pool --mode agent --confirm` → loads raw.json, writes pool.json, marks done

import { buildPrompt, SHARED_POOL } from './prompt-builder.ts'
import { ping, type PingMode } from './llm-ping.ts'
import { setSharedPoolDone } from './state.ts'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  type TaxonomyNode,
  type TaxonomyEdge,
  TaxonomyNodeSchema,
  TaxonomyDocumentSchema,
} from './taxonomy-model.ts'

const OUTPUT_DIR = join(import.meta.dir, '..', 'output')
const RAW_PATH = join(import.meta.dir, '..', '..', '..', 'seeds', 'taxonomy', 'shared', 'raw.json')
const POOL_PATH = join(OUTPUT_DIR, 'shared', 'pool.json')

function loadRawPool(): TaxonomyNode[] {
  if (!existsSync(RAW_PATH)) {
    throw new Error(`Shared pool raw file not found: ${RAW_PATH}\nRun \`shared-pool --mode agent\` and write the output first.`)
  }
  const parsed = JSON.parse(readFileSync(RAW_PATH, 'utf-8')) as {
    capabilities?: unknown[]
    protocols?: unknown[]
    webappTechStacks?: unknown[]
    parsers?: unknown[]
  }
  const nodes: TaxonomyNode[] = []
  const push = (arr: unknown[] | undefined, kind: string) => {
    for (const n of arr ?? []) {
      nodes.push(TaxonomyNodeSchema.parse({ id: randomUUID(), kind, shared: true, ...(n as object) }))
    }
  }
  push(parsed.capabilities, 'capability')
  push(parsed.protocols, 'protocol')
  push(parsed.webappTechStacks, 'webapp_tech_stack')
  push(parsed.parsers, 'parser')
  return nodes
}

export function indexSharedPool(): TaxonomyNode[] {
  if (!existsSync(POOL_PATH)) return []
  const doc = TaxonomyDocumentSchema.parse(JSON.parse(readFileSync(POOL_PATH, 'utf-8')))
  return doc.nodes
}

export async function runSharedPool(mode: PingMode, confirm = false): Promise<void> {
  if (mode === 'agent' && confirm) {
    const nodes = loadRawPool()
    if (!existsSync(join(POOL_PATH, '..'))) mkdirSync(join(POOL_PATH, '..'), { recursive: true })
    const doc = { nodes, edges: [] as TaxonomyEdge[] }
    writeFileSync(POOL_PATH, JSON.stringify(doc, null, 2))
    setSharedPoolDone(true)
    console.log(`✅ Shared pool loaded: ${nodes.length} nodes (capabilities/protocols/techstacks/parsers) → shared/pool.json`)
    return
  }

  const prompt = buildPrompt(SHARED_POOL, {})
  const result = await ping(prompt, { mode, outputPath: 'shared/raw.json' })

  if (mode === 'agent') {
    console.log('Agent mode: generate seeds/taxonomy/shared/raw.json from the prompt above, then re-run with --mode agent --confirm')
    return
  }

  const parsed = (result.parsed ?? {}) as {
    capabilities?: unknown[]
    protocols?: unknown[]
    webappTechStacks?: unknown[]
    parsers?: unknown[]
  }
  const nodes: TaxonomyNode[] = []
  const push = (arr: unknown[] | undefined, kind: string) => {
    for (const n of arr ?? []) {
      nodes.push(TaxonomyNodeSchema.parse({ id: randomUUID(), kind, shared: true, ...(n as object) }))
    }
  }
  push(parsed.capabilities, 'capability')
  push(parsed.protocols, 'protocol')
  push(parsed.webappTechStacks, 'webapp_tech_stack')
  push(parsed.parsers, 'parser')

  if (!existsSync(join(POOL_PATH, '..'))) mkdirSync(join(POOL_PATH, '..'), { recursive: true })
  writeFileSync(POOL_PATH, JSON.stringify({ nodes, edges: [] as TaxonomyEdge[] }, null, 2))
  setSharedPoolDone(true)
  console.log(`✅ Shared pool: ${nodes.length} nodes (capabilities/protocols/techstacks/parsers) → shared/pool.json`)
}
