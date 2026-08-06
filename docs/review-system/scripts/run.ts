#!/usr/bin/env bun
/**
 * VIVIM Review System — Self-Driving Orchestrator (the BLENDED driver)
 *
 * This is the ONLY entry point a human needs. It assumes the human remembers
 * nothing: no taxonomy, no depth tiers, no prior runs. Just run it:
 *
 *   bun docs/review-system/scripts/run.ts                  # standard depth
 *   bun docs/review-system/scripts/run.ts --depth quick    # fast triage
 *   bun docs/review-system/scripts/run.ts --resume <id>    # continue an old run
 *
 * The blended architecture it drives (three layers):
 *   L0 DETERMINISTIC — scripts: manifest + health metrics + delta.
 *        Numbers, reproducible, trend-able. Cheap, zero judgment.
 *   L1 AGENTIC       — the prompts (A0…C2): the real senior-engineer review,
 *        run by an agent against the source. Judgment, evidence, findings.
 *   L2 SYNTHESIS     — C1/C2: merges L0 numbers + L1 findings into the ledger,
 *        architecture scorecard, and the human-facing executive summary.
 *
 * BLENDING: L0 always runs first and its artifacts are injected into every
 * agentic unit. Then the driver writes a self-contained RUN-BRIEF.md — the ONE
 * file you feed to any agent. The agent reads the brief, which tells it exactly
 * which reports are missing, which prompts to run, in what order, under which
 * evidence contract. Nothing depends on the human remembering the workflow.
 *
 * Flags:
 *   --depth   quick | standard | deep   (default standard)
 *   --run-id  <id>                      (default today's date)
 *   --resume  <id>                      operate on an existing run
 *   --status                            print progress only, run nothing
 *   --brief                             regenerate RUN-BRIEF.md + state only
 *   --remediate <id>                    AFTER reports exist: run the full L3
 *                                       fix pipeline (findings → triage →
 *                                       tasks → brief)
 *   --remediate-status <id>             show remediation progress only
 *
 * Zero runtime deps (node:fs/path/child_process only).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { UNITS, unitsForDepth, validateDepth, type DepthTier } from './taxonomy.js'
import { refreshRunState, statePath, readState, type RunState } from './state.js'

const ROOT = process.cwd()
const SYS = join(ROOT, 'docs', 'review-system')
const RUNS = join(SYS, 'runs')

// ---------- arg parsing ----------
const args = process.argv.slice(2)
const argV = (f: string, fb?: string): string | undefined => {
  const i = args.indexOf(f)
  return i >= 0 && args[i + 1] ? args[i + 1] : fb
}

let depth: DepthTier
try {
  depth = validateDepth(argV('--depth', 'standard') ?? 'standard')
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
}

const statusOnly = args.includes('--status')
const briefOnly = args.includes('--brief')

const resumeId = argV('--resume')
const runId: string = resumeId ?? argV('--run-id') ?? `run-${new Date().toISOString().slice(0, 10)}`
const RUN_DIR = join(RUNS, runId)

const remediateId = argV('--remediate')
const remediateStatusId = argV('--remediate-status')

// ---------- L3 remediation dispatch (runs before L0; needs reports, not metrics) ----------
if (remediateId) {
  const rd = join(RUNS, remediateId)
  shell(`bun ${join(SYS, 'scripts', 'findings.ts')} --run ${remediateId}`)
  shell(`bun ${join(SYS, 'scripts', 'triage.ts')} --run ${remediateId}`)
  shell(`bun ${join(SYS, 'scripts', 'tasks.ts')} --run ${remediateId}`)
  shell(`bun ${join(SYS, 'scripts', 'remediate.ts')} --run ${remediateId}`)
  process.exit(0)
}
if (remediateStatusId) {
  shell(`bun ${join(SYS, 'scripts', 'remediate.ts')} --run ${remediateStatusId} --status`)
  process.exit(0)
}

// ---------- helpers ----------
function shell(cmd: string): void {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
}

function reportPath(unitId: string): string {
  const u = UNITS.find((x) => x.id === unitId)
  if (!u) return ''
  return join(RUN_DIR, u.report)
}

function reportDone(unitId: string): boolean {
  const p = reportPath(unitId)
  return existsSync(p) && readFileSync(p, 'utf8').trim().length > 0
}

function latestManifest(): string | null {
  if (!existsSync(RUNS)) return null
  return (
    readdirSync(RUNS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(RUNS, d.name, '00-manifest.json'))
      .filter((p) => existsSync(p))
      .sort()
      .pop() ?? null
  )
}

function fmtState(state: RunState): void {
  const total = state.units.length
  const done = state.units.filter((u) => u.done).length
  console.log(`\n[run ${state.runId}] depth=${state.depth}  agentic units done=${done}/${total}`)
  for (const u of state.units) console.log(`  ${u.done ? '[done]' : '[todo]'}  ${u.id}  ${u.report}`)
  console.log(`  artifacts: manifest=${state.artifacts.manifest} health=${state.artifacts.health} delta=${state.artifacts.delta}`)
}

/** Derive run-state from disk for the scoped unit list. */
function syncState(): RunState {
  return refreshRunState({
    runId,
    runDir: RUN_DIR,
    depth,
    units: unitsForDepth(depth),
    manifest: join(RUN_DIR, '00-manifest.json'),
    health: join(RUN_DIR, '01-health.json'),
    delta: join(RUN_DIR, 'delta.md'),
  })
}

/** Read manifest health + delta snippets for embedding in the brief. */
function briefContext(): { health: string; delta: string; head: string } {
  const hPath = join(RUN_DIR, '01-health.md')
  const dPath = join(RUN_DIR, 'delta.md')
  const health = existsSync(hPath) ? readFileSync(hPath, 'utf8').slice(0, 4000) : '(no health.md yet)'
  const delta = existsSync(dPath) ? readFileSync(dPath, 'utf8').slice(0, 4000) : '(no delta yet)'
  const mPath = join(RUN_DIR, '00-manifest.json')
  let head = '(unknown)'
  if (existsSync(mPath)) {
    try {
      const m = JSON.parse(readFileSync(mPath, 'utf8'))
      head = m.git?.head ?? m.head ?? '(unknown)'
    } catch {
      /* ignore */
    }
  }
  return { health, delta, head }
}

// ==================================================================
// --status : print progress only
// ==================================================================
if (statusOnly) {
  // Derive from disk, not from a stale cached run-state.json: a unit is done iff
  // its report file exists non-empty. Re-running status must reflect reality even
  // if reports were written directly.
  if (!existsSync(join(RUN_DIR, '00-manifest.json'))) {
    console.log(`no run at ${RUN_DIR}\n→ run: bun docs/review-system/scripts/run.ts --run-id ${runId}`)
    process.exit(0)
  }
  const st = syncState()
  fmtState(st)
  process.exit(0)
}

// ==================================================================
// L0 — DETERMINISTIC LAYER
// ==================================================================
const MANIFEST = join(RUN_DIR, '00-manifest.json')
const HEALTH = join(RUN_DIR, '01-health.json')
const DELTA = join(RUN_DIR, 'delta.md')

if (!briefOnly) {
  console.log(`\n=== L0 deterministic layer — ${runId} (depth=${depth}) ===`)
  mkdirSync(RUN_DIR, { recursive: true })
  shell(`bun ${join(SYS, 'scripts', 'manifest.ts')} --run-id ${runId}`)
  shell(`bun ${join(SYS, 'scripts', 'metrics.ts')} --out ${HEALTH}`)
  shell(`bun ${join(SYS, 'scripts', 'delta.ts')} --current-run ${MANIFEST}`)
}

// ==================================================================
// Run-state sync + RUN-BRIEF.md generation (self-driving contract)
// ==================================================================
const state = syncState()
const ctx = briefContext()
const missing = state.units.filter((u) => !u.done)
const todoList = missing.map((u) => `  ${u.id}  ${u.title}  → ${u.report}`).join('\n')
const doneList = state.units.filter((u) => u.done).map((u) => `  ${u.id}  ${u.report}`).join('\n')

const brief = `# RUN BRIEF — ${runId} (depth=${depth}, git @ ${ctx.head})

You are the VIVIM review agent. This brief is the ONLY instruction you need; do not
ask the human what to do. Everything you need is either here, in this directory,
or in the source tree. Execute the missing units below in order.

## How to run the review

1. Read \`docs/review-system/CONSTITUTION.md\` — the living engineering constitution:
   severity rules (P0/P1/P2/P3), health thresholds, security checklist, architecture
   scorecard axes, testing taxonomy. These are the rules you judge against.
2. Read \`docs/review-system/README.md\` for the methodology.
3. Read the deterministic inputs below (freshly generated this run):
   - \`00-manifest.json\` — inventory, git head, deps, schema, routes, tests.
   - \`01-health.json\` — quantitative health dashboard (numbers are authoritative
     for THIS run; where they conflict with the prose below, trust the JSON).
   - \`delta.md\` — changed surface vs the previous run. Pay extra attention here.
4. For EACH missing unit, in order, read its prompt file
   (\`docs/review-system/prompts/<area>/<file>.md\`), perform the analysis against
   the real source, then WRITE the report file into this directory following
   \`docs/review-system/templates/report-template.md\`.
5. Every finding is a ledger row with the MANDATORY format:
   \`[SEV] AREA-ID-<n> · file:line · one-line issue · evidence · recommendation · owner\`
6. When all scoped units are done, the \`13-executive-summary.md\` is produced by
   C2 — top risks, fix roadmap, for humans. Do not skip it.

## Run directory inputs (from L0 deterministic layer)

\`\`\`text
[manifest]  ${existsSync(MANIFEST) ? MANIFEST : '(missing)'}
[health]    ${existsSync(HEALTH) ? HEALTH : '(missing)'}
[delta]     ${existsSync(DELTA) ? DELTA : '(missing)'}
\`\`\`

### Health dashboard (abridged)
\`\`\`text
${ctx.health}
\`\`\`

### Changed surface / delta (abridged)
\`\`\`text
${ctx.delta}
\`\`\`

## Units remaining (execute these; skip ones marked done)

\`\`\`
${todoList || '  (none — all scoped units are done; verify exec summary exists)'}
\`\`\`

## Already done (do NOT redo)

\`\`\`
${doneList || '  (none yet)'}
\`\`\`

## Rules of engagement

- Never trust the manifest blindly: re-verify against source. The manifest exists
  so you start from the same ground truth, not because it is complete.
- Evidence = code ref (file:line + snippet) or a measured number. No evidence → it
  is a comment, not a finding.
- Severity is fixed. Exploitable security issue = P0; reachable = P1.
- Write reports atomically (one file per unit) so a partial run resumes cleanly.
`

mkdirSync(RUN_DIR, { recursive: true })
writeFileSync(join(RUN_DIR, 'RUN-BRIEF.md'), brief)

// ==================================================================
// Human handoff — the forgetful-user guarantee
// ==================================================================
console.log(`\n=== done preparing ${runId} ===`)
fmtState(state)

if (missing.length === 0) {
  console.log('\nAll scoped units are done. If exec summary missing, re-run C2 (deep).')
} else {
  console.log(`\nNEXT (paste into any agent — it needs NOTHING else):`)
  console.log(`\n  Review run ${runId} by reading docs/review-system/runs/${runId}/RUN-BRIEF.md and executing the missing units.`)
  console.log(`\n  (brief: docs/review-system/runs/${runId}/RUN-BRIEF.md)`)
}
