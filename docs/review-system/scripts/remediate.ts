#!/usr/bin/env bun
/**
 * VIVIM Review System — Remediation Driver (L3 · agentic-automatic)
 *
 * Self-driving fix layer. Reads remediation-state.json (from tasks.ts) and
 * writes:
 *   1. REMEDIATION-BRIEF.md — the ONE file a fix agent needs. Lists every open
 *      task in P0→P3 order with evidence, suggested fix, verification recipe,
 *      and whether it must also produce an ADR. The agent executes it, then
 *      marks tasks done/verified in remediation-state.json.
 *   2. ADR proposal (docs/decisions/ADR-<runId>-<area>.md) — when any P0/P1
 *      task has codifyAdr=true, we scaffold the best-practice ADR from the
 *      template so the fix is *codified*, not just applied.
 *
 * The full L3 pipeline (extract → plan → brief) is one command:
 *   bun docs/review-system/scripts/remediate.ts --run <run-id>
 *
 * And the verification loop is:
 *   # after the fix agent reports done:
 *   bun docs/review-system/scripts/status.ts --run <run-id>    (progress)
 *   # next review run: findings-delta.md shows closed vs new
 *
 * Flags:
 *   --run <id>        (required)
 *   --status          print remediation progress only
 *   --mark <id> <status>   advance one task (open|in_progress|done|verified|blocked|wontfix)
 *   --adr-only        only generate the ADR proposal, skip brief regen
 *   --force           regenerate brief + ADR even if unchanged
 *
 * Zero runtime deps.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { readRemediation, statePath, type FixTask, type TaskStatus } from './tasks.js'

const ROOT = process.cwd()
const RUNS = join(ROOT, 'docs', 'review-system', 'runs')
const DECISIONS = join(ROOT, 'docs', 'decisions')
const TEMPLATES = join(ROOT, 'docs', 'review-system', 'templates')
const args = process.argv.slice(2)

function argV(f: string, fb?: string): string | undefined {
  const i = args.indexOf(f)
  return i >= 0 && args[i + 1] ? args[i + 1] : fb
}

const runId = argV('--run')
const statusOnly = args.includes('--status')
const adrOnly = args.includes('--adr-only')
const markId = argV('--mark')
const markStatus = argV('--to')
const force = args.includes('--force')

if (!runId) {
  console.error('usage: remediate.ts --run <run-id> [--status] [--mark <id> --to <status>] [--adr-only] [--force]')
  process.exit(1)
}

const runDir = join(RUNS, runId)

function fmt(t: FixTask): string {
  const scopeMark = t.scope === 'future' ? '↦' : 'α'
  return `${t.status === 'verified' ? '[ok]' : t.status === 'done' ? '[done]' : t.status === 'in_progress' ? '[… ]' : '[todo]'} ${t.severity} ${t.id} ${scopeMark} ${t.scopeArea ? `→ ${t.scopeArea} ` : ''}${t.location} — ${t.issue}`
}

function printAll(state: ReturnType<typeof readRemediation>): void {
  if (!state) {
    console.log(`no remediation state for ${runId} (run tasks.ts first)`)
    return
  }
  const order: TaskStatus[] = ['open', 'in_progress', 'done', 'verified', 'blocked', 'wontfix']
  const counts = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const t of state.tasks) counts[t.severity]++
  const alpha = state.tasks.filter((t) => t.scope === 'alpha')
  const future = state.tasks.filter((t) => t.scope === 'future')
  const open = state.tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length
  const verified = state.tasks.filter((t) => t.status === 'verified').length
  const gating = alpha.filter((t) => (t.severity === 'P0' || t.severity === 'P1') && (t.status === 'open' || t.status === 'in_progress'))
  console.log(`\n[remediation ${runId}] tasks=${state.tasks.length} (P0=${counts.P0} P1=${counts.P1} P2=${counts.P2} P3=${counts.P3}) alpha=${alpha.length} future=${future.length} open=${open} verified=${verified}`)
  console.log(`  alpha gate: ${gating.length} alpha P0/P1 open ${gating.length === 0 ? '— RELEASE OK' : '— BLOCKS alpha'}`)
  const ranked = [...state.tasks].sort((a, b) => {
    const s = (x: FixTask) => order.indexOf(x.status)
    const p = (x: FixTask) => ({ P0: 0, P1: 1, P2: 2, P3: 3 })[x.severity]
    return s(a) - s(b) || p(a) - p(b)
  })
  for (const t of ranked) console.log(fmt(t))
}

// ---------- --status ----------
if (statusOnly) {
  printAll(readRemediation(runDir))
  process.exit(0)
}

// ---------- --mark ----------
if (markId && markStatus) {
  const state = readRemediation(runDir)
  if (!state) {
    console.error(`no state for ${runId}`)
    process.exit(1)
  }
  const t = state.tasks.find((x) => x.id === markId || x.findingId === markId)
  if (!t) {
    console.error(`task ${markId} not found`)
    process.exit(1)
  }
  const valid: TaskStatus[] = ['open', 'in_progress', 'done', 'verified', 'blocked', 'wontfix']
  if (!valid.includes(markStatus as TaskStatus)) {
    console.error(`invalid status ${markStatus} (${valid.join('|')})`)
    process.exit(1)
  }
  t.status = markStatus as TaskStatus
  state.updatedAt = new Date().toISOString()
  writeFileSync(statePath(runDir), JSON.stringify(state, null, 2))
  console.log(`[remediate] ${t.id} → ${markStatus}`)
  process.exit(0)
}

// ---------- build brief ----------
const state = readRemediation(runDir)
if (!state) {
  console.error(`no remediation state for ${runId} — run: bun docs/review-system/scripts/tasks.ts --run ${runId}`)
  process.exit(1)
}

const openTasks = state.tasks
  .filter((t) => t.status === 'open' || t.status === 'in_progress')
  .sort((a, b) => ({ P0: 0, P1: 1, P2: 2, P3: 3 })[a.severity] - ({ P0: 0, P1: 1, P2: 2, P3: 3 })[b.severity])

// ALPHA gate: the tasks that must be done before the alpha launch.
// Only alpha-in-scope P0/P1 gate; future tasks are tracked, not built.
const alphaTasks = openTasks.filter((t) => t.scope !== 'future')
const futureTasks = openTasks.filter((t) => t.scope === 'future')
const gating = alphaTasks.filter((t) => t.severity === 'P0' || t.severity === 'P1')

const sevIcon = (s: string) => ({ P0: '🔴', P1: '🟠', P2: '🟡', P3: '⚪' })[s] ?? '·'
const taskLines = alphaTasks.map((t) => {
  const verif = t.verification.map((v) => `    - verify: \`${v}\``).join('\n')
  const adr = t.codifyAdr && t.scope !== 'future' ? `\n    ⚖ codify as ADR (best practice)` : ''
  return `### ${sevIcon(t.severity)} ${t.id} — [${t.severity}] ${t.area}\n` +
    `Location: \`${t.location}\`\n` +
    `Issue: ${t.issue}\n` +
    `Evidence: ${t.evidence}\n` +
    `Suggested fix: ${t.suggestedFix}\n` +
    `Effort: ${'·'.repeat(t.effort)} (${t.effort}/5) · Owner: ${t.owner}\n` +
    `${verif}${adr}\n`
}).join('\n')
const futureLines = futureTasks.map((t) => {
  return `- [${t.severity}] ${t.id} · \`${t.location}\` — ${t.issue} \`(${t.scopeArea ?? 'future'})\``
}).join('\n')

const gateLine = gating.length === 0
  ? '✅ No alpha P0/P1 fix tasks are open — the alpha release is not gated by remediation.'
  : `🔴 ${gating.length} alpha P0/P1 task${gating.length === 1 ? '' : 's'} gate alpha. All must reach \`verified\` before launch.`

const brief = `# REMEDIATION BRIEF — run ${runId}

You are the VIVIM fix agent. Apply the fixes below in order. You do
NOT need the human or the review reports — everything is in this file and in the
source tree. After each fix, run its verification recipe; only then mark the task
\`done\`, then \`verified\` when the recipe passed.

## Alpha scope (the ONLY things you build)

Scope comes from \`SCOPE.md\` (default-in, flag-out), applied deterministically by
\`triage.ts\`. **This brief lists only alpha-in-scope tasks.** Future / out-of-scope
tasks are tracked in the "Future ledger" below but are NOT to be implemented now —
they are valid placeholders for a local-first alpha and get no implementation time.

${gateLine}

## How to mark progress

    bun docs/review-system/scripts/remediate.ts --run ${runId} --mark <id> --to in_progress
    # …implement the fix, run verification…
    bun docs/review-system/scripts/remediate.ts --run ${runId} --mark <id> --to done
    # verification passed:
    bun docs/review-system/scripts/remediate.ts --run ${runId} --mark <id> --to verified

## Rules

- Evidence-driven: cite \`file:line\` in your change notes. Don't fix by vibes.
- Do not rewrite for the sake of rewriting — the verification recipe is the gate.
- Do NOT implement anything in the Future Ledger. It ships later, not in alpha.
- \`codifyAdr\` tasks must ALSO produce/update the ADR in \`docs/decisions/\`
  (see \`docs/review-system/templates/adr-template.md\`). Best practice is
  codified, never just applied once.
- When done, the run is re-reviewed: findings that stay open get re-filed.

## Alpha-in-scope fix tasks (${alphaTasks.length}; gating = ${gating.length})

${taskLines || 'None open — all alpha tasks are done or verified.'}

## Future ledger (tracked, do NOT implement now) — ${futureTasks.length}

These fall in a flagged out-of-scope area (see \`SCOPE.md\`). They are documented
so nothing is lost, but they never gate alpha and get no implementation time now.
Placeholders are acceptable so long as they do not break alpha.

${futureLines || '_None._'}

## Summary for the exec report

When all alpha P0/P1 tasks are \`verified\`, summarize: what changed, which metrics
moved, which ADRs were created. Write it to \`docs/review-system/runs/${runId}/13-executive-summary.md\`
(appending a "Remediation" section). Also append the future-ledger items to the
out-of-scope register note in \`SCOPE.md\` if any need re-flagging.
`

mkdirSync(runDir, { recursive: true })
writeFileSync(join(runDir, 'REMEDIATION-BRIEF.md'), brief)

// ---------- ADR proposals ----------
if (!adrOnly) {
  // generate ADR proposals for any P0/P1 task with codifyAdr that doesn't yet have one
  const adrTasks = state.tasks.filter((t) => t.codifyAdr && (t.severity === 'P0' || t.severity === 'P1'))
  mkdirSync(DECISIONS, { recursive: true })
  const existing = existsSync(DECISIONS) ? readdirSync(DECISIONS).filter((f) => f.endsWith('.md') && /^ADR-\d+/.test(f)) : []
  let nextNum = existing.length ? Math.max(...existing.map((f) => parseInt(f.match(/ADR-(\d+)/)?.[1] ?? '0', 10))) + 1 : 1

  for (const t of adrTasks) {
    const fname = `ADR-${String(nextNum).padStart(3, '0')}-${runId}-${t.area}.md`
    const fpath = join(DECISIONS, fname)
    if (existsSync(fpath) && !force) continue
    const slug = t.issue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
    const content = `# ADR-${String(nextNum).padStart(3, '0')}: ${slug}\n\n` +
      `**Status:** PROPOSED\n` +
      `**Date:** ${new Date().toISOString().slice(0, 10)}\n` +
      `**Author:** review-system (run ${runId})\n` +
      `**Finding:** ${t.id} ([${t.severity}] ${t.location})\n\n` +
      `## Problem Statement\n\n${t.issue}\n\n` +
      `## Evidence\n\n${t.evidence}\n\n` +
      `## Proposed Approach\n\n${t.suggestedFix}\n\n` +
      `## Verification\n\n${t.verification.map((v) => `- \`${v}\``).join('\n')}\n\n` +
      `## Open Questions\n\n- (to be filled by implementer)\n\n` +
      `## Review History\n\n[No reviews yet]\n`
    writeFileSync(fpath, content)
    console.log(`[remediate] ADR proposed: ${basename(fpath)}`)
    nextNum++
  }
}

console.log(`\n[remediate] run ${runId}: ${alphaTasks.length} alpha + ${futureTasks.length} future (tracked) open → REMEDIATION-BRIEF.md`)
printAll(state)
console.log(`\nNEXT: feed docs/review-system/runs/${runId}/REMEDIATION-BRIEF.md to the fix agent.`)
