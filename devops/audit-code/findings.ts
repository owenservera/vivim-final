// devops/audit-code/findings.ts
// Finding data model, JSON persistence, summary + risk computation, baseline
// trend comparison.

import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Dimension, Priority, Risk, Scope } from './priority.ts'

export type FixEffort = 'S' | 'M' | 'L'
export type FindingStatus = 'open' | 'fixed' | 'wontfix' | 'false-positive'

export interface FixInstructions {
  summary: string
  steps: string[]
  patchSuggestion?: string
  /** Recipe kind from the engine (remove-line / insert-log / manual). */
  kind?: string
  effort: FixEffort
  autoFixable: boolean
}

export interface Finding {
  id: string
  priority: Priority
  dimension: Dimension
  invariant?: string
  title: string
  description: string
  file: string
  line: number
  evidence: string
  impact: string
  fix: FixInstructions
  status: FindingStatus
  linkedUnit?: string
  linkedAdr?: string
}

export interface AuditRunMeta {
  scope: Scope
  commit: string
  date: string
  filesScanned: number
  root: string
}

export interface FindingsSummary {
  P0: number
  P1: number
  P2: number
  P3: number
  risk: Risk
  total: number
}

export interface FindingsFile {
  run: AuditRunMeta
  summary: FindingsSummary
  findings: Finding[]
}

export function emptySummary(): FindingsSummary {
  return { P0: 0, P1: 0, P2: 0, P3: 0, risk: 'L', total: 0 }
}

export function computeSummary(findings: Finding[]): FindingsSummary {
  const s = emptySummary()
  for (const f of findings) s[f.priority] += 1
  s.total = findings.length
  s.risk = computeRisk(s)
  return s
}

// Risk score: P0 is decisive, then weighted by P1/P2.
export function computeRisk(s: FindingsSummary): Risk {
  if (s.P0 > 0) return 'H'
  if (s.P1 >= 5 || s.P1 + s.P2 >= 12) return 'M'
  if (s.P1 === 0 && s.P2 === 0) return 'L'
  return 'M'
}

export function riskLabel(r: Risk): string {
  return r === 'H' ? 'High' : r === 'M' ? 'Medium' : 'Low'
}

// ── Builder ───────────────────────────────────────────────────────────────

export interface FindingInput {
  priority: Priority
  dimension: Dimension
  invariant?: string
  title: string
  description: string
  file: string
  line: number
  evidence: string
  impact: string
  fixSummary: string
  fixSteps: string[]
  patchSuggestion?: string
  /** Recipe kind from the engine (remove-line / insert-log / manual). */
  kind?: string
  effort: FixEffort
  autoFixable: boolean
  linkedUnit?: string
  linkedAdr?: string
}

export function buildFinding(input: FindingInput): Finding {
  return {
    id: nextFindingId(),
    priority: input.priority,
    dimension: input.dimension,
    invariant: input.invariant,
    title: input.title,
    description: input.description,
    file: input.file,
    line: input.line,
    evidence: input.evidence,
    impact: input.impact,
    fix: {
      summary: input.fixSummary,
      steps: input.fixSteps,
      patchSuggestion: input.patchSuggestion,
      kind: input.kind,
      effort: input.effort,
      autoFixable: input.autoFixable,
    },
    status: 'open',
    linkedUnit: input.linkedUnit,
    linkedAdr: input.linkedAdr,
  }
}

// ── ID generation ─────────────────────────────────────────────────────────

let counter = 0
export function nextFindingId(): string {
  counter += 1
  return `AU-${String(counter).padStart(4, '0')}`
}

export function resetIdCounter(): void {
  counter = 0
}

// ── Persistence ───────────────────────────────────────────────────────────

export async function saveFindings(path: string, data: FindingsFile): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}

export async function loadFindings(path: string): Promise<FindingsFile | null> {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as FindingsFile
  } catch {
    return null
  }
}

export async function saveBaseline(dir: string, data: FindingsFile): Promise<string> {
  const name = `baseline-${data.run.date}.json`
  const path = join(dir, name)
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
  return path
}

export async function loadLatestBaseline(dir: string): Promise<FindingsFile | null> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }
  const baselines = entries.filter((f) => f.startsWith('baseline-') && f.endsWith('.json')).sort()
  if (baselines.length === 0) return null
  const raw = await readFile(join(dir, baselines[baselines.length - 1]!), 'utf8')
  return JSON.parse(raw) as FindingsFile
}

export interface TrendResult {
  baselineDate: string
  newFindings: Finding[]
  resolvedFindings: Finding[]
  unchanged: Finding[]
}

// Compare current open findings against a baseline using a stable fingerprint
// (dimension + file + line). The engine assigns a fresh ULID per run, so the
// id must never be part of the identity — otherwise every finding reads as
// "new" and every baseline finding reads as "resolved".
export function compareBaseline(current: Finding[], baseline: FindingsFile | null): TrendResult {
  if (!baseline) {
    return { baselineDate: 'none', newFindings: current, resolvedFindings: [], unchanged: [] }
  }
  const key = (f: Finding) => `${f.dimension}|${f.file}:${f.line}`
  const baseKeys = new Set(baseline.findings.map(key))
  const curKeys = new Set(current.map(key))
  const newFindings = current.filter((f) => !baseKeys.has(key(f)))
  const resolvedFindings = baseline.findings.filter((f) => !curKeys.has(key(f)))
  const unchanged = current.filter((f) => baseKeys.has(key(f)))
  return { baselineDate: baseline.run.date, newFindings, resolvedFindings, unchanged }
}

// ── Helpers ───────────────────────────────────────────────────────────────

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
