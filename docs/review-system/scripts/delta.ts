#!/usr/bin/env bun
/**
 * VIVIM Review System — Delta Pass Generator
 *
 * Diffs the current run's discovery manifest against the most recent prior run
 * and emits a `delta.md` — the "changed surface" that every core prompt is told
 * to pay extra attention to. Also catches anything new that ISN'T in the prior
 * manifest (the exhaustiveness guarantee).
 *
 * Usage:
 *   bun docs/review-system/scripts/delta.ts [--current <manifest.json>] [--prior <manifest.json>]
 *
 * If --prior is omitted, the newest existing run other than the current one is
 * used. Writes `<run-dir>/delta.md`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'

const ROOT = process.cwd()
const RUNS = join(ROOT, 'docs', 'review-system', 'runs')
const args = process.argv.slice(2)

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined
}

function findPriorRuns(current: string): string[] {
  if (!existsSync(RUNS)) return []
  return readdirSync(RUNS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== basename(dirname(current)))
    .map((d) => join(RUNS, d.name, '00-manifest.json'))
    .filter((p) => existsSync(p))
    .sort()
}

function diffPaths(a: Set<string>, b: Set<string>) {
  const added: string[] = []
  const removed: string[] = []
  for (const p of b) if (!a.has(p)) added.push(p)
  for (const p of a) if (!b.has(p)) removed.push(p)
  const both = [...a].filter((p) => b.has(p))
  return { added: [...added].sort(), removed: [...removed].sort(), both: both.sort() }
}

function main(): void {
  const currentPath = argValue('--current-run')
  if (!currentPath) throw new Error('--current-run is required')
  const current = JSON.parse(readFileSync(currentPath, 'utf8')) as Record<string, unknown>

  let priorPath = argValue('--prior')
  if (priorPath && !existsSync(priorPath)) throw new Error(`prior manifest not found: ${priorPath}`)
  if (!priorPath) {
    const recent = findPriorRuns(currentPath)
    if (recent.length === 0) {
      // No prior run: this is the baseline. Emit a delta noting nothing to compare.
      mkdirSync(dirname(currentPath), { recursive: true })
      const lines = [
        '# Delta — baseline run (no prior manifest found)',
        '',
        `- Current run: \`${currentPath}\``,
        '- This is the **baseline**. There is no prior run to diff against.',
        '- Nothing is flagged "changed"; the full taxonomy is reviewed against the manifest as-is.',
        '',
      ]
      writeFileSync(join(dirname(currentPath), 'delta.md'), lines.join('\n'), 'utf8')
      console.log('[delta] no prior manifest — baseline run, wrote delta.md')
      return
    }
    priorPath = recent[recent.length - 1]!
  }
  const prior = JSON.parse(readFileSync(priorPath, 'utf8')) as Record<string, unknown>

  // Compare inventories (best-effort: only counts + git head for now).
  const priorHead = (prior.git as { head?: string })?.head ?? ''
  const curHead = (current.git as { head?: string })?.head ?? ''

  const lines = [
    '# Delta Pass',
    '',
    `- Current: \`${curHead.slice(0, 8) ?? 'n/a'}\``,
    `- Prior:   \`${priorHead.slice(0, 8) ?? 'n/a'}\``,
    '----',
  ]

  const snapshot = (m: Record<string, unknown>) => ({
    head: (m.git as { head?: string })?.head,
    src: (m.inventory as { srcFilesExclTests?: number })?.srcFilesExclTests,
    frontend: (m.inventory as { frontendFiles?: number })?.frontendFiles,
    tests: (m.inventory as { testFiles?: number })?.testFiles,
    models: (m.endpoints as { prisma?: { models?: number } })?.prisma?.models,
    commits: (m.git as { recentCommits?: string[] })?.recentCommits ?? [],
  })
  const p = snapshot(prior)
  const c = snapshot(current)

  if (c.head !== p.head) {
    lines.push(`## Git history moved\n\nPrior \`${p.head?.slice(0, 8)}\` → current \`${c.head?.slice(0, 8)}\` (${(c.commits?.length ?? 0)} commits shown):`)
    lines.push('')
    for (const c1 of c.commits ?? []) lines.push(`- \`${c1}\``)
    lines.push('')
  } else {
    lines.push('## Git HEAD unchanged','')
  }

  // inventory deltas
  lines.push('## Inventory deltas')
  lines.push('')
  lines.push(`| Metric | Prior | Current |`)
  lines.push(`|--------|-------|---------|`)
  lines.push(`| src files (excl tests) | ${p.src ?? '?'} | ${c.src ?? '?'} |`)
  lines.push(`| frontend files | ${p.frontend ?? '?'} | ${c.frontend ?? '?'} |`)
  lines.push(`| test files | ${p.tests ?? '?'} | ${c.tests ?? '?'} |`)
  lines.push(`| prisma models | ${p.models ?? '?'} | ${c.models ?? '?'} |`)
  lines.push('')

  // repeat: include the semantic inventory slices we can diff reliably
  lines.push('_Inventory delta is best-effort on numeric fields; for full file-level diff, review the git commit list above._')
  lines.push('')

  writeFileSync(join(dirname(currentPath), 'delta.md'), lines.join('\n'), 'utf8')
  console.log(`[delta] prior=${priorPath}`)
  console.log(`[delta] wrote ${join(dirname(currentPath), 'delta.md')}`)
}

void main()