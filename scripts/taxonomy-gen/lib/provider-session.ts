// scripts/taxonomy-gen/lib/provider-session.ts
// Round 2: drill down into one platform. Produces a TaxonomyDocument for the platform
// (nodes + edges), reusing the shared pool for methods/parsers.
//
// Agent-mode contract (per section):
//   1. `session <slug> --mode agent` prints the prompt for the next undone section
//   2. agent writes seeds/taxonomy/live/<slug>.<section>.json
//   3. re-run `session <slug> --mode agent` → applies it, advances to next section
// Auto mode runs all remaining sections in one pass.

import { buildPrompt, DRILLDOWN_SECTIONS, type PromptVars } from './prompt-builder.ts'
import { ping, type PingMode } from './llm-ping.ts'
import {
  loadState,
  saveState,
  getPlatformState,
  updatePlatform,
  type GenState,
  type PlatformState,
} from './state.ts'
import { indexSharedPool } from './shared-pool.ts'
import {
  type TaxonomyNode,
  type TaxonomyEdge,
  TaxonomyDocumentSchema,
  TaxonomyNodeSchema,
} from './taxonomy-model.ts'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

const OUTPUT_DIR = join(import.meta.dir, '..', 'output')
const LIVE_DIR = join(OUTPUT_DIR, 'live')

function mergedPath(slug: string): string {
  return join(LIVE_DIR, `${slug}.taxonomy.json`)
}

function loadMerged(slug: string): { nodes: TaxonomyNode[]; edges: TaxonomyEdge[] } {
  if (existsSync(mergedPath(slug))) {
    const doc = TaxonomyDocumentSchema.parse(JSON.parse(readFileSync(mergedPath(slug), 'utf-8')))
    return { nodes: [...doc.nodes], edges: [...doc.edges] }
  }
  return { nodes: [], edges: [] }
}

function saveMerged(slug: string, doc: { nodes: TaxonomyNode[]; edges: TaxonomyEdge[] }): void {
  if (!existsSync(LIVE_DIR)) mkdirSync(LIVE_DIR, { recursive: true })
  writeFileSync(mergedPath(slug), JSON.stringify(doc, null, 2))
}

function rawPathFor(slug: string, section: string): string {
  return join(LIVE_DIR, `${slug}.${section}.json`)
}

async function buildVars(slug: string, meta: PlatformState, section: string, _st: GenState): Promise<PromptVars> {
  const shared = indexSharedPool()
  const merged = loadMerged(slug)
  const techStack = section === 'webapp-tech-stack'
    ? shared.filter((n) => n.kind === 'webapp_tech_stack').map((n) => n.slug)
    : []
  const priorNodes =
    section === 'methods' || section === 'parsers'
      ? shared.map((n) => `${n.slug} (${n.kind})`)
      : merged.nodes.map((n) => `${n.slug} (${n.kind})`)
  return {
    slug,
    platformLabel: meta.slug,
    category: meta.category,
    techStack,
    protocol: '',
    priorNodes,
    vocab: '',
  }
}

function applySectionOutput(
  section: string,
  parsed: unknown,
  doc: { nodes: TaxonomyNode[]; edges: TaxonomyEdge[] },
): void {
  const obj = (parsed ?? {}) as Record<string, unknown>
  const coerce = (v: unknown, kind: string): TaxonomyNode | null => {
    if (v == null || typeof v !== 'object') return null
    return TaxonomyNodeSchema.parse({ id: randomUUID(), kind, ...(v as object) })
  }
  const mergeArray = (arr: unknown, kind: string) => {
    for (const item of (arr as unknown[]) ?? []) {
      const node = coerce(item, kind)
      if (!node) continue
      const existing = doc.nodes.find((n) => n.slug === node.slug && n.kind === node.kind)
      if (existing) Object.assign(existing, node)
      else doc.nodes.push(node)
    }
  }

  switch (section) {
    case 'provider-meta': {
      const node = coerce(obj, 'platform')
      if (node) {
        const existing = doc.nodes.find((n) => n.slug === node.slug)
        if (existing) Object.assign(existing, node)
        else doc.nodes.push(node)
      }
      break
    }
    case 'capabilities':
      mergeArray(obj.capabilities, 'capability')
      break
    case 'webapp-tech-stack':
      mergeArray(obj.techStacks, 'webapp_tech_stack')
      break
    case 'methods':
      mergeArray(obj.methods, 'method')
      break
    case 'parsers':
      mergeArray(obj.parsers, 'parser')
      break
    case 'constraints':
    case 'validate':
      // constraints/validate enrich existing nodes — fold provided fields back
      mergeArray(obj.capabilities, 'capability')
      mergeArray(obj.methods, 'method')
      mergeArray(obj.parsers, 'parser')
      mergeArray(obj.techStacks, 'webapp_tech_stack')
      break
    case 'edges':
      for (const e of (obj.edges as unknown[]) ?? []) {
        if (e && typeof e === 'object') doc.edges.push(e as TaxonomyEdge)
      }
      break
  }
}

function sectionComplete(meta: PlatformState, section: string): boolean {
  return meta.sectionsDone.includes(section)
}

export async function runSession(slug: string, mode: PingMode): Promise<void> {
  const st = await loadState()
  const meta = st.platforms.find((p) => p.slug === slug)
  if (!meta) {
    throw new Error(`Platform '${slug}' not in skeleton. Run \`skeleton\` first.`)
  }

  const idx = meta.sectionsDone.length
  const section = DRILLDOWN_SECTIONS[idx]
  if (!section) {
    updatePlatform(st, { ...meta, status: 'complete' })
    await saveState(st)
    // [audit] removed: console.log(`✅ ${slug}: all sections complete (${meta.sectionsDone.length}/${DRILLDOWN_SECTIONS.length})`)
    return
  }

  const rawPath = rawPathFor(slug, section)

  // Agent mode: if the section output file already exists, apply it and advance.
  if (mode === 'agent' && existsSync(rawPath)) {
    const parsed = JSON.parse(readFileSync(rawPath, 'utf-8'))
    const doc = loadMerged(slug)
    applySectionOutput(section, parsed, doc)
    saveMerged(slug, doc)
    const nextMeta: PlatformState = {
      ...meta,
      sectionsDone: [...meta.sectionsDone, section],
      status: idx + 1 >= DRILLDOWN_SECTIONS.length ? 'complete' : 'drilling',
    }
    updatePlatform(st, nextMeta)
    await saveState(st)
    // [audit] removed: console.log(`✓ ${slug} section '${section}' applied (${nextMeta.sectionsDone.length}/${DRILLDOWN_SECTIONS.length})`)
    return runSession(slug, mode)
  }

  const vars = await buildVars(slug, meta, section, st)
  const prompt = buildPrompt(section, vars)
  await ping(prompt, { mode, outputPath: `live/${slug}.${section}.json` })

  if (mode === 'agent') {
    // [audit] removed: console.log(`\nAgent mode: write ${rawPath}, then re-run \`session ${slug} --mode agent\``)
    return
  }

  // Auto mode: apply and continue through remaining sections.
  const result = await ping(prompt, { mode, outputPath: `live/${slug}.${section}.json` })
  const doc = loadMerged(slug)
  applySectionOutput(section, result.parsed, doc)
  saveMerged(slug, doc)
  const nextMeta: PlatformState = {
    ...meta,
    sectionsDone: [...meta.sectionsDone, section],
    status: idx + 1 >= DRILLDOWN_SECTIONS.length ? 'complete' : 'drilling',
  }
  updatePlatform(st, nextMeta)
  await saveState(st)
  // [audit] removed: console.log(`✓ ${slug} section '${section}' applied`)
  return runSession(slug, mode)
}
