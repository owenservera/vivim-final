#!/usr/bin/env bun
/**
 * VIVIM Review System — Findings Extractor (L3 · Remediation input)
 *
 * Turns the review reports' Findings Ledger tables + inline ledger rows into a
 * single machine-readable `findings.json` for a run, plus a human `findings-summary.md`.
 * This is the bridge from "review" to "fix": every report row that follows the
 * canonical contract becomes a work item here.
 *
 * Canonical row formats accepted (both, anywhere in report .md files):
 *   Table row:    | P0 | B1-1 | `src/foo.ts:42` | issue | evidence | rec | owner |
 *   Inline row:   [P0] B1-1 · src/foo.ts:42 · issue · evidence · rec · owner
 *
 * Dedupe rule: findings with the same (id) — the per-area report (02-arch, …)
 * wins over the consolidated ledger (12-consolidated) that repeats them.
 *
 * Usage:
 *   bun docs/review-system/scripts/findings.ts --run <run-id> [--prior <run-id>]
 *   bun docs/review-system/scripts/findings.ts --status [--run <run-id>]
 *
 * Zero runtime deps.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const RUNS = join(ROOT, 'docs', 'review-system', 'runs')
const args = process.argv.slice(2)

function argV(f: string, fb?: string): string | undefined {
  const i = args.indexOf(f)
  return i >= 0 && args[i + 1] ? args[i + 1] : fb
}

export interface Finding {
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  id: string // e.g. B1-1
  area: string // e.g. B1
  location: string // file:line or 'global'
  issue: string
  evidence: string
  recommendation: string
  owner: string
  sourceFile: string // which report produced it
}

const SEV_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

/** Files that are NOT report content (skip). */
function isReport(file: string): boolean {
  return (
    file.endsWith('.md') &&
    !/^(00-manifest|01-health)\.md$/.test(file) &&
    file !== 'delta.md' &&
    file !== 'RUN-BRIEF.md' &&
    file !== 'findings-summary.md' &&
    file !== 'remediation-plan.md' &&
    file !== 'REMEDIATION-BRIEF.md'
  )
}

/**
 * Derived files restate findings that originate in per-area reports. They must
 * never OWN a finding (they may only re-state it), otherwise an emptier copy
 * (e.g. triage.md carrying `-` evidence) would clobber the real row via the
 * last-writer-wins dedupe and gut the remediation brief of its insight.
 */
const DERIVED = /^(00-intake-summary|12-consolidated|13-executive-summary|triage)\./

/** Extract a `→ B3` redirect from a location cell; returns cleaned location + redirect area. */
function splitRedirect(loc: string): { location: string; redirectArea?: string } {
  const m = loc.match(/→\s*([A-Za-z0-9]+)\s*$/)
  if (!m) return { location: loc }
  return { location: loc.replace(/→\s*[A-Za-z0-9]+\s*$/, '').replace(/[·|`]/g, '').trim(), redirectArea: m[1] }
}

/** Build a Finding honoring ownership redirects (`→ AREA` re-buckets the area). */
function make(f: Omit<Finding, 'area' | 'sourceFile'> & { source: string; defaultArea: string }): Finding {
  const { location, redirectArea } = splitRedirect(f.location)
  return {
    severity: f.severity,
    id: f.id,
    area: redirectArea ?? f.defaultArea,
    location,
    issue: f.issue,
    evidence: f.evidence,
    recommendation: f.recommendation,
    owner: f.owner,
    sourceFile: f.source,
  }
}

/** Parse a report file for table + inline ledger rows. */
export function parseFindings(filePath: string, sourceFile: string): Finding[] {
  const text = readFileSync(filePath, 'utf8')
  const out: Finding[] = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()

    // table row: | P0 | id | loc | issue | ev | rec | owner |
    const t = line.match(/^\|\s*(P[0-3])\s*\|\s*([A-Za-z0-9]+-\d+)\s*\|(.*)\|$/)
    if (t) {
      const cells = raw.split('|').map((c) => c.trim()).slice(1, -1)
      // cells[0]=sev cells[1]=id cells[2]=location cells[3]=issue cells[4]=evidence cells[5]=rec cells[6]=owner
      const [sev, id, location, issue, evidence, recommendation, owner] = cells
      if (sev && /^P[0-3]$/.test(sev) && id) {
        out.push(make({
          severity: sev as Finding['severity'],
          id,
          defaultArea: id.split('-')[0] ?? id,
          location: (location ?? 'global').replace(/`/g, ''),
          issue: issue ?? '',
          evidence: evidence ?? '',
          recommendation: recommendation ?? '',
          owner: owner ?? '',
          source: sourceFile,
        }))
      }
      continue
    }

    // inline row: [P0] B1-1 · loc · issue · evidence · rec · owner
    const inl = line.match(/^\[(P[0-3])\]\s+([A-Za-z0-9]+-\d+)\s*·\s*(.*)$/)
    if (inl) {
      const parts = inl[3].split('·').map((s) => s.trim())
      const [location, issue, evidence, recommendation, owner] = parts
      const id = inl[2]!
      out.push(make({
        severity: inl[1] as Finding['severity'],
        id,
        defaultArea: id.split('-')[0] ?? id,
        location: location ?? 'global',
        issue: issue ?? '',
        evidence: evidence ?? '',
        recommendation: recommendation ?? '',
        owner: owner ?? '',
        source: sourceFile,
      }))
    }
  }

  return out
}

function runDir(id: string): string {
  return join(RUNS, id)
}

/** Extract all findings for a run, deduped (per-area report wins over consolidated). */
export function collectFindings(runId: string): Finding[] {
  const dir = runDir(runId)
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter(isReport).sort()
  const map = new Map<string, Finding>()
  for (const f of files) {
    for (const finding of parseFindings(join(dir, f), f)) {
      // derived ledger/summary/triage never overrides a per-area report's row
      if (DERIVED.test(finding.sourceFile) && map.has(finding.id)) continue
      map.set(finding.id, finding)
    }
  }
  return [...map.values()].sort((a, b) =>
    SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id),
  )
}

/** Human summary. */
export function findingsSummary(findings: Finding[]): string {
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const f of findings) counts[f.severity]++
  const lines = [
    `# Findings Summary — ${findings.length} total`,
    '',
    `P0: ${counts.P0} · P1: ${counts.P1} · P2: ${counts.P2} · P3: ${counts.P3}`,
    '',
    '| Severity | ID | Location | Issue | Recommendation | Owner |',
    '|----------|----|----------|-------|----------------|-------|',
  ]
  for (const f of findings) {
    lines.push(`| ${f.severity} | ${f.id} | \`${f.location}\` | ${f.issue} | ${f.recommendation} | ${f.owner || '—'} |`)
  }
  return lines.join('\n') + '\n'
}

// ---------- CLI ----------
const statusOnly = args.includes('--status')
const runId = argV('--run')
const priorId = argV('--prior')

if (statusOnly) {
  const id = runId ?? (readdirSync(RUNS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().pop())
  if (!id) {
    console.log('no runs found')
    process.exit(0)
  }
  const f = collectFindings(id)
  console.log(`[findings] run ${id}: ${f.length} findings (P0=${f.filter((x) => x.severity === 'P0').length})`)
  console.log(findingsSummary(f))
  process.exit(0)
}

if (!runId) {
  console.error('usage: findings.ts --run <run-id> [--prior <run-id>] | --status [--run <run-id>]')
  process.exit(1)
}

const dir = runDir(runId)
mkdirSync(dir, { recursive: true })
const findings = collectFindings(runId)

writeFileSync(join(dir, 'findings.json'), JSON.stringify(findings, null, 2))
writeFileSync(join(dir, 'findings-summary.md'), findingsSummary(findings))
console.log(`[findings] run ${runId}: ${findings.length} findings → findings.json + findings-summary.md`)

// prior-run comparison (verification loop: closed vs new)
if (priorId && priorId !== runId) {
  const prior = collectFindings(priorId)
  const priorIds = new Set(prior.map((f) => f.id))
  const nowIds = new Set(findings.map((f) => f.id))
  const closed = prior.filter((f) => !nowIds.has(f.id))
  const added = findings.filter((f) => !priorIds.has(f.id))
  const lines = [
    `# Findings Delta — ${priorId} → ${runId}`,
    '',
    `closed: ${closed.length} · new: ${added.length} · carried: ${findings.length - added.length}`,
    '',
    '## Closed (no longer reported)',
    '',
    ...(closed.map((f) => `- ${f.severity} ${f.id} · ${f.location} · ${f.issue}`) || ['None.']),
    '',
    '## New since prior run',
    '',
    ...(added.map((f) => `- ${f.severity} ${f.id} · ${f.location} · ${f.issue}`) || ['None.']),
    '',
  ]
  writeFileSync(join(dir, 'findings-delta.md'), lines.join('\n'))
  console.log(`[findings] delta vs ${priorId}: closed=${closed.length} new=${added.length} → findings-delta.md`)
}
