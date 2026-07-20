// scripts/taxonomy-gen/lib/openclaw-harvest.ts
//
// Round 0+ harvest: convert OpenClaw's `taxonomy.yaml` maturity scorecard into
// vivim-compatible taxonomy nodes (shared capability / taxonomy_term nodes).
//
// OpenClaw structure:
//   areas[]  -> categories[] -> features[]  (each feature has coverageIds[])
//
// Mapping (deterministic, no LLM):
//   area   -> taxonomy_term (vocabulary: "openclaw-area")
//   category -> taxonomy_term (vocabulary: "openclaw-category", parent area)
//   feature -> capability (shared) slug = `oc:<area>:<category>:<slugified-feature>`
//   coverageId token -> capability (shared) slug = `oc-cap:<coverageId>` (granular)
//
// Edges:
//   area    -synonym_of-> nothing (top term)
//   category -synonym_of-> area term (hierarchy link reused as parent)
//   feature cap -has_probability-> (implicit; we just emit exposes-style edges to area)
//
// Run: bun run scripts/taxonomy-gen/openclaw-harvest.ts
// Output: seeds/taxonomy/openclaw-harvest.json (TaxonomyDocument-shaped)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const IMPORT_DIR = join(import.meta.dir, '..', '..', '..', 'research-clones', 'openclaw-core')
const YAML_PATH = join(IMPORT_DIR, 'taxonomy.yaml')
const OUT_PATH = join(import.meta.dir, '..', '..', '..', 'seeds', 'taxonomy', 'openclaw-harvest.json')

type Cov = { id: string; description: string }
type Feature = { name: string; coverageIds: string[]; description?: string }
type Category = { id: string; name: string; features: Feature[] }
type Area = { id: string; name: string; categories: Category[] }

// Minimal YAML parser tailored to taxonomy.yaml's known shape.
// We only need: areas[] -> categories[] -> features[].coverageIds
function parseTaxonomy(text: string): Area[] {
  const lines = text.split('\n')
  const areas: Area[] = []
  let curArea: Area | null = null
  let curCat: Category | null = null
  let curFeat: Feature | null = null
  let inCov = false
  let covBuf = ''

  const flushCov = () => {
    if (curFeat && inCov) {
      const ids = covBuf
        .replace(/[\[\]]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      curFeat.coverageIds.push(...ids)
    }
    inCov = false
    covBuf = ''
  }

  let inProfiles = false
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx]
    const line = raw.replace(/\s+$/, '')
    const indent = line.length - line.trimStart().length
    const t = line.trim()

    // Skip the `profiles:` block (smoke-ci, release, etc. are CI/test profiles, not areas)
    if (indent === 2 && /^profiles:/.test(t)) {
      inProfiles = true
      continue
    }
    if (inProfiles) {
      if (indent <= 2 && /^(areas|snapshot):/.test(t)) inProfiles = false
      else continue
    }

    // Top area: "  - id: gateway-runtime" (indent 2, starts with "- id:")
    if (indent === 2 && /^- id:/.test(t)) {
      flushCov()
      curFeat = null
      curCat = null
      const id = t.match(/^- id:\s*(.+)$/)?.[1]?.trim() ?? ''
      const name = ''
      curArea = { id, name, categories: [] }
      areas.push(curArea)
      continue
    }
    // Area name on next line: "    name: Gateway runtime"
    if (indent === 4 && /^name:/.test(t) && curArea && !curArea.name) {
      curArea.name = t.match(/^name:\s*(.+)$/)?.[1]?.trim() ?? ''
      continue
    }
    // Category: "      - name: Approvals and Remote Execution" (indent 6)
    if (indent === 6 && /^- name:/.test(t) && curArea) {
      flushCov()
      curFeat = null
      const idLine = lines[idx + 1]?.trim() ?? ''
      const id = idLine.match(/^id:\s*(.+)$/)?.[1]?.trim() ?? slugKey(t.match(/^- name:\s*(.+)$/)?.[1]?.trim() ?? '')
      curCat = { id, name: t.match(/^- name:\s*(.+)$/)?.[1]?.trim() ?? '', features: [] }
      curArea.categories.push(curCat)
      continue
    }
    // Feature: "          - name: Browser Actions" (indent 10, has name:)
    if (indent === 10 && /^- name:/.test(t) && curCat) {
      flushCov()
      const name = t.match(/^- name:\s*(.+)$/)?.[1]?.trim() ?? ''
      curFeat = { name, coverageIds: [] }
      curCat.features.push(curFeat)
      continue
    }
    // coverageIds: [a, b]  (indent 12)
    if (indent === 12 && /^coverageIds:/.test(t)) {
      flushCov()
      const body = t.match(/^coverageIds:\s*(.*)$/)?.[1]?.trim() ?? ''
      if (body.startsWith('[') && body.endsWith(']')) {
        const ids = body
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        if (curFeat) curFeat.coverageIds.push(...ids)
      } else {
        inCov = true
        covBuf = body.replace(/^\[\s*/, '')
      }
      continue
    }
    if (inCov) {
      // continuation line of a multi-line coverageIds list
      if (t.endsWith(']')) {
        covBuf += ' ' + t.replace(/\]\s*$/, '')
        flushCov()
      } else {
        covBuf += ' ' + t
      }
      continue
    }
  }
  flushCov()
  return areas
}

// Convert an OpenClaw dotted/dashed id (e.g. "gateway.exec-approvals") into a
// single-segment-safe underscore slug. The taxonomy binder derives capId from
// slug.split('_')[0], so we keep one leading "oc" namespace segment and let the
// rest be the category/action body.
function slugKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function inferKind(name: string): 'action' | 'query' | 'state' | 'config' | 'navigation' {
  const n = name.toLowerCase()
  if (/(status|diagnostics|health|list|show|search|inspect|get|fetch)/.test(n)) return 'query'
  if (/(config|setup|auth|credential|policy|routing|selection|model)/.test(n)) return 'config'
  if (/(navigate|route|redirect|open|go to)/.test(n)) return 'navigation'
  if (/(state|lifecycle|session|memory|history|context)/.test(n)) return 'state'
  return 'action'
}

export function runOpenClawHarvest(): { areaCount: number; catCount: number; featCount: number; covCount: number; nodeCount: number; edgeCount: number; docPath: string } {
  if (!existsSync(YAML_PATH)) {
    console.error(`OpenClaw taxonomy.yaml not found at ${YAML_PATH}`)
    console.error('Run the research clone step first (fetch research-clones/openclaw-core/taxonomy.yaml).')
    process.exit(1)
  }
  const text = readFileSync(YAML_PATH, 'utf-8')
  const areas = parseTaxonomy(text)

  const nodes: any[] = []
  const edges: any[] = []
  const seenCap = new Set<string>()

  const addTerm = (slug: string, label: string, vocabulary: string, parent?: string) => {
    nodes.push({
      id: randomUUID(),
      kind: 'taxonomy_term',
      slug,
      label,
      description: '',
      sourceConfidence: 'high',
      tags: ['openclaw', 'harvest'],
      shared: true,
      vocabulary,
      canonicalSlug: parent ?? null,
    })
  }

  const addCap = (slug: string, label: string, kind: string, desc: string, parentArea: string) => {
    if (seenCap.has(slug)) return
    seenCap.add(slug)
    nodes.push({
      id: randomUUID(),
      kind: 'capability',
      slug,
      label,
      description: desc,
      sourceConfidence: 'high',
      tags: ['openclaw', 'harvest', 'shared-capability'],
      shared: true,
      capabilityKind: kind,
      ui_component: null,
      ui_label: null,
      ui_icon: null,
      ui_position: null,
      ui_order: null,
      ui_group: null,
      ui_layer_depth: 0,
      ui_priority: 'normal',
      interaction_mode: 'button',
      ui_states_json: '{}',
      ui_visibility_rule: null,
      ui_input_schema: '{}',
      result_component: 'text',
      result_layout: 'single',
      capId: null,
      surfaces: ['cli', 'ui', 'api'],
      cliCommand: null,
      apiEndpoint: null,
      mcpToolName: null,
      uiAction: null,
      workflowNodeType: null,
      isAsync: true,
      requiresConfirmation: false,
      inputSchema: null,
      outputSchema: null,
      platformBindings: [],
    })
    // link capability -> area term (exposes-style reuse via synonym_of chain)
    edges.push({
      id: randomUUID(),
      fromSlug: slug,
      fromKind: 'capability',
      toSlug: parentArea,
      toKind: 'taxonomy_term',
      relation: 'synonym_of',
      confidence: 'high',
    })
  }

  let areaCount = 0
  let catCount = 0
  let featCount = 0
  let covCount = 0

  const SKIP_AREAS = new Set(['smoke-ci', 'release', 'all'])
  for (const area of areas) {
    if (!area.id || SKIP_AREAS.has(area.id)) continue
    areaCount++
    const areaSlug = `oc_area_${slugKey(area.id)}`
    addTerm(areaSlug, area.name || area.id, 'openclaw-area')

    for (const cat of area.categories ?? []) {
      if (!cat.id) continue
      catCount++
      const catSlug = `oc_cat_${slugKey(area.id)}_${slugKey(cat.id)}`
      addTerm(catSlug, cat.name || cat.id, 'openclaw-category', areaSlug)
      edges.push({
        id: randomUUID(),
        fromSlug: catSlug,
        fromKind: 'taxonomy_term',
        toSlug: areaSlug,
        toKind: 'taxonomy_term',
        relation: 'synonym_of',
        confidence: 'high',
      })

      for (const feat of cat.features ?? []) {
        if (!feat.name) continue
        featCount++
        const featSlug = `oc_${slugKey(area.id)}_${slugKey(cat.id)}_${slugKey(feat.name)}`
        addCap(featSlug, feat.name, inferKind(feat.name), feat.description ?? '', areaSlug)

        for (const cid of feat.coverageIds ?? []) {
          covCount++
          const covSlug = `oc_${slugKey(cid)}`
          addCap(covSlug, cid, inferKind(cid), `OpenClaw coverageId ${cid} (area: ${area.id}, category: ${cat.id})`, areaSlug)
        }
      }
    }
  }

  const doc = { version: '1.0.0', generatedAt: new Date().toISOString(), nodes, edges }
  mkdirSync(join(OUT_PATH, '..'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(doc, null, 2))

  return { areaCount, catCount, featCount, covCount, nodeCount: nodes.length, edgeCount: edges.length, docPath: OUT_PATH }
}

// Thin CLI entry: run extraction + print summary.
function main() {
  const r = runOpenClawHarvest()
  console.log(`✅ OpenClaw harvest complete`)
  console.log(`   areas:     ${r.areaCount}`)
  console.log(`   categories:${r.catCount}`)
  console.log(`   features:  ${r.featCount}`)
  console.log(`   coverageIds:${r.covCount}`)
  console.log(`   total nodes: ${r.nodeCount} (terms + capabilities)`)
  console.log(`   total edges: ${r.edgeCount}`)
  console.log(`   → ${r.docPath}`)
}

// Only auto-run when invoked directly (not when imported by run.ts).
if (import.meta.main) {
  main()
}
