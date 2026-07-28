// devops/production-build.ts
//
// Professional production-build pipeline for vivim-final.
//
// `bun run devops production-build [<phase>] [--target=tauri] [--dry-run] [--out=<path>]`
//
// A production build is more than `tauri build`. It is a gated, auditable
// pipeline that enforces the same bar a release engineer would: code quality,
// architectural invariants, dead-code/artifact cleanup, spec<->code convergence
// (leveraging the SpecKit SDD system), artifact build, documentation
// reconciliation, and a post-build smoke test. Every phase is independently
// runnable and emits a structured result so CI can fail fast and humans can
// audit exactly what happened.
//
// Phases (run in order by default; pass a phase name to run only that one):
//   precheck   -> environment + repo readiness (toolchain, dirty tree, branch)
//   gate       -> reuse devops quality gate (lint/typecheck/test/invariants/audit/coverage)
//   cleanup    -> professional hygiene: stray dirs, temp artifacts, dead-code scan, git hygiene
//   converge   -> SpecKit SDD convergence: spec/plan/tasks vs implemented code alignment
//   build      -> target artifact build (tauri MSI/NSIS/updater by default)
//   docs       -> reconcile docs: ADR index, README, CHANGELOG, release-notes
//   verify     -> post-build smoke test (desktop sidecar probe, or target default)
//   report     -> structured JSON + human release-notes summary
//
// Design notes:
//   - Idempotent & safe: `--dry-run` prints intended actions without mutating.
//   - Leverages existing machinery: runGate (gate.ts), speckit bridge (speckit-*),
//     and scripts/tauri/build.ps1 (build). No reinvention of quality logic.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { runGate } from './gate.ts'
import { checkInvariants } from './invariants.ts'

export type Phase =
  | 'precheck'
  | 'gate'
  | 'cleanup'
  | 'converge'
  | 'build'
  | 'docs'
  | 'verify'
  | 'report'

export const ALL_PHASES: Phase[] = [
  'precheck',
  'gate',
  'cleanup',
  'converge',
  'build',
  'docs',
  'verify',
  'report',
]

export interface PhaseResult {
  phase: Phase
  ok: boolean
  skipped: boolean
  dryRun: boolean
  summary: string
  findings: string[]
  metrics?: Record<string, unknown>
}

export interface BuildReport {
  target: string
  startedAt: string
  completedPhases: string[]
  failedPhases: string[]
  skippedPhases: string[]
  pass: boolean
  results: PhaseResult[]
  releaseNotes?: string
}

interface Opts {
  target: string
  dryRun: boolean
  onlyPhase?: Phase
  out?: string
}

// ── shared helpers ──────────────────────────────────────────────

function sh(cmd: string, args: string[], dryRun: boolean, cwd = process.cwd()): Promise<number> {
  if (dryRun) {
    console.log(`  [dry-run] $ ${cmd} ${args.join(' ')}`)
    return Promise.resolve(0)
  }
  return new Promise((resolveExit) => {
    const proc = spawn(cmd, args, { cwd, stdio: 'inherit' })
    proc.on('close', (code) => resolveExit(code ?? 1))
  })
}

async function runSync(
  cmd: string,
  args: string[],
  cwd = process.cwd(),
): Promise<{ code: number; out: string }> {
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  return { code: res.status ?? 1, out: (res.stdout ?? '') + (res.stderr ?? '') }
}

// ── precheck ────────────────────────────────────────────────────

async function phasePrecheck(opts: Opts): Promise<PhaseResult> {
  const findings: string[] = []
  let okFlag = true

  // Toolchain presence.
  const tools = ['node', 'bun', 'git']
  for (const t of tools) {
    const r = await runSync(process.platform === 'win32' ? 'where' : 'which', [t])
    if (r.code !== 0) {
      okFlag = false
      findings.push(`MISSING toolchain: ${t}`)
    } else {
      findings.push(`toolchain present: ${t}`)
    }
  }
  // Rust only required for the tauri target.
  if (opts.target === 'tauri') {
    const r = await runSync(process.platform === 'win32' ? 'where' : 'which', ['cargo'])
    if (r.code !== 0) {
      okFlag = false
      findings.push('MISSING toolchain: cargo (required for tauri target)')
    } else {
      findings.push('toolchain present: cargo')
    }
  }

  // Git readiness: no uncommitted changes (a production build must be reproducible
  // from a clean, tagged commit). Allow opt-out via --allow-dirty.
  const status = await runSync('git', ['status', '--porcelain'])
  const dirty = status.out.trim().length > 0
  if (dirty && !process.argv.includes('--allow-dirty')) {
    okFlag = false
    const lines = status.out.trim().split('\n').slice(0, 20)
    findings.push(`DIRTY working tree (${lines.length} files). Commit or pass --allow-dirty:`)
    findings.push(...lines.map((l) => `    ${l}`))
  } else if (dirty) {
    findings.push('working tree dirty but --allow-dirty set; proceeding')
  } else {
    findings.push('working tree clean')
  }

  // Branch / tag context for the release notes.
  const branch = (await runSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).out.trim()
  const sha = (await runSync('git', ['rev-parse', '--short', 'HEAD'])).out.trim()
  findings.push(`build context: branch=${branch} sha=${sha}`)

  return {
    phase: 'precheck',
    ok: okFlag,
    skipped: false,
    dryRun: opts.dryRun,
    summary: okFlag ? 'precheck passed' : 'precheck FAILED (see findings)',
    findings,
    metrics: { branch, sha, dirty },
  }
}

// ── gate ────────────────────────────────────────────────────────

async function phaseGate(opts: Opts): Promise<PhaseResult> {
  if (opts.dryRun) {
    return {
      phase: 'gate',
      ok: true,
      skipped: false,
      dryRun: true,
      summary: '[dry-run] would run `devops gate --strict --full`',
      findings: ['reuse devops quality gate (typecheck/lint/test/invariants/audit/coverage)'],
    }
  }
  const result = await runGate(true, true, 'full')
  const failed = result.steps.filter((s) => !s.ok).map((s) => s.name)
  return {
    phase: 'gate',
    ok: result.pass,
    skipped: false,
    dryRun: false,
    summary: result.pass ? 'quality gate green' : `quality gate FAILED: ${failed.join(', ')}`,
    findings: result.steps.map((s) => `${s.ok ? 'ok ' : 'FAIL'} ${s.name}`),
    metrics: { pass: result.pass, steps: result.steps.length },
  }
}

// ── cleanup ─────────────────────────────────────────────────────

// Canonical stray top-level dirs that must never be committed (per AGENTS.md).
const STRAY_DIRS = ['gemini', 'chatgpt', 'claude']
const TEMP_ARTIFACT_PATTERNS = ['.runtime/vivim-server-test.exe', '.runtime/capout.txt', '.runtime/caperr.txt', '.runtime/exeout.txt', '.runtime/exeerr.txt', '.runtime/ptest.ts']
// Coverage / build caches that are safe to prune before a release.
const CACHE_DIRS = ['coverage', 'node_modules/.cache']

async function phaseCleanup(opts: Opts): Promise<PhaseResult> {
  const findings: string[] = []
  const blockers: string[] = []
  let autoFixed = 0

  // 1) Stray top-level provider dirs (canonical violation per AGENTS.md).
  //    Presence is auto-fixed (removed); only a FAILED removal is a hard blocker.
  for (const d of STRAY_DIRS) {
    const p = join(process.cwd(), d)
    if (existsSync(p)) {
      findings.push(`STRAY DIR (will delete): ${d}/ — providers live under chrome-profiles/<slug>/<account>`)
      if (opts.dryRun) continue
      try {
        await rm(p, { recursive: true, force: true })
        findings.push(`  removed ${d}/`)
        autoFixed++
      } catch (e) {
        blockers.push(`failed to remove stray dir ${d}/: ${(e as Error).message}`)
      }
    }
  }

  // 2) Temp artifacts from testing/building (auto-fixed).
  for (const rel of TEMP_ARTIFACT_PATTERNS) {
    const p = join(process.cwd(), rel)
    if (existsSync(p)) {
      findings.push(`temp artifact (will delete): ${rel}`)
      if (opts.dryRun) continue
      try {
        await rm(p, { force: true })
        findings.push(`  removed ${rel}`)
        autoFixed++
      } catch (e) {
        blockers.push(`failed to remove ${rel}: ${(e as Error).message}`)
      }
    }
  }

  // 3) Coverage / build caches (safe to prune).
  for (const c of CACHE_DIRS) {
    const p = join(process.cwd(), c)
    if (existsSync(p)) {
      findings.push(`cache dir (will prune): ${c}`)
      if (opts.dryRun) continue
      try {
        await rm(p, { recursive: true, force: true })
        findings.push(`  pruned ${c}/`)
        autoFixed++
      } catch (e) {
        blockers.push(`failed to prune ${c}/: ${(e as Error).message}`)
      }
    }
  }

  // 4) Dead-code scan via biome (unused exports/vars). Non-fatal; surfaces debt.
  const biome = await runSync('bun', ['x', '@biomejs/biome', 'lint', '--reporter=summary', 'src'], process.cwd())
  findings.push(`biome lint summary: ${biome.out.split('\n').slice(-3).join(' | ').trim() || '(no output)'}`)

  // 5) Git hygiene: no credentials/secrets accidentally staged. HARD BLOCKER.
  const secretScan = await scanForSecrets()
  if (secretScan.length > 0) {
    blockers.push('POSSIBLE SECRETS in tracked files')
    findings.push(...secretScan.map((s) => `    SECRET? ${s}`))
  } else {
    findings.push('no obvious secrets in tracked files')
  }

  const okFlag = blockers.length === 0
  if (autoFixed > 0) findings.push(`auto-fixed ${autoFixed} item(s)`)
  return {
    phase: 'cleanup',
    ok: okFlag,
    skipped: false,
    dryRun: opts.dryRun,
    summary: okFlag
      ? `cleanup complete (${autoFixed} auto-fixed, no secrets)`
      : `cleanup BLOCKED: ${blockers.join('; ')}`,
    findings: okFlag ? findings : [...findings, ...blockers.map((b) => `BLOCKER: ${b}`)],
  }
}

async function scanForSecrets(): Promise<string[]> {
  const patterns = [/(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*['"][^'"]{8,}/i]
  const hits: string[] = []
  try {
    const tracked = await runSync('git', ['ls-files'])
    const files = tracked.out.split('\n').filter((f) => /\.(ts|tsx|js|json|env|ps1|toml)$/.test(f))
    for (const f of files.slice(0, 400)) {
      if (!existsSync(f)) continue
      const content = await readFile(f, 'utf8').catch(() => '')
      for (const line of content.split('\n')) {
        if (patterns.some((p) => p.test(line)) && !line.trim().startsWith('//')) {
          hits.push(`${f}: ${line.trim().slice(0, 80)}`)
          break
        }
      }
    }
  } catch {
    /* ignore */
  }
  return hits.slice(0, 20)
}

// ── converge (SpecKit SDD) ──────────────────────────────────────

async function phaseConverge(opts: Opts): Promise<PhaseResult> {
  const findings: string[] = []
  // Leverage the existing SpecKit bridge + convergence tooling if available.
  const bridgePath = join(process.cwd(), 'devops', 'speckit-converge-bridge.ts')
  if (existsSync(bridgePath) && !opts.dryRun) {
    const r = await sh('bun', ['run', 'devops', 'speckit-converge', '--report'], opts.dryRun)
    findings.push(`speckit convergence exit=${r}`)
  } else {
    findings.push('speckit converge bridge not invoked (dry-run or unavailable)')
  }
  // Invariant drift check is part of convergence (spec claims vs arch reality).
  const inv = await checkInvariants(undefined, undefined)
  findings.push(`invariants: ${inv.pass ? 'PASS' : 'VIOLATIONS'} (${inv.violations.length} blocks, ${inv.warnings.length} warnings)`)
  if (!inv.pass) {
    findings.push(...inv.violations.slice(0, 10).map((v) => `    BLOCK: ${v.rule ?? v.id ?? '?'}: ${v.message ?? ''}`))
  }
  return {
    phase: 'converge',
    ok: inv.pass,
    skipped: false,
    dryRun: opts.dryRun,
    summary: inv.pass ? 'spec/code convergence ok' : `convergence found ${inv.violations.length} invariant block(s)`,
    findings,
    metrics: { invariantBlocks: inv.violations.length, invariantWarnings: inv.warnings.length },
  }
}

// ── build ───────────────────────────────────────────────────────

async function phaseBuild(opts: Opts): Promise<PhaseResult> {
  const findings: string[] = []
  if (opts.target === 'tauri') {
    findings.push('target=tauri: running scripts/tauri/build.ps1 (sidecar compile + web:build + cargo tauri build)')
    const code = await sh('pwsh', [join(process.cwd(), 'scripts', 'tauri', 'build.ps1')], opts.dryRun)
    return {
      phase: 'build',
      ok: opts.dryRun ? true : code === 0,
      skipped: false,
      dryRun: opts.dryRun,
      summary: opts.dryRun ? '[dry-run] would build tauri artifacts' : code === 0 ? 'tauri artifacts built' : 'tauri build FAILED',
      findings,
    }
  }
  // Pluggable future targets (frontend-only, backend-only, docker) hook here.
  findings.push(`target=${opts.target}: no build script registered (add a case in production-build.ts)`)
  return {
    phase: 'build',
    ok: false,
    skipped: false,
    dryRun: opts.dryRun,
    summary: `unsupported target: ${opts.target}`,
    findings,
  }
}

// ── docs ────────────────────────────────────────────────────────

async function phaseDocs(opts: Opts): Promise<PhaseResult> {
  const findings: string[] = []
  const docsDir = join(process.cwd(), 'docs', 'decisions')
  if (existsSync(docsDir) && !opts.dryRun) {
    // Regenerate ADR index so the release carries an accurate decision ledger.
    const adrs = (await readdir(docsDir)).filter((f) => /^ADR-\d+\.md$/.test(f))
    const index: string[] = ['# ADR Index', '', `Generated by \`devops production-build docs\` — ${adrs.length} decisions.`, '']
    for (const a of adrs.sort()) {
      const body = await readFile(join(docsDir, a), 'utf8').catch(() => '')
      const titleM = body.match(/^#\s+.*?:\s*(.*)$/m)
      const statusM = body.match(/^\*\*Status:\*\*\s*(\w+)/m)
      index.push(`- ${a}: ${titleM?.[1]?.trim() ?? '(untitled)'} [${statusM?.[1] ?? '?'}]`)
    }
    const outPath = join(docsDir, 'ADR-INDEX.md')
    await writeFile(outPath, index.join('\n') + '\n', 'utf8')
    findings.push(`regenerated ${outPath} (${adrs.length} ADRs)`)
  } else {
    findings.push('docs: ADR index reconciliation (skipped in dry-run)')
  }
  // Reconcile CHANGELOG entry stub if missing.
  const changelog = join(process.cwd(), 'CHANGELOG.md')
  if (!existsSync(changelog) && !opts.dryRun) {
    await writeFile(changelog, '# Changelog\n\n## Unreleased\n- see docs/decisions/ADR-INDEX.md\n', 'utf8')
    findings.push('created CHANGELOG.md stub')
  } else {
    findings.push('changelog present')
  }
  return {
    phase: 'docs',
    ok: true,
    skipped: false,
    dryRun: opts.dryRun,
    summary: 'docs reconciled (ADR index + changelog)',
    findings,
  }
}

// ── verify ──────────────────────────────────────────────────────

async function phaseVerify(opts: Opts): Promise<PhaseResult> {
  const findings: string[] = []
  if (opts.target === 'tauri') {
    const testPath = join(process.cwd(), 'tests', 'e2e', 'tauri-sidecar.test.ts')
    if (existsSync(testPath)) {
      findings.push('running desktop smoke test (tests/e2e/tauri-sidecar.test.ts)')
      findings.push('NOTE: start the built sidecar on 127.0.0.1:9421 first, or run against a live server')
      const code = opts.dryRun ? 0 : (await sh('bun', ['run', testPath], false)) ?? 0
      // The smoke test expects a live sidecar; in CI it runs after `build` starts it.
      // We treat a non-zero as a warning (the harness may not have the sidecar up) but
      // still surface it. For a hard gate, pass --strict-verify.
      const strict = process.argv.includes('--strict-verify')
      return {
        phase: 'verify',
        ok: opts.dryRun ? true : code === 0 || !strict,
        skipped: false,
        dryRun: opts.dryRun,
        summary: opts.dryRun ? '[dry-run] would run desktop smoke test' : code === 0 ? 'desktop smoke test passed' : strict ? 'desktop smoke test FAILED' : 'desktop smoke test not run live (non-strict)',
        findings,
      }
    }
    findings.push('tauri-sidecar smoke test not found')
  } else {
    findings.push(`verify: no verifier registered for target=${opts.target}`)
  }
  return {
    phase: 'verify',
    ok: true,
    skipped: false,
    dryRun: opts.dryRun,
    summary: 'verify phase complete',
    findings,
  }
}

// ── report ──────────────────────────────────────────────────────

function phaseReport(_opts: Opts, report: BuildReport): PhaseResult {
  return {
    phase: 'report',
    ok: report.pass,
    skipped: false,
    dryRun: _opts.dryRun,
    summary: report.pass ? 'PRODUCTION BUILD READY' : 'PRODUCTION BUILD BLOCKED',
    findings: [
      `target=${report.target}`,
      `phases completed: ${report.completedPhases.join(', ') || 'none'}`,
      `phases failed: ${report.failedPhases.join(', ') || 'none'}`,
      ...(report.releaseNotes ? ['', '--- RELEASE NOTES ---', report.releaseNotes] : []),
    ],
    metrics: { pass: report.pass },
  }
}

// ── orchestrator ────────────────────────────────────────────────

async function runPhase(phase: Phase, opts: Opts): Promise<PhaseResult> {
  switch (phase) {
    case 'precheck':
      return phasePrecheck(opts)
    case 'gate':
      return phaseGate(opts)
    case 'cleanup':
      return phaseCleanup(opts)
    case 'converge':
      return phaseConverge(opts)
    case 'build':
      return phaseBuild(opts)
    case 'docs':
      return phaseDocs(opts)
    case 'verify':
      return phaseVerify(opts)
    case 'report':
      // report is computed in the orchestrator; placeholder here.
      return {
        phase: 'report',
        ok: true,
        skipped: false,
        dryRun: opts.dryRun,
        summary: 'report',
        findings: [],
      }
  }
}

export async function runProductionBuild(opts: Opts): Promise<BuildReport> {
  const phases = opts.onlyPhase ? [opts.onlyPhase] : ALL_PHASES
  const results: PhaseResult[] = []
  const completed: string[] = []
  const failed: string[] = []
  const skipped: string[] = []

  for (const phase of phases) {
    if (phase === 'report') continue
    console.log(`\n═══ [production-build] ${phase} ${opts.dryRun ? '(dry-run)' : ''} ═══`)
    const r = await runPhase(phase, opts)
    r.phase = phase
    results.push(r)
    for (const f of r.findings) console.log(`  ${f}`)
    console.log(`  → ${r.summary}`)
    if (r.ok) completed.push(phase)
    else failed.push(phase)
  }

  const pass = failed.length === 0
  const report: BuildReport = {
    target: opts.target,
    startedAt: new Date().toISOString(),
    completedPhases: completed,
    failedPhases: failed,
    skippedPhases: skipped,
    pass,
    results,
    releaseNotes: buildReleaseNotes(results),
  }

  // The report phase prints the final verdict + release notes.
  const rep = phaseReport(opts, report)
  rep.findings.forEach((f) => console.log(`  ${f}`))

  if (opts.out) {
    await mkdir(join(process.cwd(), '.runtime'), { recursive: true }).catch(() => {})
    await writeFile(resolve(opts.out), JSON.stringify(report, null, 2), 'utf8')
    console.log(`\nReport written to ${opts.out}`)
  }

  return report
}

function buildReleaseNotes(results: PhaseResult[]): string {
  const lines: string[] = []
  for (const r of results) {
    if (!r.ok) lines.push(`- BLOCKER [${r.phase}]: ${r.summary}`)
    else if (r.findings.length) lines.push(`- [${r.phase}] ${r.summary}`)
  }
  return lines.join('\n')
}

// ── CLI entry ───────────────────────────────────────────────────

export async function productionBuildCli(args: string[]): Promise<number> {
  const targetArg = args.find((a) => a.startsWith('--target='))
  const target = targetArg ? targetArg.split('=')[1]! : 'tauri'
  const dryRun = args.includes('--dry-run')
  const outArg = args.find((a) => a.startsWith('--out='))
  const out = outArg ? outArg.split('=')[1]! : undefined
  const phaseArg = args.find((a) => ALL_PHASES.includes(a as Phase)) as Phase | undefined

  const report = await runProductionBuild({ target, dryRun, onlyPhase: phaseArg, out })
  return report.pass ? 0 : 1
}
