#!/usr/bin/env bun
/**
 * VIVIM Review System — Discovery Manifest Generator (A0)
 *
 * Regenerates a machine-readable snapshot of the codebase at the start of every
 * review run. This is the "exhaustiveness engine": the manifest is NEVER
 * treated as complete by reviewers — it exists so a fresh agent always starts
 * from the same ground truth and so consecutive runs can be diffed (delta pass).
 *
 * Usage:
 *   bun docs/review-system/scripts/manifest.ts [--out <path>] [--run-id <id>]
 *
 * Outputs <out>.json (machine) and a sibling <out>.md (human readable).
 * Zero runtime deps.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const args = process.argv.slice(2)

function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

// ── recursive walker ──────────────────────────────────────────────────────────
function walk(dir: string, exts: string[], out: string[] = [], base = dir): string[] {
  if (!existsSync(dir)) return out
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.next', '.runtime', '.archive'].includes(ent.name)) continue
    const full = join(dir, ent.name)
    if (ent.isDirectory()) walk(full, exts, out, base)
    else if (exts.includes('*') || exts.some((e) => ent.name.endsWith(e))) out.push(relative(base, full).replaceAll('\\', '/'))
  }
  return out
}

function shell(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim()
  } catch {
    return ''
  }
}

function countByExt(path: string, exts: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of walk(path, exts)) {
    const e = f.slice(f.lastIndexOf('.')).toLowerCase()
    out[e] = (out[e] ?? 0) + 1
  }
  return out
}

function filesExclTests(path: string, exts: string[]): number {
  return walk(path, exts).filter((f) => !/\.(test|spec)\./.test(f)).length
}

function filesTestsOnly(path: string, exts: string[]): number {
  return walk(path, exts).filter((f) => /\.(test|spec)\./.test(f)).length
}

function topLevelDirs(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

function entryPoints(): Record<string, string> {
  const candidates = [
    'src/index.ts',
    'src/cli/index.ts',
    'src/server/index.ts',
    'src/server/entry.ts',
    'src/main.ts',
    'frontend/src/app/page.tsx',
    'frontend/src/app/layout.tsx',
  ]
  const out: Record<string, string> = {}
  for (const c of candidates) out[c] = existsSync(join(ROOT, c)) ? 'present' : 'missing'
  return out
}

function prismaModels(schemaPath: string): { models: number; enums: number } {
  if (!existsSync(schemaPath)) return { models: 0, enums: 0 }
  const text = readFileSync(schemaPath, 'utf8')
  return {
    models: (text.match(/^model\s+\w+/gm) ?? []).length,
    enums: (text.match(/^enum\s+\w+/gm) ?? []).length,
  }
}

function packageDeps(): { deps: number; devDeps: number; scripts: number; runtime: string[] } {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  return {
    deps: Object.keys(pkg.dependencies ?? {}).length,
    devDeps: Object.keys(pkg.devDependencies ?? {}).length,
    scripts: Object.keys(pkg.scripts ?? {}).length,
    runtime: Object.keys(pkg.dependencies ?? {}).sort(),
  }
}

function collectRoutes(): string[] {
  const dir = join(ROOT, 'src', 'server')
  if (!existsSync(dir)) return []
  const routes = new Set<string>()
  for (const f of walk(dir, ['.ts'])) {
    const text = readFileSync(join(dir, f), 'utf8')
    for (const m of text.matchAll(/["'`](\/api\/[A-Za-z0-9/_.:-]*)["'`]/g)) routes.add(m[1]!)
    for (const m of text.matchAll(/\b(?:get|post|put|patch|delete|all)\s*\(\s*["'`](\/[^"'`]+)["'`]/g)) routes.add(m[1]!)
  }
  return [...routes].sort()
}

// ── top-level definitions used by main ────────────────────────────────────────
const runId = argValue('--run-id', `run-${new Date().toISOString().slice(0, 10)}`)
const outPath = argValue(
  '--out',
  join(ROOT, 'docs', 'review-system', 'runs', runId, '00-manifest.json'),
)

const srcDir = join(ROOT, 'src')
const feDir = join(ROOT, 'frontend')
const tstDir = join(ROOT, 'tests')
const schemaPath = join(ROOT, 'prisma', 'schema.prisma')

async function main(): Promise<void> {
  const manifest = {
    meta: {
      generatedAt: new Date().toISOString(),
      generator: 'docs/review-system/scripts/manifest.ts',
      runId,
    },
    git: {
      head: shell('git rev-parse HEAD') || 'n/a',
      branch: shell('git rev-parse --abbrev-ref HEAD') || 'n/a',
      recentCommits: shell('git log --oneline -8').split('\n').filter(Boolean),
      dirty: shell('git status --porcelain').split('\n').filter(Boolean).length > 0,
    },
    inventory: {
      srcFilesExclTests: filesExclTests(srcDir, ['.ts']),
      srcByExt: countByExt(srcDir, ['.ts']),
      frontendFiles: filesExclTests(feDir, ['.ts', '.tsx']),
      frontendByExt: countByExt(feDir, ['.ts', '.tsx']),
      testFiles: filesTestsOnly(tstDir, ['.ts']),
      srcTopLevelDirs: topLevelDirs(srcDir),
    },
    endpoints: {
      prisma: prismaModels(schemaPath),
      packageDeps: packageDeps(),
      routes: collectRoutes(),
      entryPoints: entryPoints(),
    },
  }

  // write JSON + markdown siblings
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8')
  writeFileSync(
    outPath.replace(/\.json$/, '.md'),
    [
      `# Discovery Manifest — ${runId}`,
      '',
      `Generated: ${manifest.meta.generatedAt}`,
      `Git: \`${manifest.git.head.slice(0, 8)}\` on \`${manifest.git.branch}\`${manifest.git.dirty ? ' (dirty)' : ''}`,
      '',
      '## Inventory',
      `- src TS files (excl tests): ${manifest.inventory.srcFilesExclTests}`,
      `- frontend TS/TSX files: ${manifest.inventory.frontendFiles}`,
      `- test files: ${manifest.inventory.testFiles}`,
      `- Prisma models: ${manifest.endpoints.prisma.models}, enums: ${manifest.endpoints.prisma.enums}`,
      `- Runtime deps: ${manifest.endpoints.packageDeps.deps}, devDeps: ${manifest.endpoints.packageDeps.devDeps}, scripts: ${manifest.endpoints.packageDeps.scripts}`,
      '',
      '## src top-level dirs',
      manifest.inventory.srcTopLevelDirs.map((d) => `- ${d}`).join('\n'),
      '',
      '## Routes (best-effort scrape)',
      manifest.endpoints.routes.map((r) => `- \`${r}\``).join('\n') || '_none detected_',
      '',
    ].join('\n'),
    'utf8',
  )

  console.log(`[manifest] run-id=${runId}`)
  console.log(`[manifest] wrote ${outPath}`)
  console.log(`[manifest] src excl tests: ${manifest.inventory.srcFilesExclTests} files`)
  console.log(`[manifest] prisma models=${manifest.endpoints.prisma.models}`)
}

void main()
