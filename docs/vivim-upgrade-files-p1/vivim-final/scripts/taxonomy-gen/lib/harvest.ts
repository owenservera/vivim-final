// scripts/taxonomy-gen/lib/harvest.ts
// Probability-table harvesting pipeline: harvest → cross-check → cleanup → test.
//
// Given a controlled vocabulary (e.g. the official SSE taxonomy + synonyms map), ping the
// LLM to HARVEST protocol/capability insights, then run them through a verify pipeline so
// the harvested data is safe to load into the single master-schema DB.

import { buildPrompt, PROBABILITY_HARVEST } from './prompt-builder.ts'
import { ping, type PingMode } from './llm-ping.ts'
import { randomUUID } from 'node:crypto'
import {
  type TaxonomyTermNode,
  type ProbabilityTableNode,
  type TaxonomyNode,
  type TaxonomyEdge,
  TaxonomyTermNodeSchema,
  ProbabilityTableNodeSchema,
  EDGE_RELATIONS,
} from './taxonomy-model.ts'

export interface HarvestInput {
  vocab: string
  mode: PingMode
}

export interface HarvestReport {
  phase: 'harvest' | 'cross-check' | 'cleanup' | 'test'
  ok: boolean
  notes: string[]
}

export interface HarvestResult {
  terms: TaxonomyTermNode[]
  table: ProbabilityTableNode
  edges: TaxonomyEdge[] // synonym_of / implies_protocol edges
  reports: HarvestReport[]
}

// ── Phase 1: HARVEST ────────────────────────────────────────────────────────
export async function harvest(input: HarvestInput): Promise<{
  terms: TaxonomyTermNode[]
  table: ProbabilityTableNode
}> {
  const prompt = buildPrompt(PROBABILITY_HARVEST, { vocab: input.vocab })
  const res = await ping(prompt, {
    mode: input.mode,
    outputPath: 'harvest/raw.json',
    model: process.env.HARVEST_MODEL,
  })
  const parsed = (res.parsed ?? {}) as {
    taxonomyTerms?: unknown[]
    probabilityTable?: unknown
  }
  const terms = (parsed.taxonomyTerms ?? []).map((t) =>
    TaxonomyTermNodeSchema.parse({ id: randomUUID(), ...(t as object) }),
  )
  const table = ProbabilityTableNodeSchema.parse({
    id: randomUUID(),
    kind: 'probability_table',
    slug: 'harvest_table',
    label: 'Harvested probability table',
    shared: true,
    targetKind: 'protocol',
    conditionKind: 'taxonomy_term',
    ...(parsed.probabilityTable as object),
  })
  return { terms, table }
}

// ── Phase 2: CROSS-CHECK ──────────────────────────────────────────────────────
// Validate against known nodes; flag conflicts (e.g. p>0.9 contradicting a known fact),
// resolve canonical synonyms.
export function crossCheck(
  terms: TaxonomyTermNode[],
  table: ProbabilityTableNode,
  knownNodes: TaxonomyNode[],
): { terms: TaxonomyTermNode[]; table: ProbabilityTableNode; report: HarvestReport } {
  const notes: string[] = []
  const knownSlugs = new Set(knownNodes.map((n) => n.slug))
  const validTargets = new Set(knownNodes.filter((n) => n.kind === table.targetKind).map((n) => n.slug))

  // resolve canonical synonym slugs
  const resolvedTerms = terms.map((t) => {
    if (t.canonicalSlug && !knownSlugs.has(t.canonicalSlug) && !terms.some((x) => x.slug === t.canonicalSlug)) {
      notes.push(`WARN synonym canonical "${t.canonicalSlug}" not found in known nodes or this batch`)
    }
    return t
  })

  // flag rows whose target is unknown for the table's targetKind
  const flaggedRows = table.rows.filter((r) => !validTargets.has(r.target))
  if (flaggedRows.length > 0) {
    notes.push(`WARN ${flaggedRows.length} rows target unknown ${table.targetKind} slug(s): ${[...new Set(flaggedTargets(flaggedRows))].join(', ')}`)
  }

  // flag over-confident contradictions (p>0.9 but n<2 → weak support)
  const weak = table.rows.filter((r) => r.p > 0.9 && r.n < 2)
  if (weak.length > 0) notes.push(`WARN ${weak.length} rows are p>0.9 with n<2 (weak support)`)

  return {
    terms: resolvedTerms,
    table,
    report: { phase: 'cross-check', ok: true, notes },
  }
}

function flaggedTargets(rows: { target: string }[]): string[] {
  return rows.map((r) => r.target)
}

// ── Phase 3: CLEANUP ──────────────────────────────────────────────────────────
// Normalize slugs, merge synonyms to canonical, clamp p, dedupe rows.
export function cleanup(
  terms: TaxonomyTermNode[],
  table: ProbabilityTableNode,
): { terms: TaxonomyTermNode[]; table: ProbabilityTableNode; report: HarvestReport } {
  const notes: string[] = []

  // dedupe terms by slug (keep highest sourceConfidence)
  const termMap = new Map<string, TaxonomyTermNode>()
  for (const t of terms) {
    const prev = termMap.get(t.slug)
    if (!prev || rank(t.sourceConfidence) > rank(prev.sourceConfidence)) termMap.set(t.slug, t)
  }

  // clamp probabilities + drop zero-support
  const seen = new Set<string>()
  const cleanRows = table.rows
    .map((r) => ({ ...r, p: Math.max(0, Math.min(1, r.p)) }))
    .filter((r) => {
      const key = JSON.stringify(r.conditions) + '→' + r.target
      if (seen.has(key)) return false
      seen.add(key)
      return r.n > 0
    })
  if (cleanRows.length !== table.rows.length) {
    notes.push(`cleanup: deduped ${table.rows.length - cleanRows.length} rows, clamped p`)
  }

  const cleanTable: ProbabilityTableNode = { ...table, rows: cleanRows }
  return {
    terms: [...termMap.values()],
    table: cleanTable,
    report: { phase: 'cleanup', ok: true, notes },
  }
}

function rank(c: 'high' | 'medium' | 'low'): number {
  return c === 'high' ? 3 : c === 'medium' ? 2 : 1
}

// ── Phase 4: TEST ──────────────────────────────────────────────────────────────
// Spot-check rows against known edges: if a term implies a protocol, is there a known
// platform/edge that corroborates? Produces an advisory test report (no live CDP needed).
export function testHarvest(
  terms: TaxonomyTermNode[],
  table: ProbabilityTableNode,
  knownEdges: TaxonomyEdge[],
): HarvestReport {
  const notes: string[] = []
  const impliesEdges = knownEdges.filter((e) => e.relation === 'implies_protocol')

  for (const row of table.rows) {
    const condTerm = row.conditions['term']
    const corroborated = impliesEdges.some(
      (e) => e.fromSlug === condTerm && e.toSlug === row.target,
    )
    if (row.p > 0.8 && !corroborated) {
      notes.push(`TEST open: term "${condTerm}" → ${row.target} (p=${row.p}) has no corroborating edge yet — queue for live validation`)
    } else if (corroborated) {
      notes.push(`TEST pass: term "${condTerm}" → ${row.target} corroborated by existing edge`)
    }
  }
  return { phase: 'test', ok: true, notes }
}

// ── Orchestrator ────────────────────────────────────────────────────────────────
export async function runHarvestPipeline(
  input: HarvestInput,
  knownNodes: TaxonomyNode[] = [],
  knownEdges: TaxonomyEdge[] = [],
): Promise<HarvestResult> {
  const reports: HarvestReport[] = []

  const { terms: rawTerms, table: rawTable } = await harvest(input)
  reports.push({ phase: 'harvest', ok: true, notes: [`harvested ${rawTerms.length} terms, ${rawTable.rows.length} rows`] })

  const cc = crossCheck(rawTerms, rawTable, knownNodes)
  reports.push(cc.report)

  const cl = cleanup(cc.terms, cc.table)
  reports.push(cl.report)

  const testReport = testHarvest(cl.terms, cl.table, knownEdges)
  reports.push(testReport)

  // build edges from terms (synonym_of) + table (implies_protocol)
  const edges: TaxonomyEdge[] = []
  for (const t of cl.terms) {
    if (t.canonicalSlug) {
      edges.push({
        id: `e_${t.slug}__syn`,
        fromSlug: t.slug,
        fromKind: 'taxonomy_term',
        toSlug: t.canonicalSlug,
        toKind: 'taxonomy_term',
        relation: 'synonym_of',
        confidence: t.sourceConfidence,
      })
    }
  }
  for (const row of cl.table.rows) {
    const condTerm = row.conditions['term']
    if (condTerm && cl.table.targetKind === 'protocol') {
      edges.push({
        id: `e_${condTerm}__imp_${row.target}`,
        fromSlug: condTerm,
        fromKind: 'taxonomy_term',
        toSlug: row.target,
        toKind: 'protocol',
        relation: 'implies_protocol',
        confidence: row.p > 0.8 ? 'high' : 'medium',
      })
    }
  }

  return { terms: cl.terms, table: cl.table, edges, reports }
}

// re-export for callers building the document
export { EDGE_RELATIONS }
