// devops/features.ts
// Feature Registry — governs feature lifecycle, skill mapping, and health.
//
// Features are stored as individual markdown files in docs/features/<id>.md
// with a master index at docs/features/FEATURES.md.
//
// Usage:
//   bun run devops features list        — table of all features
//   bun run devops features show <id>   — full feature record
//   bun run devops features create ...  — register new feature
//   bun run devops features update ...  — update feature status/fields
//   bun run devops features gaps [--id] — spec vs implementation vs test gaps
//   bun run devops features status      — summary counts by phase/status

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

// ── Types ─────────────────────────────────────────────────────────────────

export type FeatureStatus =
  | 'proposed'
  | 'designing'
  | 'approved'
  | 'in_progress'
  | 'testing'
  | 'verified'
  | 'done'
  | 'deprecated'

export interface FeatureRecord {
  id: string
  name: string
  phase: number
  status: FeatureStatus
  owningSkill: string
  engines: string[]
  specRef: string
  coverage: number
  invariants: string[]
  lastVerified: string
  notes: string
}

export interface FeatureGap {
  featureId: string
  type: 'engine_no_test' | 'engine_no_invariant' | 'spec_missing' | 'skill_missing' | 'coverage_low'
  message: string
  severity: 'block' | 'warning'
}

export interface FeatureStatusSummary {
  total: number
  byStatus: Record<FeatureStatus, number>
  byPhase: Record<number, number>
}

// ── Constants ─────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dir, '..')
const FEATURES_DIR = join(PROJECT_ROOT, 'docs', 'features')
const FEATURES_INDEX = join(FEATURES_DIR, 'FEATURES.md')

// ── File I/O ──────────────────────────────────────────────────────────────

async function readFeatureFile(id: string): Promise<FeatureRecord | null> {
  const path = join(FEATURES_DIR, `${id}.md`)
  if (!existsSync(path)) return null
  const content = await readFile(path, 'utf8')
  return parseFeatureMarkdown(content, id)
}

async function writeFeatureFile(record: FeatureRecord): Promise<void> {
  await mkdir(FEATURES_DIR, { recursive: true })
  const content = renderFeatureMarkdown(record)
  await writeFile(join(FEATURES_DIR, `${record.id}.md`), content, 'utf8')
}

async function readFeaturesIndex(): Promise<FeatureRecord[]> {
  if (!existsSync(FEATURES_DIR)) return []
  const entries = await readdir(FEATURES_DIR)
  const records: FeatureRecord[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.md') || entry === 'FEATURES.md') continue
    const id = entry.replace('.md', '')
    const record = await readFeatureFile(id)
    if (record) records.push(record)
  }
  return records
}

async function writeFeaturesIndex(records: FeatureRecord[]): Promise<void> {
  const content = renderIndexMarkdown(records)
  await writeFile(FEATURES_INDEX, content, 'utf8')
}

// ── Markdown Parser ───────────────────────────────────────────────────────

function parseFeatureMarkdown(content: string, fallbackId: string): FeatureRecord {
  const lines = content.split('\n')

  // Extract metadata from table rows
  const meta: Record<string, string> = {}
  for (const line of lines) {
    const m = line.match(/^\|\s*\*\*([\w ]+)\*\*\s*\|\s*(.+?)\s*\|$/)
    if (m) {
      meta[m[1]!.toLowerCase().trim()] = m[2]!.trim()
    }
  }

  // Extract engines from engines table
  const engines: string[] = []
  let inEngines = false
  for (const line of lines) {
    if (line.includes('| Engine |')) { inEngines = true; continue }
    if (inEngines && line.startsWith('|---')) { continue }
    if (inEngines && line.startsWith('|')) {
      const parts = line.split('|').map(p => p.trim())
      const path = parts[2]
      if (path && path !== 'Path') engines.push(path.replace(/`/g, '').trim())
    } else if (inEngines && !line.startsWith('|')) {
      inEngines = false
    }
  }

  // Extract invariants from invariants table
  const invariants: string[] = []
  let inInvariants = false
  for (const line of lines) {
    if (line.includes('| ID |')) { inInvariants = true; continue }
    if (inInvariants && line.startsWith('|---')) { continue }
    if (inInvariants && line.startsWith('|')) {
      const parts = line.split('|').map(p => p.trim())
      const id = parts[1]
      if (id && id !== 'ID') invariants.push(id)
    } else if (inInvariants && !line.startsWith('|')) {
      inInvariants = false
    }
  }

  // Extract notes from ## Notes section
  let notes = ''
  let inNotes = false
  for (const line of lines) {
    if (line.startsWith('## Notes')) { inNotes = true; continue }
    if (inNotes && line.startsWith('## ')) { inNotes = false }
    if (inNotes) notes += line + '\n'
  }
  notes = notes.trim()

  return {
    id: meta['id']?.replace(/`/g, '').trim() ?? fallbackId,
    name: meta['name']?.trim() ?? '',
    phase: Number((meta['phase'] ?? '0').replace(/\(.*\)/, '').trim()),
    status: (meta['status']?.replace(/`/g, '').trim() as FeatureStatus) ?? 'proposed',
    owningSkill: meta['owning skill']?.replace(/`/g, '').trim() ?? '',
    engines,
    specRef: meta['spec ref']?.trim() ?? '',
    coverage: Number((meta['coverage'] ?? '0').replace(/[^0-9.]/g, '').trim()),
    invariants,
    lastVerified: meta['last verified']?.trim() ?? '',
    notes,
  }
}

function renderFeatureMarkdown(record: FeatureRecord): string {
  const lines = [
    `# Feature: ${record.id}`,
    '',
    '## Overview',
    '',
    record.notes || `${record.name} — registered in feature governance system.`,
    '',
    '## Metadata',
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| **ID** | \`${record.id}\` |`,
    `| **Name** | ${record.name} |`,
    `| **Phase** | ${record.phase} |`,
    `| **Status** | \`${record.status}\` |`,
    `| **Owning Skill** | ${record.owningSkill} |`,
    `| **Spec Ref** | ${record.specRef} |`,
    `| **Last Verified** | ${record.lastVerified} |`,
    '',
    '## Owning Engines',
    '',
    '| Engine | Path | Purpose |',
    '|--------|------|---------|',
    ...record.engines.map(e => `| ${e.split('/').pop()?.replace('.ts', '') ?? e} | \`${e}\` | — |`),
    '',
    '## Coverage',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Coverage | ${record.coverage}% |`,
    '',
    '## Invariants',
    '',
    '| ID | Category | Check |',
    '|----|----------|-------|',
    ...record.invariants.map(id => `| ${id} | — | — |`),
    '',
    '## Lifecycle History',
    '',
    '| Date | Event | Notes |',
    '|------|-------|-------|',
    `| ${record.lastVerified} | ${record.status} | — |`,
    '',
  ]
  return lines.join('\n')
}

function renderIndexMarkdown(records: FeatureRecord[]): string {
  const byStatus: Record<string, number> = {}
  const byPhase: Record<number, number> = {}
  for (const r of records) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    byPhase[r.phase] = (byPhase[r.phase] ?? 0) + 1
  }

  const lines = [
    '# Feature Registry',
    '',
    'Master inventory of all features in the vivim-final system.',
    'Each feature is governed by the feature-governance skill.',
    '',
    '## Status Legend',
    '',
    '| Status | Meaning |',
    '|--------|---------|',
    '| `proposed` | Feature requested, not yet started |',
    '| `designing` | Spec/ADR in progress |',
    '| `approved` | Approved for implementation |',
    '| `in_progress` | Actively being built |',
    '| `testing` | Implementation done, tests in progress |',
    '| `verified` | All tests pass, gate passes |',
    '| `done` | Feature complete and documented |',
    '| `deprecated` | No longer relevant |',
    '',
    '## Features',
    '',
    '| ID | Name | Phase | Status | Owning Skill | Coverage | Last Verified |',
    '|----|------|-------|--------|--------------|----------|---------------|',
    ...records.map(r =>
      `| \`${r.id}\` | ${r.name} | ${r.phase} | ${r.status} | ${r.owningSkill} | ${r.coverage}% | ${r.lastVerified} |`
    ),
    '',
    '## Phase Map',
    '',
    '| Phase | Features |',
    '|-------|----------|',
    ...Array.from({ length: 15 }, (_, i) => {
      const phaseFeatures = records.filter(r => r.phase === i)
      return `| ${i} | ${phaseFeatures.length > 0 ? phaseFeatures.map(r => `\`${r.id}\``).join(', ') : '—'} |`
    }),
    '',
  ]
  return lines.join('\n')
}

// ── Core Operations ───────────────────────────────────────────────────────

export async function listFeatures(): Promise<FeatureRecord[]> {
  return readFeaturesIndex()
}

export async function getFeature(id: string): Promise<FeatureRecord | null> {
  return readFeatureFile(id)
}

export async function createFeature(input: {
  id: string
  name: string
  phase: number
  owningSkill: string
  engines?: string[]
  specRef?: string
  coverage?: number
  invariants?: string[]
  notes?: string
}): Promise<FeatureRecord> {
  const existing = await readFeatureFile(input.id)
  if (existing) {
    throw new Error(`Feature ${input.id} already exists`)
  }

  const record: FeatureRecord = {
    id: input.id,
    name: input.name,
    phase: input.phase,
    status: 'proposed',
    owningSkill: input.owningSkill,
    engines: input.engines ?? [],
    specRef: input.specRef ?? '',
    coverage: input.coverage ?? 0,
    invariants: input.invariants ?? [],
    lastVerified: new Date().toISOString().split('T')[0]!,
    notes: input.notes ?? '',
  }

  await writeFeatureFile(record)

  // Update index
  const all = await readFeaturesIndex()
  all.push(record)
  await writeFeaturesIndex(all)

  return record
}

export async function updateFeature(
  id: string,
  updates: Partial<Pick<FeatureRecord, 'name' | 'phase' | 'status' | 'owningSkill' | 'engines' | 'specRef' | 'coverage' | 'invariants' | 'lastVerified' | 'notes'>>,
): Promise<FeatureRecord> {
  const record = await readFeatureFile(id)
  if (!record) {
    throw new Error(`Feature ${id} not found`)
  }

  const updated = { ...record, ...updates }
  await writeFeatureFile(updated)

  // Update index
  const all = await readFeaturesIndex()
  const idx = all.findIndex(r => r.id === id)
  if (idx !== -1) all[idx] = updated
  await writeFeaturesIndex(all)

  return updated
}

// ── Gap Analysis ──────────────────────────────────────────────────────────

export async function analyzeFeatureGaps(id?: string): Promise<FeatureGap[]> {
  const records = id
    ? [(await readFeatureFile(id))].filter(Boolean) as FeatureRecord[]
    : await readFeaturesIndex()

  const gaps: FeatureGap[] = []

  for (const record of records) {
    // Check: engines without tests
    for (const enginePath of record.engines) {
      const engineName = enginePath.split('/').pop()?.replace('.ts', '') ?? ''
      const testFlat = join(PROJECT_ROOT, 'tests', 'unit', 'engines', `${engineName}.test.ts`)
      const testDir = join(PROJECT_ROOT, 'tests', 'unit', 'engines', engineName)
      const hasTest = existsSync(testFlat) || existsSync(testDir)
      if (!hasTest) {
        gaps.push({
          featureId: record.id,
          type: 'engine_no_test',
          message: `Engine ${enginePath} has no unit test`,
          severity: 'warning',
        })
      }
    }

    // Check: no spec reference
    if (!record.specRef) {
      gaps.push({
        featureId: record.id,
        type: 'spec_missing',
        message: 'No spec reference defined',
        severity: 'warning',
      })
    }

    // Check: no owning skill
    if (!record.owningSkill) {
      gaps.push({
        featureId: record.id,
        type: 'skill_missing',
        message: 'No owning skill assigned',
        severity: 'block',
      })
    }

    // Check: low coverage
    if (record.coverage < 80) {
      gaps.push({
        featureId: record.id,
        type: 'coverage_low',
        message: `Coverage ${record.coverage}% is below 80% threshold`,
        severity: 'warning',
      })
    }
  }

  return gaps
}

// ── Status Summary ────────────────────────────────────────────────────────

export async function getFeatureStatusSummary(): Promise<FeatureStatusSummary> {
  const records = await readFeaturesIndex()

  const byStatus: Record<FeatureStatus, number> = {
    proposed: 0, designing: 0, approved: 0, in_progress: 0,
    testing: 0, verified: 0, done: 0, deprecated: 0,
  }
  const byPhase: Record<number, number> = {}

  for (const r of records) {
    byStatus[r.status]++
    byPhase[r.phase] = (byPhase[r.phase] ?? 0) + 1
  }

  return { total: records.length, byStatus, byPhase }
}
