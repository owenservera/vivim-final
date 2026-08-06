#!/usr/bin/env bun
/**
 * VIVIM Review System — Remediation Task Builder (L3)
 *
 * Converts extracted findings (findings.json) into tracked fix tasks
 * (remediation-state.json). Each task carries: severity, area, location, the
 * issue, a proposed fix, a VERIFICATION recipe (how the agent proves it fixed
 * it), an owner, and a status that the remediation driver advances.
 *
 * Status machine (advanced by remediate.ts / the fix agent):
 *   open → in_progress → done → verified
 *   open → wontfix | blocked
 *
 * A task is only "verified" when its verification recipe passes. This is what
 * closes the loop: findings → work → fix → proof → next run shows it closed.
 *
 * Usage:
 *   bun docs/review-system/scripts/tasks.ts --run <run-id> [--auto-verify]
 *
 * Zero runtime deps.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const RUNS = join(ROOT, 'docs', 'review-system', 'runs')
const args = process.argv.slice(2)

function argV(f: string, fb?: string): string | undefined {
  const i = args.indexOf(f)
  return i >= 0 && args[i + 1] ? args[i + 1] : fb
}

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'verified' | 'blocked' | 'wontfix'

export interface FixTask {
  id: string // e.g. FIX-B1-1
  findingId: string
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  area: string
  title: string
  location: string
  issue: string
  evidence: string
  suggestedFix: string
  /** how the agent proves the fix landed (command, test, metric, or code ref) */
  verification: string[]
  owner: string
  status: TaskStatus
  /** 1 (trivial) … 5 (large refactor) */
  effort: 1 | 2 | 3 | 4 | 5
  /** whether fixing this should also produce an ADR / best-practice doc */
  codifyAdr: boolean
  /** alpha = gate the release; future = tracked, NO implementation time (see SCOPE.md) */
  scope: 'alpha' | 'future'
  /** the SCOPE.md area slug that flagged this as future (null when alpha) */
  scopeArea: string | null
  note?: string
}

export interface RemediationState {
  runId: string
  updatedAt: string
  tasks: FixTask[]
}

export function statePath(runDir: string): string {
  return join(runDir, 'remediation-state.json')
}

export function readRemediation(runDir: string): RemediationState | null {
  const p = statePath(runDir)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as RemediationState
  } catch {
    return null
  }
}

/** Best-effort verification recipe per area/severity. */
function verifyRecipe(f: { severity: string; area: string; location: string }): string[] {
  const recipes: string[] = []
  if (/\.test\.|\.spec\.|tests\//.test(f.location)) {
    recipes.push(`bun test ${f.location}`)
  }
  if (/\.tsx?$/.test(f.location)) {
    recipes.push('bun run typecheck (targeted: typecheck the touched file)')
  }
  if (f.area === 'B5') recipes.push('re-run security scan: grep for the removed pattern in the repo')
  if (f.area === 'B9') recipes.push('re-run metrics: confirm the hot path / block is gone or bounded')
  if (f.severity === 'P0' || f.severity === 'P1') {
    recipes.push(`re-run review findings: ${f.location} no longer reported`)
  }
  if (recipes.length === 0) recipes.push('manual re-review of the changed lines (diff review)')
  return recipes
}

/** Map a finding to a FixTask. Customization per area happens here (single source). */
export function buildTask(f: {
  id: string
  severity: 'P0' | 'P1' | 'P2' | 'P3'
  area: string
  location: string
  issue: string
  evidence: string
  recommendation: string
  owner: string
  scope?: 'alpha' | 'future'
  scopeArea?: string | null
}): FixTask {
  const sevRank = { P0: 0, P1: 1, P2: 2, P3: 3 }[f.severity]
  const effort: FixTask['effort'] = f.severity === 'P0' ? 2 : sevRank <= 2 ? 2 : sevRank === 2 ? 3 : 4
  const codifyAdr = (f.severity === 'P0' || f.severity === 'P1' || f.area === 'B1' || f.area === 'B2') && f.scope !== 'future'
  return {
    id: `FIX-${f.id}`,
    findingId: f.id,
    severity: f.severity,
    area: f.area,
    title: f.issue.length > 90 ? `${f.issue.slice(0, 87)}…` : f.issue,
    location: f.location,
    issue: f.issue,
    evidence: f.evidence,
    suggestedFix: f.recommendation,
    verification: verifyRecipe(f),
    owner: f.owner || 'backend',
    status: 'open',
    effort,
    codifyAdr,
    scope: f.scope ?? 'alpha',
    scopeArea: f.scopeArea ?? null,
  }
}

/**
 * (Re)build remediation-state.json from findings.json, preserving task statuses.
 * Stamps alpha/future scope from triage.json (written by triage.ts). Without a
 * triage.json every finding stays alpha-in-scope (fail toward launch).
 */
export function buildRemediationState(runId: string, runDir: string): RemediationState {
  const findingsPath = join(runDir, 'findings.json')
  if (!existsSync(findingsPath)) {
    throw new Error(`findings.json not found in ${runDir} — run findings.ts first`)
  }
  const findings = JSON.parse(readFileSync(findingsPath, 'utf8')) as Array<Parameters<typeof buildTask>[0]>
  const prior = readRemediation(runDir)
  const priorById = new Map((prior?.tasks ?? []).map((t) => [t.id, t]))

  // scope from triage.ts (deterministic alpha/future classification)
  const triagePath = join(runDir, 'triage.json')
  const triageByFinding = new Map<string, { scope: 'alpha' | 'future'; scopeArea: string | null }>()
  if (existsSync(triagePath)) {
    try {
      const triage = JSON.parse(readFileSync(triagePath, 'utf8')) as { rows: Array<{ id: string; scope: 'alpha' | 'future'; scopeArea: string | null }> }
      for (const r of triage.rows ?? []) triageByFinding.set(r.id, { scope: r.scope, scopeArea: r.scopeArea })
    } catch {
      /* malformed triage → fail toward alpha */
    }
  }

  const tasks = findings.map((f) => {
    const t = triageByFinding.get(f.id)
    const fresh = buildTask({ ...f, scope: t?.scope, scopeArea: t?.scopeArea })
    const old = priorById.get(fresh.id)
    return old ? { ...fresh, status: old.status, note: old.note } : fresh
  })

  // carry over tasks that no longer have a finding (were fixed at report level)
  const currentIds = new Set(tasks.map((t) => t.id))
  for (const old of prior?.tasks ?? []) {
    if (!currentIds.has(old.id) && old.status !== 'verified' && old.status !== 'wontfix') {
      tasks.push({ ...old, note: `${old.note ?? ''}\n⚠ finding no longer in findings.json — likely fixed upstream.`.trim() })
    }
  }

  const state: RemediationState = { runId, updatedAt: new Date().toISOString(), tasks }
  mkdirSync(runDir, { recursive: true })
  writeFileSync(statePath(runDir), JSON.stringify(state, null, 2))
  return state
}

// ---------- CLI ----------
const runId = argV('--run')
if (!runId) {
  console.error('usage: tasks.ts --run <run-id>')
  process.exit(1)
}
const runDir = join(RUNS, runId)
const state = buildRemediationState(runId, runDir)
const open = state.tasks.filter((t) => t.status === 'open')
const p0 = state.tasks.filter((t) => t.severity === 'P0')
const p1 = state.tasks.filter((t) => t.severity === 'P1')
const alpha = state.tasks.filter((t) => t.scope === 'alpha')
const future = state.tasks.filter((t) => t.scope === 'future')
console.log(`[tasks] run ${runId}: ${state.tasks.length} tasks (P0=${p0.length} P1=${p1.length} open=${open.length}) alpha=${alpha.length} future=${future.length}`)
console.log(`[tasks] wrote remediation-state.json`)
