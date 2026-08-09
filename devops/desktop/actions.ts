// devops/desktop/actions.ts
// Thin action implementations composing spawn/verify/build/state primitives.
// Each action returns ActionResult with {action, ok, detail, data, artifacts}.

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { installedExePath, nsisPathFor, readDesktopVersion, ensureDesktopVersion } from '../../scripts/tauri/version.js'
import type { CliArgs } from './cli.js'
import type { ActionResult } from './cli.js'
import { flag, flagInt, flagBool } from './cli.js'
import {
  killVivimProcesses,
  launchInstalled,
  installNsis,
  uninstallNsis,
  getUninstallRegistryKey,
  sleepSync,
} from './spawn.js'
import {
  pollReady,
  ownerPidForPort,
  ancestorNamesForPid,
  scanPortForPid,
  processNameForPid,
  isVivimOwner,
  windowInfo,
  focusWindow,
  captureScreenshot,
  assertNonBlank,
  getImageStats,
} from './verify.js'
import { needsBuild, needsBuildMulti, needsBuildWithTools, markBuilt } from './build.js'
import {
  loadState,
  saveState,
  initState,
  clearLedger,
  loadRuntime,
  saveRuntime,
  clearRuntime,
  cycleDir,
  DEFAULT_PORT,
  SRC_TAURI,
  DEBUG_ROOT,
  DIST,
} from './state.js'

function ok(action: string, detail: string, data: Record<string, unknown> = {}, artifacts: string[] = []): ActionResult {
  return { action, ok: true, detail, data, artifacts }
}

function fail(action: string, detail: string, data: Record<string, unknown> = {}, artifacts: string[] = []): ActionResult {
  return { action, ok: false, detail, data, artifacts }
}

// ── status ─────────────────────────────────────────────────────────────────

export async function actionStatus(args: CliArgs): Promise<ActionResult> {
  const version = flag(args, 'version') || readDesktopVersion()
  const installer = nsisPathFor(version)
  const exe = installedExePath()
  const runtime = loadRuntime()
  const ledger = loadState(version)

  const data: Record<string, unknown> = {
    version,
    configuredVersion: readDesktopVersion(),
    installerExists: existsSync(installer),
    installerPath: installer,
    exeExists: existsSync(exe),
    exePath: exe,
  }

  if (existsSync(exe)) {
    const st = statSync(exe)
    data.exeSizeMB = (st.size / 1024 / 1024).toFixed(1)
  }

  // NSIS uninstall registry key
  const regKey = getUninstallRegistryKey()
  data.installed = !!regKey
  data.registryKey = regKey

  // Running processes
  const desktopInfo = windowInfo('vivim-desktop')
  const serverInfo = windowInfo('vivim-server')
  data.processes = {
    desktop: { name: 'vivim-desktop.exe', window: desktopInfo },
    server: { name: 'vivim-server.exe', window: serverInfo },
  }

  // Port owner
  const owner = ownerPidForPort(DEFAULT_PORT)
  data.portOwner = owner

  // Runtime state
  if (runtime) {
    data.runtime = runtime
  }

  // Ledger
  if (ledger) {
    data.ledger = { cycle: ledger.cycle, status: ledger.status }
  }

  const ok_ = existsSync(exe) && (!!regKey || desktopInfo.exists || serverInfo.exists)
  return ok('status', ok_ ? 'installed and running' : 'status gathered', data)
}

// ── build ──────────────────────────────────────────────────────────────────

export async function actionBuild(args: CliArgs): Promise<ActionResult> {
  const version = flag(args, 'version')
  if (!version) return fail('build', 'build requires --version')

  const synced = ensureDesktopVersion(version)
  const TS_EXTS = ['.ts', '.tsx', '.js', '.jsx']
  const RUST_EXTS = ['.rs', '.toml']
  const artifacts: string[] = []

  // Sidecar check. The sidecar embeds app code + prisma schema + seeds, so a
  // change in ANY of them must trigger a rebuild. The embedded DB is built
  // from seeds at compile time — we fingerprint prisma/schema.prisma (DDL)
  // and seeds/ (manifests, parsers, snapshot), NOT the volatile dev.db
  // (which changes on every local run and would force a rebuild every time).
  const sidecarSrc = join(process.cwd(), 'src')
  const prismaDir = join(process.cwd(), 'prisma')
  const sidecar = needsBuildMulti(synced, [
    { dir: sidecarSrc, exts: TS_EXTS },
    { dir: prismaDir, exts: ['.prisma'] },
    { dir: join(process.cwd(), 'seeds'), exts: TS_EXTS.concat('.json', '.db') },
  ], 'sidecar',
    existsSync(join(SRC_TAURI, 'target', 'release', 'vivim-server.exe')))

  // Tauri check
  const tauriSrc = join(SRC_TAURI, 'src')
  const frontendSrc = join(process.cwd(), 'frontend', 'src')
  const rustCheck = needsBuild(synced, tauriSrc, RUST_EXTS, 'tauri-rust',
    existsSync(nsisPathFor(synced)))
  // The frontend stage outputs depend on frontend/src AND the build tooling
  // that drives them (prepare-frontend, next.config, package deps). Hash both
  // so a stale installer built by an older toolchain never masks a rebuild.
  const ROOT = process.cwd()
  const frontendCheck = needsBuildWithTools(synced,
    [{ dir: frontendSrc, exts: TS_EXTS }],
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
    existsSync(nsisPathFor(synced)))

  const changed = sidecar.changed || rustCheck.changed || frontendCheck.changed
  const installer = nsisPathFor(synced)

  return ok('build', changed ? 'build needed' : 'all sources unchanged', {
    version: synced,
    changed,
    sidecarChanged: sidecar.changed,
    rustChanged: rustCheck.changed,
    frontendChanged: frontendCheck.changed,
    installerExists: existsSync(installer),
  }, artifacts)
}

// ── install ────────────────────────────────────────────────────────────────

export async function actionInstall(args: CliArgs): Promise<ActionResult> {
  const version = flag(args, 'version')
  if (!version) return fail('install', 'install requires --version')

  const synced = ensureDesktopVersion(version)
  const installer = nsisPathFor(synced)
  if (!existsSync(installer)) return fail('install', `NSIS installer not found: ${installer}`)

  // Kill stale processes
  killVivimProcesses()

  // Uninstall prior version (NSIS handles this via getUninstallRegistryKey)
  // installNsis will also silently uninstall any existing instance

  // Install via NSIS silent install
  process.stdout.write(`  installing NSIS installer...\n`)
  const result = installNsis(installer)

  return ok('install', result.detail, {
    version: synced,
    installer,
    exit: result.exit,
  })
}

// ── uninstall ──────────────────────────────────────────────────────────────

export async function actionUninstall(_args: CliArgs): Promise<ActionResult> {
  killVivimProcesses()
  const regKey = getUninstallRegistryKey()
  if (!regKey) return ok('uninstall', 'no vivim install found in registry')

  const result = uninstallNsis()
  return ok('uninstall', result.ok ? 'uninstalled' : `uninstall failed (exit=${result.exit})`, {
    registryKey: regKey,
    exit: result.exit,
  })
}

// ── kill ───────────────────────────────────────────────────────────────────

export async function actionKill(_args: CliArgs): Promise<ActionResult> {
  const killed = killVivimProcesses()
  return ok('kill', killed.length ? `killed: ${killed.join(', ')}` : 'no vivim processes found', { killed })
}

// ── launch ─────────────────────────────────────────────────────────────────

export async function actionLaunch(args: CliArgs): Promise<ActionResult> {
  const port = flagInt(args, 'port', DEFAULT_PORT)
  const waitWindow = flagBool(args, 'wait-window', true)
  const timeoutMs = flagInt(args, 'timeout', 60_000)
  const version = flag(args, 'version') || readDesktopVersion()

  killVivimProcesses()
  const exe = installedExePath()
  if (!existsSync(exe)) return fail('launch', `exe not found: ${exe}`)

  process.stdout.write(`  launching ${exe}...\n`)
  const pid = launchInstalled(exe)
  if (!pid) return fail('launch', 'failed to start process')

  process.stdout.write(`  PID: ${pid}, waiting for readyz on :${port}...\n`)
  const ready = await pollReady(port, { timeoutMs, expectOwnerPid: pid })

  let actualPort = ready.actualPort
  if (ready.stale && actualPort) {
    process.stdout.write(`  stale server detected, actual port: ${actualPort}\n`)
  }

  // Optionally wait for window
  let win = windowInfo('vivim-desktop')
  if (waitWindow && !win.exists) {
    process.stdout.write(`  waiting for window...\n`)
    for (let i = 0; i < 30; i++) {
      sleepSync(500)
      win = windowInfo('vivim-desktop')
      if (win.exists) break
    }
  }

  // Save runtime state
  const runtime = {
    version,
    exePath: exe,
    port: actualPort ?? port,
    lastPid: pid,
    readyMs: ready.ok ? ready.ms : null,
    readyAt: ready.ok ? Date.now() : null,
    ownerPid: ready.ownerPid,
    actualPort,
  }
  saveRuntime(runtime)

  return ok('launch', ready.ok ? `readyz ${ready.ms}ms, PID ${pid}` : `readyz failed: ${ready.reason}`, {
    pid,
    ready: ready.ok,
    readyMs: ready.ms,
    ownerPid: ready.ownerPid,
    stale: ready.stale,
    actualPort,
    window: win,
  })
}

// ── readyz ─────────────────────────────────────────────────────────────────

export async function actionReadyz(args: CliArgs): Promise<ActionResult> {
  const port = flagInt(args, 'port', DEFAULT_PORT)
  const timeoutMs = flagInt(args, 'timeout', 60_000)
  const runtime = loadRuntime()
  const expectPid = runtime?.lastPid ?? null

  const result = await pollReady(port, { timeoutMs, expectOwnerPid: expectPid })

  return ok('readyz', result.ok ? `200 in ${result.ms}ms` : 'readyz failed', {
    port,
    ok: result.ok,
    ms: result.ms,
    ownerPid: result.ownerPid,
    stale: result.stale,
    actualPort: result.actualPort,
    polls: result.polls.length,
  })
}

// ── probe ──────────────────────────────────────────────────────────────────

export async function actionProbe(args: CliArgs): Promise<ActionResult> {
  const port = flagInt(args, 'port', DEFAULT_PORT)
  const path = args.positionals[0] || '/readyz'
  const expectStatus = flagInt(args, 'expect', 200)
  const contains = flag(args, 'contains')
  const method = flag(args, 'method', 'GET')
  const body = flag(args, 'body')

  const url = `http://127.0.0.1:${port}${path}`
  const t0 = Date.now()
  try {
    const init: RequestInit = { method, signal: AbortSignal.timeout(10_000) }
    if (body && method !== 'GET') init.body = body
    const res = await fetch(url, init)
    const text = await res.text()
    const ms = Date.now() - t0

    const statusOk = res.status === expectStatus
    const containsOk = contains ? text.includes(contains) : true
    const ok_ = statusOk && containsOk

    return ok('probe', ok_ ? `${res.status} in ${ms}ms` : `probe failed (${res.status})`, {
      url,
      status: res.status,
      expectStatus,
      statusOk,
      contains,
      containsOk,
      ms,
      bodyPreview: text.slice(0, 500),
    })
  } catch (err) {
    return fail('probe', `fetch error: ${String(err)}`, { url, expectStatus })
  }
}

// ── screenshot ─────────────────────────────────────────────────────────────

export async function actionScreenshot(args: CliArgs): Promise<ActionResult> {
  const outPath = flag(args, 'out', join(DIST, 'desktop-screenshot.png'))
  const focus = flagBool(args, 'focus', true)
  const verify = flagBool(args, 'verify', true)

  if (focus) {
    process.stdout.write(`  focusing window...\n`)
    focusWindow('vivim-desktop')
    sleepSync(800)
  }

  process.stdout.write(`  capturing screenshot...\n`)
  const captured = captureScreenshot(outPath)
  if (!captured) return fail('screenshot', 'capture failed')

  const stats = getImageStats(outPath)
  const nonBlank = verify ? assertNonBlank(outPath) : null

  return ok('screenshot', verify ? (nonBlank ? 'rendered' : 'blank') : 'captured', {
    path: outPath,
    sizeKB: stats.sizeKB,
    colors: stats.colors,
    nonBlank,
  }, [outPath])
}

// ── window ─────────────────────────────────────────────────────────────────

export async function actionWindow(_args: CliArgs): Promise<ActionResult> {
  const desktop = windowInfo('vivim-desktop')
  const server = windowInfo('vivim-server')
  return ok('window', desktop.exists ? `title: "${desktop.title}"` : 'no window', {
    desktop,
    server,
  })
}

// ── process ────────────────────────────────────────────────────────────────

export async function actionProcess(_args: CliArgs): Promise<ActionResult> {
  const desktop = windowInfo('vivim-desktop')
  const server = windowInfo('vivim-server')
  const portOwner = ownerPidForPort(DEFAULT_PORT)

  return ok('process', 'process info', {
    desktop,
    server,
    portOwner,
    port: DEFAULT_PORT,
  })
}

// ── logs ───────────────────────────────────────────────────────────────────

export async function actionLogs(args: CliArgs): Promise<ActionResult> {
  const tail = flagInt(args, 'tail', 50)
  const local = process.env.LOCALAPPDATA ?? ''
  const candidates = [
    join(local, 'vivim', 'vivim-server.log'),
    join(local, 'vivim', 'vivim-supervisor.log'),
  ]
  const sources: Array<{ path: string; exists: boolean; tail: string[] }> = []

  for (const src of candidates) {
    const exists = existsSync(src)
    if (!exists) {
      sources.push({ path: src, exists: false, tail: [] })
      continue
    }
    const content = readFileSync(src, 'utf8')
    const lines = content.split('\n')
    const tailLines = lines.slice(-tail)
    sources.push({ path: src, exists: true, tail: tailLines })
  }

  return ok('logs', `found ${sources.filter((s) => s.exists).length}/${sources.length} logs`, { sources })
}

// ── test ───────────────────────────────────────────────────────────────────

export interface CheckResult {
  name: string
  ok: boolean
  detail: string
}

export async function actionTest(args: CliArgs): Promise<ActionResult> {
  const battery = args.positionals[0] || 'smoke'
  const checks: CheckResult[] = []

  async function runCheck(name: string, fn: () => Promise<CheckResult>): Promise<void> {
    try {
      checks.push(await fn())
    } catch (err) {
      checks.push({ name, ok: false, detail: String(err) })
    }
  }

  // Common checks reused across batteries
  const checkProcess = async (): Promise<CheckResult> => {
    const w = windowInfo('vivim-desktop')
    return { name: 'process', ok: w.exists, detail: w.exists ? `PID window exists` : 'no desktop window' }
  }

  const checkReadyz = async (): Promise<CheckResult> => {
    const runtime = loadRuntime()
    const port = runtime?.port ?? DEFAULT_PORT
    try {
      const res = await fetch(`http://127.0.0.1:${port}/readyz`, { signal: AbortSignal.timeout(5000) })
      return { name: 'readyz', ok: res.ok, detail: `status ${res.status}` }
    } catch (err) {
      return { name: 'readyz', ok: false, detail: String(err) }
    }
  }

  // Assert the /readyz responder is a genuine vivim process, not a foreign
  // process squatting on the port (e.g. a stale `bun ... serve`). Without
  // this, a foreign 200 passes readyz/probe while process/window fail.
  //
  // The owner is legit if its name OR any ancestor's name is a vivim image —
  // the compiled sidecar `vivim-server.exe` re-spawns the real worker via
  // `bun run src/cli/index.ts serve`, so a `bun` owner with a vivim ancestor
  // is the genuine server, not a squatter.
  const checkOwner = async (): Promise<CheckResult> => {
    const runtime = loadRuntime()
    const port = runtime?.port ?? DEFAULT_PORT
    const expectedPid = runtime?.ownerPid ?? runtime?.lastPid ?? null
    const owner = ownerPidForPort(port)
    const ownerName = owner !== null ? processNameForPid(owner) : null
    const ancestors = owner !== null ? ancestorNamesForPid(owner) : []
    const legit = isVivimOwner(ownerName, owner, expectedPid, ancestors)
    if (owner === null) return { name: 'owner', ok: false, detail: `no listener on :${port}` }
    return {
      name: 'owner',
      ok: legit,
      detail: legit
        ? `:${port} owned by ${owner} (${ownerName ?? 'unknown'})`
        : `foreign responder ${owner} (${ownerName ?? 'unknown'}) on :${port}`,
    }
  }

  const checkWindow = async (): Promise<CheckResult> => {
    const w = windowInfo('vivim-desktop')
    return { name: 'window', ok: w.exists && w.title.length > 0, detail: w.title || 'no title' }
  }

  const checkScreenshot = async (): Promise<CheckResult> => {
    const out = join(DIST, 'test-screenshot.png')
    focusWindow('vivim-desktop')
    sleepSync(800)
    const captured = captureScreenshot(out)
    if (!captured) return { name: 'screenshot', ok: false, detail: 'capture failed' }
    const nonBlank = assertNonBlank(out)
    return { name: 'screenshot', ok: nonBlank, detail: nonBlank ? 'rendered' : 'blank' }
  }

  const checkProbe = async (path: string, expect = 200): Promise<CheckResult> => {
    const runtime = loadRuntime()
    const port = runtime?.port ?? DEFAULT_PORT
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000) })
      return { name: `probe:${path}`, ok: res.status === expect, detail: `status ${res.status}` }
    } catch (err) {
      return { name: `probe:${path}`, ok: false, detail: String(err) }
    }
  }

  if (battery === 'smoke' || battery === 'all') {
    await runCheck('process', checkProcess)
    await runCheck('readyz', checkReadyz)
    await runCheck('owner', checkOwner)
    await runCheck('window', checkWindow)
    await runCheck('screenshot', checkScreenshot)
    await runCheck('probe:readyz', () => checkProbe('/readyz'))
    await runCheck('probe:health', () => checkProbe('/health'))
  } else if (battery === 'boot') {
    killVivimProcesses()
    const exe = installedExePath()
    if (!existsSync(exe)) { checks.push({ name: 'boot', ok: false, detail: 'exe not found' }) }
    else {
      const pid = launchInstalled(exe)
      if (!pid) { checks.push({ name: 'boot', ok: false, detail: 'launch failed' }) }
      else {
        const runtime = loadRuntime()
        const port = runtime?.port ?? DEFAULT_PORT
        const ready = await pollReady(port, { timeoutMs: 30_000, expectOwnerPid: pid })
        checks.push({ name: 'boot', ok: ready.ok, detail: ready.ok ? `${ready.ms}ms` : ready.reason })
      }
    }
  } else if (battery === 'http') {
    await runCheck('probe:readyz', () => checkProbe('/readyz'))
    await runCheck('probe:health', () => checkProbe('/health'))
    await runCheck('probe:openapi', () => checkProbe('/api/openapi.json'))
  } else if (battery === 'window') {
    await runCheck('window', checkWindow)
    await runCheck('screenshot', checkScreenshot)
  } else if (battery === 'process') {
    await runCheck('process', checkProcess)
  } else {
    return fail('test', `unknown battery: ${battery}`, { available: ['smoke', 'all', 'boot', 'http', 'window', 'process'] })
  }

  const allOk = checks.every((c) => c.ok)
  return ok('test', allOk ? `${battery}: all ${checks.length} checks passed` : `${battery}: ${checks.filter((c) => !c.ok).length}/${checks.length} failed`, {
    battery,
    checks,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
  })
}

// ── report ─────────────────────────────────────────────────────────────────

export async function actionReport(args: CliArgs): Promise<ActionResult> {
  const version = flag(args, 'version') || readDesktopVersion()
  const ledger = loadState(version)
  if (!ledger) return fail('report', `no ledger for version ${version}`)

  const last = ledger.history[ledger.history.length - 1]
  if (!last) return fail('report', 'no cycles recorded')

  const dir = cycleDir(version, last.cycle)
  const lines = [
    `# Desktop Loop Report — v${version} cycle ${last.cycle}`,
    '',
    `Status: **${last.ok ? 'PASS' : 'FAIL'}**`,
    '',
    '| Gate | Status | Detail |',
    '| --- | --- | --- |',
  ]
  for (const g of last.gates) {
    lines.push(`| ${g.gate} | ${g.status} | ${g.detail} |`)
  }

  const mdPath = join(dir, 'report.md')
  writeFileSync(mdPath, lines.join('\n'), 'utf8')
  return ok('report', last.ok ? 'all gates passed' : 'failed', {
    version,
    cycle: last.cycle,
    gates: last.gates,
  }, [mdPath])
}

// ── reset ──────────────────────────────────────────────────────────────────

export async function actionReset(_args: CliArgs): Promise<ActionResult> {
  clearLedger()
  clearRuntime()
  return ok('reset', 'ledger + runtime cleared')
}
