#!/usr/bin/env bun
/**
 * VIVIM Review System — Scope Triage Engine (L3 · deterministic)
 *
 * Reads the out-of-scope register (`docs/review-system/SCOPE.md`) and classifies
 * every finding in a run as:
 *   alpha   — in-scope for the alpha release: gates launch, gets fix tasks now.
 *   future  — matches a flagged area in SCOPE.md: documented + tracked, but gets
 *             NO implementation time now (valid placeholder, must not break alpha).
 *
 * This is the bridge between "review findings" and "what we actually fix". It is
 * deterministic (no judgment) so a re-run always classifies identically, and it
 * FAILS TOWARD ALPHA: a finding that matches no scope pattern is alpha; a broken
 * Match pattern silently treats its rows as alpha rather than deferring a finding.
 *
 * Inputs:
 *   docs/review-system/SCOPE.md            the human-flagged register (authoritative)
 *   runs/<run-id>/findings.json            from findings.ts
 *   runs/<run-id>/findings-summary.md      (for ownership re-bucket already applied)
 *
 * Outputs (per run):
 *   runs/<run-id>/triage.json   machine: [{id, scope, scopeArea, match}] + summary
 *   runs/<run-id>/triage.md     human:  alpha vs future tables + gate readout
 *
 * The ALPHA GATE is computed here and restated in triage.md:
 *   gating = alpha findings at P0 or P1  → must be fixed (verified) before alpha.
 *
 * Usage:
 *   bun docs/review-system/scripts/triage.ts --run <run-id> [--status]
 *
 * Zero runtime deps (node:fs only).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const ROOT = process.cwd()
const SYS = join(ROOT, 'docs', 'review-system')
const RUNS = join(SYS, 'runs')
const args = process.argv.slice(2)

function argV(f: string, fb?: string): string | undefined {
  const i = args.indexOf(f)
  return i >= 0 && args[i + 1] ? args[i + 1] : fb
}

const runId = argV('--run')
const statusOnly = args.includes('--status')

export type Scope = 'alpha' | 'future'

export interface ScopeArea {
  area: string
  match: RegExp[]
}

export interface TriageRow {
  id: string
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  scope: Scope
  /** the SCOPE.md area slug that flagged it (null for alpha) */
  scopeArea: string | null
  location: string
  issue: string
}

/** Parse SCOPE.md rows into {area, match[]}. Table rows look like:
 *  | `area` | desc | why | `/(regex)/` | 2026-08-06 |
 *  The Match cell is column 4 (0-indexed: area=1, desc=2, why=3, match=4).
 *  Malformed / empty match cells are dropped — the area then matches nothing,
 *  so anything touching it fails toward alpha (never silently deferred).
 */
export function parseScope(md: string): ScopeArea[] {
  const areas: ScopeArea[] = []
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith('|')) continue
    // split on unescaped pipes only (`\|` inside match regexes stays intact)
    const cells = line.match(/(?:\\.|[^\\|])+/g) ?? []
    const cellsArr = cells.map((c) => c.trim().replace(/^\\/, '')).filter((c) => c !== '')
    if (cellsArr.length < 4) continue
    const areaRaw = cellsArr[0]
    if (!areaRaw) continue
    const m = areaRaw.match(/`([^`]+)`/)
    const area = (m ? m[1] : areaRaw).trim()
    if (!/^[a-z0-9][a-z0-9-]*$/.test(area)) continue
    const matchCell = cellsArr[3] ?? ''
    const match: RegExp[] = []
    // match cell may hold several /re/ patterns and/or quoted literals
    for (const tok of matchCell.matchAll(/`([^`]+)`/g)) {
      // markdown table cells escape `|` as `\|` — unescape before building the regex
      const pattern = tok[1].replace(/\\\|/g, '|')
      try {
        match.push(new RegExp(pattern.replace(/^\/|\/$/g, ''), 'i'))
      } catch {
        /* malformed → drop pattern (fails toward alpha) */
      }
    }
    if (match.length > 0) areas.push({ area, match })
  }
  return areas
}

/** Does a finding touch a scope area? First matching row in table order wins. */
export function classify(
  finding: { id: string; location: string; issue: string; recommendation: string; severity: 'P0' | 'P1' | 'P2' | 'P3' },
  areas: ScopeArea[],
): TriageRow {
  const hay = `${finding.location}\n${finding.issue}\n${finding.recommendation}`
  for (const a of areas) {
    for (const re of a.match) {
      if (re.test(hay)) {
        return {
          id: finding.id,
          severity: finding.severity,
          scope: 'future',
          scopeArea: a.area,
          location: finding.location,
          issue: finding.issue,
        }
      }
    }
  }
  return {
    id: finding.id,
    severity: finding.severity,
    scope: 'alpha',
    scopeArea: null,
    location: finding.location,
    issue: finding.issue,
  }
}

/** Run triage over a run's findings.json. */
export function runTriage(runDir: string): TriageRow[] {
  const scopePath = join(SYS, 'SCOPE.md')
  const areas = existsSync(scopePath) ? parseScope(readFileSync(scopePath, 'utf8')) : []
  const findingsPath = join(runDir, 'findings.json')
  if (!existsSync(findingsPath)) return []
  const findings = JSON.parse(readFileSync(findingsPath, 'utf8')) as Array<{
    id: string
    severity: 'P0' | 'P1' | 'P2' | 'P3'
    location: string
    issue: string
    recommendation: string
  }>
  return findings.map((f) => classify(f, areas))
}

/** Human triage report: alpha gate + future ledger. */
export function triageMarkdown(rows: TriageRow[]): string {
  const alpha = rows.filter((r) => r.scope === 'alpha')
  const future = rows.filter((r) => r.scope === 'future')
  const gating = alpha.filter((r) => r.severity === 'P0' || r.severity === 'P1')
  const gateLine = gating.length === 0
    ? '✅ No alpha P0/P1 findings — **alpha-ready (clean)**.'
    : `🔴 ${gating.length} alpha P0/P1 finding${gating.length === 1 ? '' : 's'} gate alpha — must be fixed + verified before launch.`

  const rowsToLines = (list: TriageRow[]) => list.length === 0
    ? ['_None._']
    : list.map((r) => `| ${r.severity} | ${r.id} | \`${r.location}\` | ${r.issue} | ${r.scopeArea ? `\`${r.scopeArea}\`` : '—'} |`)

  return `# Triage — ${runId} (alpha vs future)

Per \`SCOPE.md\` (default-in, flag-out). Classified deterministically by
\`triage.ts\`. **Ambiguous findings fail toward alpha.**

${gateLine}

## Alpha-in-scope (fix now) — ${alpha.length} findings

| Severity | ID | Location | Issue | Scope area |
|----------|----|----------|-------|------------|
${rowsToLines(alpha).join('\n')}

## Future / out-of-scope (tracked, NO implementation time) — ${future.length} findings

Placeholders are acceptable so long as they do not break alpha. These stay in the
ledger for later; they do not gate the release.

| Severity | ID | Location | Issue | Scope area |
|----------|----|----------|-------|------------|
${rowsToLines(future).join('\n')}

## Gate summary

- Alpha-in-scope: ${alpha.length} (P0=${alpha.filter((r) => r.severity === 'P0').length} P1=${alpha.filter((r) => r.severity === 'P1').length})
- Future (tracked only): ${future.length}
- **Gating (alpha P0/P1): ${gating.length}**
`
}

// ---------- CLI ----------
if (!runId) {
  console.error('usage: triage.ts --run <run-id> [--status]')
  process.exit(1)
}

const runDir = join(RUNS, runId)
if (!existsSync(join(runDir, 'findings.json'))) {
  console.error(`no findings.json in ${runDir} — run findings.ts first`)
  process.exit(1)
}

const rows = runTriage(runDir)
const alpha = rows.filter((r) => r.scope === 'alpha')
const future = rows.filter((r) => r.scope === 'future')
const gating = alpha.filter((r) => r.severity === 'P0' || r.severity === 'P1')

mkdirSync(runDir, { recursive: true })
writeFileSync(join(runDir, 'triage.json'), JSON.stringify({
  runId,
  generatedAt: new Date().toISOString(),
  total: rows.length,
  alpha: alpha.length,
  future: future.length,
  gating: gating.length,
  rows,
}, null, 2))
writeFileSync(join(runDir, 'triage.md'), triageMarkdown(rows))

console.log(`[triage] run ${runId}: ${rows.length} findings → alpha=${alpha.length} future=${future.length} gating(P0/P1)=${gating.length}`)
for (const r of rows) console.log(`  ${r.scope === 'alpha' ? 'α' : '↦'} ${r.severity} ${r.id} ${r.scopeArea ? `→ ${r.scopeArea}` : ''} — ${r.issue.slice(0, 70)}`)

if (statusOnly) process.exit(0)
console.log(`\n[triage] wrote triage.json + triage.md (gate: ${gating.length} alpha P0/P1)`)
