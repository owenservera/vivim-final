// devops/desktop/index.ts
// CLI entry for `bun run devops desktop-loop <action> [args]`.
// Registers all actions and dispatches via parseArgs → dispatchAction.
//
// Backward-compatible exports: runDesktopLoop, printLoopResult, types.

import { readDesktopVersion } from '../../scripts/tauri/version.js'
import type { ActionResult, CliArgs } from './cli.js'
import { parseArgs, dispatchAction, registerAction, printResult, teeConsoleToLog, flag, listActions } from './cli.js'
import {
  actionStatus,
  actionBuild,
  actionInstall,
  actionUninstall,
  actionKill,
  actionLaunch,
  actionReadyz,
  actionProbe,
  actionScreenshot,
  actionWindow,
  actionProcess,
  actionLogs,
  actionTest,
  actionReport,
  actionReset,
} from './actions.js'
import {
  loadState,
  saveState,
  initState,
  cycleDir,
  DEFAULT_PORT,
} from './state.js'
import { spawnStreaming, killVivimProcesses, launchInstalled, installNsis, sleepSync } from './spawn.js'
import { pollReady, assertNonBlank, windowInfo, focusWindow, captureScreenshot, ownerPidForPort } from './verify.js'
import { needsBuild, needsBuildMulti, needsBuildWithTools, markBuilt } from './build.js'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { installedExePath, nsisPathFor, ensureDesktopVersion } from '../../scripts/tauri/version.js'
import type { GateResult, CycleRecord, DesktopLoopState } from './state.js'
import { DEBUG_ROOT } from './state.js'

// ── Register all actions ───────────────────────────────────────────────────

registerAction('status', actionStatus)
registerAction('build', actionBuild)
registerAction('install', actionInstall)
registerAction('uninstall', actionUninstall)
registerAction('kill', actionKill)
registerAction('launch', actionLaunch)
registerAction('readyz', actionReadyz)
registerAction('probe', actionProbe)
registerAction('screenshot', actionScreenshot)
registerAction('window', actionWindow)
registerAction('process', actionProcess)
registerAction('logs', actionLogs)
registerAction('test', actionTest)
registerAction('report', actionReport)
registerAction('reset', actionReset)

// ── CLI Entry ──────────────────────────────────────────────────────────────

/**
 * Main CLI entry. Parses args, dispatches, prints result, sets exit code.
 * Returns exit code (0 = ok, 1 = fail).
 */
export async function runDesktopCli(argv: string[]): Promise<number> {
  const args = parseArgs(argv)

  // Resolve action: default to 'run' if --version present, else 'status'
  if (!args.action) {
    args.action = args.flags.has('version') ? 'run' : 'status'
  }

  // Full loop (run) is handled separately as it's a multi-gate orchestrator
  if (args.action === 'run') {
    const state = await runDesktopLoop({
      version: flag(args, 'version'),
      resume: args.flags.has('resume'),
      reset: args.flags.has('reset'),
    })
    printLoopResult(state)
    return state.status === 'done' ? 0 : 1
  }

  // All other actions: tee to per-invocation log
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const action = args.action
  const logDir = join(DEBUG_ROOT, 'actions')
  mkdirSync(logDir, { recursive: true })
  teeConsoleToLog(join(logDir, `${action}-${ts}.log`))

  const result = await dispatchAction(args)
  printResult(result, args)
  return result.ok ? 0 : 1
}

// ── Full Loop (backward-compatible) ────────────────────────────────────────

export async function runDesktopLoop(opts: {
  version?: string
  resume?: boolean
  reset?: boolean
}): Promise<DesktopLoopState> {
  if (opts.reset) {
    const { clearLedger } = await import('./state.js')
    clearLedger()
    return initState(opts.version ?? '0.0.0')
  }

  if (!opts.version) {
    throw new Error('desktop-loop requires --version <x.y.z>')
  }

  const version = ensureDesktopVersion(opts.version)
  let state = opts.resume ? loadState(version) : null
  if (!state) state = initState(version)

  const cycle = state.cycle + 1
  const dir = cycleDir(version, cycle)
  mkdirSync(dir, { recursive: true })
  teeConsoleToLog(join(dir, 'run.log'))

  const record: CycleRecord = {
    cycle,
    version,
    startedAt: Date.now(),
    finishedAt: 0,
    gates: [],
    ok: false,
  }

  process.stdout.write(`\n${'='.repeat(70)}\n`)
  process.stdout.write(`  Desktop Loop  |  v${version}  |  cycle ${cycle}\n`)
  process.stdout.write(`${'='.repeat(70)}\n`)
  process.stdout.write(`  artifacts -> ${dir}\n`)
  process.stdout.write(`${'-'.repeat(70)}\n`)

  // G1: Build
  const g1 = await gateBuild(version, dir)
  record.gates.push(g1)

  if (g1.status === 'pass') {
    // G2: Install
    const installer = nsisPathFor(version)
    const g2 = await gateInstall(installer, dir)
    record.gates.push(g2)
    if (g2.status === 'pass') {
      // G3: Launch+Render
      const g3 = await gateLaunchRender(DEFAULT_PORT, dir)
      record.gates.push(g3)
    }
  }

  record.ok = record.gates.every((g) => g.status === 'pass')

  // G4: Capture on fail
  if (!record.ok) {
    const g4 = await gateCapture(dir)
    record.gates.push(g4)
  }

  // G5: Report
  const g5 = gateReport(state, record, dir)
  record.gates.push(g5)
  record.finishedAt = Date.now()

  state.cycle = cycle
  state.history.push(record)
  state.status = record.ok ? 'done' : 'blocked'
  saveState(state)

  // Stage artifacts on success
  if (record.ok) {
    const installer = nsisPathFor(version)
    if (existsSync(installer)) {
      const stage = join(DEBUG_ROOT, '..', `v${version}`)
      mkdirSync(stage, { recursive: true })
      const { copyFileSync } = await import('node:fs')
      const { basename } = await import('node:path')
      copyFileSync(installer, join(stage, basename(installer)))
    }
  }

  // Final summary
  process.stdout.write(`\n${'='.repeat(70)}\n`)
  process.stdout.write(`  CYCLE ${cycle} ${record.ok ? 'PASS' : 'FAIL'}\n`)
  process.stdout.write(`${'-'.repeat(70)}\n`)
  for (const g of record.gates) {
    const icon = g.status === 'pass' ? '+' : g.status === 'fail' ? 'x' : '-'
    process.stdout.write(`  ${icon} ${g.gate.padEnd(22)} ${g.detail}\n`)
  }
  process.stdout.write(`${'='.repeat(70)}\n\n`)

  return state
}

// ── Gate Implementations ───────────────────────────────────────────────────

async function gateBuild(version: string, dir: string): Promise<GateResult> {
  const TS_EXTS = ['.ts', '.tsx', '.js', '.jsx']
  const RUST_EXTS = ['.rs', '.toml']
  const artifacts: string[] = []
  const installers = [
    join(process.cwd(), 'src-tauri', 'target', 'release', 'vivim-server.exe'),
  ]

// Hash-gated: check all source tiers. Any change → run canonical build.ps1.
  // The sidecar also embeds prisma schema + seeds. prisma's volatile dev.db
  // is NOT fingerprinted (it changes on every local run); the embedded DB is
  // generated from seeds at compile time.
  const sidecar = needsBuildMulti(version, [
    { dir: join(process.cwd(), 'src'), exts: TS_EXTS },
    { dir: join(process.cwd(), 'prisma'), exts: ['.prisma'] },
    { dir: join(process.cwd(), 'seeds'), exts: TS_EXTS.concat('.json', '.db') },
  ], 'sidecar',
    existsSync(installers[0]))
  const rustCheck = needsBuild(version, join(process.cwd(), 'src-tauri', 'src'), RUST_EXTS, 'tauri-rust',
    existsSync(nsisPathFor(version)))
  // Frontend stage: hash frontend/src AND the build tooling (prepare-frontend,
  // next.config, package deps) so a stale installer from an older toolchain
  // never masks a rebuild after a tooling change.
  const ROOT = process.cwd()
  const frontendCheck = needsBuildWithTools(version,
    [{ dir: join(ROOT, 'frontend', 'src'), exts: TS_EXTS }],
    [
      join(ROOT, 'scripts', 'tauri', 'prepare-frontend.ts'),
      join(ROOT, 'scripts', 'tauri', 'build.ps1'),
      join(ROOT, 'frontend', 'next.config.mjs'),
      join(ROOT, 'frontend', 'package.json'),
      join(ROOT, 'frontend', 'tsconfig.json'),
      join(ROOT, 'frontend', 'postcss.config.mjs'),
      join(ROOT, 'frontend', 'tailwind.config.ts'),
      join(ROOT, 'frontend', 'bun.lock'),
    ],
    'tauri-frontend',
    existsSync(nsisPathFor(version)))

  if (!sidecar.changed && !rustCheck.changed && !frontendCheck.changed && existsSync(nsisPathFor(version))) {
    process.stdout.write(`  [G1] build: skipping (all sources unchanged + NSIS installer exists)\n`)
  } else {
    const logPath = join(dir, 'build-tauri.log')
    const buildScript = join(process.cwd(), 'scripts', 'tauri', 'build.ps1')
    const r = await spawnStreaming('pwsh', ['-ExecutionPolicy', 'Bypass', '-File', buildScript], logPath, {
      cwd: process.cwd(),
      timeoutMs: 1_800_000,
      label: 'G1.build',
    })
    artifacts.push(logPath)
    if (!r.ok) {
      const tail = r.output.split('\n').filter(Boolean).slice(-10).join('\n')
      process.stderr.write(`\n  -- Last 10 lines of build --\n${tail}\n  -- end --\n\n`)
      return { gate: 'G1 Build', status: 'fail', detail: `build failed — see build-tauri.log`, artifacts }
    }
    markBuilt(version, 'sidecar', sidecar.fingerprint)
    markBuilt(version, 'tauri-rust', rustCheck.fingerprint)
    markBuilt(version, 'tauri-frontend', frontendCheck.fingerprint)
  }

  const installer = nsisPathFor(version)
  if (!existsSync(installer)) {
    return { gate: 'G1 Build', status: 'fail', detail: `NSIS installer not produced: ${installer}`, artifacts }
  }
  const installerMB = (statSync(installer).size / 1024 / 1024).toFixed(1)
  return { gate: 'G1 Build', status: 'pass', detail: `NSIS: ${basename(installer)} (${installerMB} MB)`, artifacts: [...artifacts, installer] }
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

async function gateInstall(installer: string, dir: string): Promise<GateResult> {
  killVivimProcesses()
  const result = installNsis(installer)
  return {
    gate: 'G2 Install',
    status: result.ok ? 'pass' : 'fail',
    detail: result.detail,
  }
}

async function gateLaunchRender(port: number, dir: string): Promise<GateResult> {
  const exe = installedExePath()
  const readyzLog = join(dir, 'readyz-history.log')
  const png = join(dir, 'screenshot.png')
  const artifacts: string[] = []

  killVivimProcesses()

  // Launch
  process.stdout.write(`  [G3] exe: ${exe}\n`)
  const pid = launchInstalled(exe)
  if (!pid) return { gate: 'G3 Launch+Render', status: 'fail', detail: `exe not found: ${exe}`, artifacts }

  // Readyz (with owner verification)
  process.stdout.write(`  [G3] waiting for readyz on :${port}...\n`)
  const ready = await pollReady(port, { timeoutMs: 60_000, expectOwnerPid: pid })
  if (!ready.ok) {
    return { gate: 'G3 Launch+Render', status: 'fail', detail: `readyz failed: ${ready.reason}`, artifacts }
  }

  // Screenshot
  process.stdout.write(`  [G3] readyz ${ready.ms}ms — capturing screenshot...\n`)
  sleepSync(1500)
  const captured = captureScreenshot(png)
  if (captured) artifacts.push(png)
  const nonBlank = captured ? assertNonBlank(png) : false
  if (!nonBlank) {
    return { gate: 'G3 Launch+Render', status: 'fail', detail: 'screenshot blank', artifacts }
  }

  return { gate: 'G3 Launch+Render', status: 'pass', detail: `readyz ${ready.ms}ms, rendered`, artifacts }
}

async function gateCapture(dir: string): Promise<GateResult> {
  const artifacts: string[] = []
  const local = process.env.LOCALAPPDATA ?? ''
  const candidates = [
    join(local, 'vivim', 'vivim-server.log'),
    join(local, 'vivim', 'vivim-supervisor.log'),
  ]
  for (const src of candidates) {
    if (existsSync(src)) {
      const { copyFileSync } = await import('node:fs')
      const dest = join(dir, basename(src))
      copyFileSync(src, dest)
      artifacts.push(dest)
    }
  }
  return {
    gate: 'G4 Capture',
    status: artifacts.length ? 'pass' : 'fail',
    detail: artifacts.length ? `copied ${artifacts.length} log(s)` : 'no app logs found',
    artifacts,
  }
}

function gateReport(state: DesktopLoopState, last: CycleRecord, dir: string): GateResult {
  const json = { version: state.version, cycle: last.cycle, ok: last.ok, gates: last.gates }
  const jsonPath = join(dir, 'report.json')
  const mdPath = join(dir, 'report.md')
  mkdirSync(dir, { recursive: true })
  writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf8')

  const lines = [
    `# Desktop Loop Report — v${state.version} cycle ${last.cycle}`,
    '',
    `Status: **${last.ok ? 'PASS' : 'FAIL'}**`,
    '',
    '| Gate | Status | Detail |',
    '| --- | --- | --- |',
  ]
  for (const g of last.gates) {
    lines.push(`| ${g.gate} | ${g.status} | ${g.detail} |`)
  }
  writeFileSync(mdPath, lines.join('\n'), 'utf8')

  return {
    gate: 'G5 Report',
    status: last.ok ? 'pass' : 'fail',
    detail: last.ok ? 'all gates passed' : 'failed — see report.md',
    artifacts: [jsonPath, mdPath],
  }
}

// ── Backward-Compatible Exports ────────────────────────────────────────────

export function printLoopResult(state: DesktopLoopState): void {
  const last = state.history[state.history.length - 1]
  // [audit] removed: console.log(JSON.stringify({
    ok: last?.ok ?? false,
    version: state.version,
    cycle: state.cycle,
    status: state.status,
    gates: last?.gates.map((g) => ({ gate: g.gate, status: g.status })),
    reportDir: last ? cycleDir(state.version, last.cycle) : undefined,
  }, null, 2))
}

export type { GateResult, GateStatus, CycleRecord, DesktopLoopState }
