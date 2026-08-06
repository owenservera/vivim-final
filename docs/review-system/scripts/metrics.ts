#!/usr/bin/env bun
/**
 * VIVIM Review System — Quantitative Health Metrics (A0 part 2)
 *
 * Computes the *measurable* dashboard fields from CONSTITUTION.md so the review
 * has a deterministic, reproducible, trend-able baseline. This is a heuristic
 * static scan — it never replaces reading code; it gives the reviewer numbers
 * to reason from and to trend across runs.
 *
 * Usage:
 *   bun docs/review-system/scripts/metrics.ts [--out <path>]
 *
 * Emits <out>.json (machine) + sibling <out>.md (human table).
 * Zero runtime deps.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'

const ROOT = process.cwd()
const args = process.argv.slice(2)

function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const outArg = argValue(
  '--out',
  join(ROOT, 'docs', 'review-system', 'runs', `run-${new Date().toISOString().slice(0, 10)}`, '01-health.json'),
)

function rel(p: string): string {
  return relative(ROOT, p).replaceAll('\\', '/')
}

// ── walker (returns absolute paths) ───────────────────────────────────────────
function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.next', '.runtime', '.archive'].includes(ent.name)) continue
    const full = join(dir, ent.name)
    if (ent.isDirectory()) walk(full, exts, out)
    else if (exts.some((e) => ent.name.endsWith(e))) out.push(full)
  }
  return out
}

const SRC = join(ROOT, 'src')
const FE = join(ROOT, 'frontend')
const allCode = [...walk(SRC, ['.ts']), ...walk(FE, ['.ts', '.tsx'])].filter((f) => !/\.(test|spec)\./.test(f))

// ── per-file stat helpers ─────────────────────────────────────────────────────
function maxBraceDepth(lines: string[]): number {
  let max = 0
  let cur = 0
  for (const line of lines) {
    for (const ch of line) {
      if (ch === '{') { cur++; if (cur > max) max = cur }
      else if (ch === '}') cur = Math.max(0, cur - 1)
    }
  }
  return max
}

/** Longest contiguous non-empty "block" span as a brace-aware heuristic for function length. */
function longestBlock(lines: string[]): number {
  let best = 0
  let run = 0
  for (const line of lines) {
    const t = line.trim()
    if (t.length === 0 || t.startsWith('//')) { run = 0; continue }
    run++
    if (run > best) best = run
  }
  return best
}

// ── aggregate ─────────────────────────────────────────────────────────────────
let totalLoc = 0
const hygiene = { any: 0, tsIgnore: 0, tsExpectError: 0, nonNull: 0, todo: 0, fixme: 0 }
let largest: { file: string; lines: number } = { file: '', lines: 0 }
const deepNestingFiles: { file: string; maxDepth: number }[] = []
const longBlockFiles: { file: string; blockLoc: number }[] = []
const imports: Record<string, string[]> = {}

for (const f of allCode) {
  const text = readFileSync(f, 'utf8')
  const lines = text.split('\n')
  totalLoc += lines.length
  if (lines.length > largest.lines) largest = { file: rel(f), lines: lines.length }

  // local import edge list (for fan-in / shared-utility heuristics)
  const localImps: string[] = []
  const fromRe = /(?:from|import)\s+["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = fromRe.exec(text))) {
    const imp = m[1]!
    if (imp.startsWith('.') || imp.startsWith('@/') || imp.startsWith('~/')) localImps.push(imp)
  }
  imports[rel(f)] = localImps

  for (const line of lines) {
    if (/TODO/.test(line)) hygiene.todo++
    if (/FIXME/.test(line)) hygiene.fixme++
    if (/\bts-ignore\b/.test(line)) hygiene.tsIgnore++
    if (/\bts-expect-error\b/.test(line)) hygiene.tsExpectError++
    if (/\bany\b/.test(line) && !/\/\/|\/\*|\*/.test(line)) hygiene.any++
    if (/[.\w]!\s*[;,\])]|!\s*[;,\])]/.test(line)) hygiene.nonNull++
  }

  const depth = maxBraceDepth(lines)
  if (depth > 5) deepNestingFiles.push({ file: rel(f), maxDepth: depth })

  const block = longestBlock(lines)
  if (block > 75) longBlockFiles.push({ file: rel(f), blockLoc: block })
}

const loc = Math.max(totalLoc, 1)
const per1000 = Math.round(((hygiene.any + hygiene.tsIgnore + hygiene.tsExpectError + hygiene.nonNull) / loc) * 1000 * 100) / 100

const metrics = {
  meta: { generatedAt: new Date().toISOString(), generator: 'docs/review-system/scripts/metrics.ts' },
  scope: {
    files: allCode.length,
    totalLoc,
    avgFileLoc: Math.round(totalLoc / allCode.length),
    largestFile: largest,
  },
  typeCleanliness: {
    any: hygiene.any,
    tsIgnore: hygiene.tsIgnore,
    tsExpectError: hygiene.tsExpectError,
    nonNullAssertions: hygiene.nonNull,
    per1000Loc: per1000,
  },
  todoDebt: { todo: hygiene.todo, fixme: hygiene.fixme, total: hygiene.todo + hygiene.fixme },
  structure: {
    deepNestingOver5: deepNestingFiles,
    longBlocksOver75: longBlockFiles,
  },
  dependency: { localEdges: Object.values(imports).reduce((n, e) => n + e.length, 0) },
}

mkdirSync(dirname(outArg), { recursive: true })
writeFileSync(outArg, JSON.stringify(metrics, null, 2), 'utf8')
writeFileSync(
  outArg.replace(/\.json$/, '.md'),
  [
    '# Quantitative Health Metrics',
    '',
    `Generated: ${metrics.meta.generatedAt}`,
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Files scanned | ${metrics.scope.files} |`,
    `| Total LOC | ${metrics.scope.totalLoc} |`,
    `| Avg file LOC | ${metrics.scope.avgFileLoc} |`,
    `| Largest file | ${metrics.scope.largestFile.file} (${metrics.scope.largestFile.lines}) |`,
    `| \`any\` usages | ${metrics.typeCleanliness.any} |`,
    `| \`ts-ignore\` | ${metrics.typeCleanliness.tsIgnore} |`,
    `| \`ts-expect-error\` | ${metrics.typeCleanliness.tsExpectError} |`,
    `| Non-null assertions | ${metrics.typeCleanliness.nonNullAssertions} |`,
    `| Type-cleanliness per 1k LOC | ${metrics.typeCleanliness.per1000Loc} |`,
    `| TODO+FIXME debt | ${metrics.todoDebt.total} |`,
    `| Deep nesting (>5) files | ${metrics.structure.deepNestingOver5.length} |`,
    `| Long blocks (>75 LOC) files | ${metrics.structure.longBlocksOver75.length} |`,
    '',
    'Interpret against thresholds in `docs/review-system/CONSTITUTION.md`.',
    '',
  ].join('\n'),
  'utf8',
)

console.log(`[metrics] files=${metrics.scope.files} loc=${metrics.scope.totalLoc} any=${hygiene.any} todo=${metrics.todoDebt.total}`)
console.log(`[metrics] wrote ${outArg}`)
