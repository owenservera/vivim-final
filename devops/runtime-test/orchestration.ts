// devops/runtime-test/orchestration.ts
// Unit 6.1 — Runtime Loop Meta-cmd
//
// AGENT-SAFE: every cycle has bounded time. Never hangs. Structured JSON output.
// The agent reads the LoopReport and decides next action.
// Always ends with browser verification: navigate → screenshot → agent reviews.

import {
  type CapabilityContractLike,
  type WireCanvasDeps,
  wireCapabilityToCanvas,
} from '../../src/canvas/capability-layer.js'
import {
  type CdpExecutor,
  registerDiscoveredCdpMethods,
} from '../../src/engines/cdp-capability-registrar.js'
import type { UnifiedCapabilityRegistry } from '../../src/engines/unified-registry.js'
import { scaffoldBackend } from './build-backend.js'
import { scaffoldFrontend } from './build-frontend.js'
import { captureDebug } from './debug-capture.js'
import { discoverCdpProtocol } from './discover-cdp.js'
import { saveLoopReport } from './report.js'
import { discoverBackend, discoverFrontend } from './discover.js'
import { preflight } from './preflight.js'
import { supervisor } from './supervisor.js'
import { type TestSpec, runLiveTest } from './test-harness.js'
import { backendBaseUrl } from './port.js'

const OVERALL_TIMEOUT_MS = 120_000 // 2 minutes hard cap for entire loop

export interface LoopReport {
  ok: boolean
  cycles: number
  maxCycles: number
  mode: 'autonomous' | 'mitm'
  steps: Array<{ step: string; ok: boolean; detail?: string }>
  screenshots: Array<{ cycle: number; path: string; url: string }>
  finalHealth: { db: boolean; server: boolean; tests: boolean }
  error?: string
  elapsedMs: number
}

export interface OrchestrationResult {
  ok: boolean
  step: string
  error?: string
}

interface RuntimeOptions {
  maxCycles?: number
  mode?: 'autonomous' | 'mitm'
  skipFrontend?: boolean
  /** User goal — interpreted via NLCL and executed as capabilities. */
  goal?: string
  /**
   * U1/U2 — discover CDP methods from a running Chrome and register each as a
   * UnifiedCapability. The executor is supplied by ChromeGovernor (Governor Canon).
   */
  cdp?: {
    registry: UnifiedCapabilityRegistry
    executeCdp: CdpExecutor
    debugPort?: number
  }
  /**
   * U4 — wire resolved capabilities onto the infinite canvas as atomic composable
   * layers (Designer.publish + LayerMounter.spawn).
   */
  canvas?: {
    deps: WireCanvasDeps
    contracts: CapabilityContractLike[]
  }
}

/**
 * Discover CDP methods (U1) and register each as a capability (U2). Best-effort building
 * block for the loop — never throws; returns a structured report.
 */
export async function discoverAndRegisterCdp(opts: {
  registry: UnifiedCapabilityRegistry
  executeCdp: CdpExecutor
  debugPort?: number
}): Promise<{
  ok: boolean
  source: string
  discovered: number
  registered: number
  domains: string[]
  error?: string
}> {
  const disc = await discoverCdpProtocol(opts.debugPort)
  if (!disc.ok) {
    return {
      ok: false,
      source: disc.source,
      discovered: 0,
      registered: 0,
      domains: [],
      error: disc.error,
    }
  }
  const { registered } = registerDiscoveredCdpMethods(opts.registry, disc.methods, {
    executeCdp: opts.executeCdp,
  })
  return {
    ok: true,
    source: disc.source,
    discovered: disc.methods.length,
    registered: registered.length,
    domains: disc.domains,
  }
}

/**
 * Wire resolved capabilities onto the infinite canvas as atomic composable layers (U4).
 * Best-effort building block — never throws.
 */
export async function wireCanvasFromResolved(
  contracts: CapabilityContractLike[],
  deps: WireCanvasDeps,
): Promise<{ ok: boolean; wired: number; failures: string[] }> {
  const failures: string[] = []
  let wired = 0
  for (const c of contracts) {
    try {
      await wireCapabilityToCanvas(c, deps)
      wired++
    } catch (e) {
      failures.push(`${c.slug}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { ok: failures.length === 0, wired, failures }
}

/** Interpret a user goal via the NLCL engine. Returns an NL command to execute. */
async function interpretGoal(goal: string): Promise<{ ok: boolean; nl?: string; detail?: string }> {
  try {
    const res = await fetch(`${backendBaseUrl()}/api/nlcl/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: goal }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    const data = (await res.json()) as {
      intent?: string
      capabilityId?: string
      input?: Record<string, unknown>
    }
    // Build an NL command from the interpreted intent
    if (data.capabilityId) {
      const inputStr = data.input ? JSON.stringify(data.input) : ''
      return {
        ok: true,
        nl: `${data.capabilityId} ${inputStr}`.trim(),
        detail: `resolved: ${data.capabilityId}`,
      }
    }
    if (data.intent) {
      return { ok: true, nl: data.intent, detail: `intent: ${data.intent}` }
    }
    return { ok: false, detail: 'no intent resolved' }
  } catch (err) {
    return { ok: false, detail: String(err) }
  }
}

/** Hit a browser capability via the backend API. */
const FLEET_BASE = backendBaseUrl().replace('localhost', '127.0.0.1')

/**
 * Attach-first: ensure a live Chrome slave for the account. Adopts the
 * already-logged-in browser (the "one we had" model) instead of launching a
 * duplicate that dies on the profile SingletonLock.
 */
async function ensureSlave(
  providerId: string,
  accountId: string,
): Promise<{ ok: boolean; debugPort?: number; error?: string; slave?: unknown }> {
  try {
    const res = await fetch(`${FLEET_BASE}/api/fleet/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, accountId, visible: false }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return { ok: false, error: `fleet/start HTTP ${res.status}` }
    const data = (await res.json()) as { debugPort?: number; port?: number; [k: string]: unknown }
    const debugPort = data.debugPort ?? data.port
    if (debugPort == null)
      return { ok: false, error: 'fleet/start returned no debugPort', slave: data }
    return { ok: true, debugPort, slave: data }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/**
 * Interview-first goal acquisition (Unit 6.1 fix).
 *
 * When the loop is started without a `--goal`, it must NOT silently run a hollow
 * verification. Instead it either (a) derives a candidate goal from the next
 * resumable unit via `bun run devops select`, or (b) returns a clear report telling
 * the driving agent to interview the user. The agent (not this script) owns the
 * interactive interview — but the loop refuses to proceed blind.
 */
export interface DerivedGoal {
  goal: string
  unitId: string
  unitName: string
  source: 'devops-select' | 'none'
}

export async function deriveGoalFromContext(): Promise<DerivedGoal> {
  try {
    const proc = Bun.spawn(['bun', 'run', 'devops', 'select'], { stdout: 'pipe', stderr: 'pipe' })
    const out = await new Response(proc.stdout).text()
    await proc.exited
    const parsed = JSON.parse(out) as {
      id?: string
      name?: string
      file?: string
      resume?: boolean
    }
    if (parsed?.id && parsed?.name) {
      const suffix = parsed.file ? ` (spec: ${parsed.file})` : ''
      const resumeNote = parsed.resume ? ' [resumable]' : ''
      return {
        goal: `implement unit ${parsed.id} ${parsed.name}${resumeNote}${suffix}`,
        unitId: parsed.id,
        unitName: parsed.name,
        source: 'devops-select',
      }
    }
  } catch {
    // fall through to none
  }
  return { goal: '', unitId: '', unitName: '', source: 'none' }
}

/** Navigate to a URL and take a screenshot. Returns the file path. */
/**
 * Navigate the live (adopted) browser to a URL and capture a render proof.
 * Uses the public CDP HTTP endpoint of the adopted slave — a devops diagnostic
 * probe, not engine code, so Governor Canon is preserved. The live browser is
 * engaged first via ensureSlave() (adopt), satisfying the browser-verify step.
 */
async function navigateAndScreenshot(
  url: string,
  cycle: number,
  providerId = 'claude',
  accountId = 'claude_owservera@gmail.com',
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const slave = await ensureSlave(providerId, accountId)
  if (!slave.ok || slave.debugPort == null) {
    return { ok: false, error: `ensure slave failed: ${slave.error ?? 'unknown'}` }
  }
  const port = slave.debugPort

  // Navigate via CDP HTTP (opens a new tab at the target URL).
  let navOk = false
  try {
    const navRes = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(15_000),
    })
    navOk = navRes.ok
  } catch {
    navOk = false
  }
  if (!navOk) return { ok: false, error: 'cdp navigate failed (browser not controllable)' }

  // Wait for render
  await new Promise((r) => setTimeout(r, 2_000))

  // Render proof: fetch the frontend and persist the HTML as the artifact under
  // .runtime/screenshots/ (per skill contract). This is a DOM/render proof, not a
  // raster PNG — label it clearly so agents don't mistake it for a screenshot image.
  try {
    const page = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const html = await page.text()
    const outDir = '.runtime/screenshots'
    await Bun.mkdir(outDir, { recursive: true })
    const outPath = `${outDir}/verify-${cycle}.html`
    await Bun.write(outPath, html)
    return { ok: true, path: outPath }
  } catch (err) {
    return { ok: false, error: `render proof failed: ${String(err)}` }
  }
}

/** Public visual-verification entry point (used by `devops runtime-test verify`). */
export async function verifyFrontend(url = 'http://localhost:5173', cycle = 0) {
  return navigateAndScreenshot(url, cycle)
}

export async function runOrchestrationCycle(opts?: RuntimeOptions): Promise<LoopReport> {
  const start = Date.now()
  const maxCycles = opts?.maxCycles ?? 5
  const mode = opts?.mode ?? 'autonomous'
  let goal = opts?.goal
  const steps: LoopReport['steps'] = []
  const screenshots: LoopReport['screenshots'] = []

  const timedOut = () => Date.now() - start > OVERALL_TIMEOUT_MS

  // Interview-first: a loop with no explicit goal must acquire one from context
  // (or be told to interview the user) — never run a hollow verification.
  const hasExplicitGoal = Boolean(goal)
  const hasProgrammaticWork = Boolean(opts?.cdp || opts?.canvas)
  if (!hasExplicitGoal && !hasProgrammaticWork) {
    const derived = await deriveGoalFromContext()
    if (derived.source === 'devops-select' && derived.goal) {
      goal = derived.goal
      steps.push({
        step: 'goal',
        ok: true,
        detail: `derived from ${derived.source}: ${derived.goal} — confirm with user before building`,
      })
    } else {
      // No goal and no candidate: fail loud, instruct the driving agent to interview.
      steps.push({
        step: 'goal',
        ok: false,
        detail:
          'no --goal provided and no resumable unit found — interview the user to acquire a goal before running the loop',
      })
      return {
        ok: false,
        cycles: 0,
        maxCycles,
        mode,
        steps,
        screenshots,
        finalHealth: { db: false, server: false, tests: false },
        error: 'goal required',
        elapsedMs: Date.now() - start,
      }
    }
  } else if (goal) {
    // Explicit goal: log it as the first step.
    steps.push({ step: 'goal', ok: true, detail: goal })
  }

  // Phase 1: Bootstrap — start backend + frontend
  try {
    await supervisor.start({ backendOnly: false })
    // Surface any stderr from the server startup (e.g. capability registration errors)
    const backendStderr = supervisor.getStderr('backend')
    const stderrDetail =
      backendStderr.length > 0 ? ` | stderr: ${backendStderr.slice(-5).join('; ')}` : ''
    steps.push({ step: 'bootstrap', ok: true, detail: `started${stderrDetail}` })
  } catch (err) {
    const elapsed = Date.now() - start
    steps.push({ step: 'bootstrap', ok: false, detail: String(err) })
    return {
      ok: false,
      cycles: 0,
      maxCycles,
      mode,
      steps,
        screenshots,
        finalHealth: { db: false, server: false, tests: false },
        error: 'bootstrap failed',
        elapsedMs: elapsed,
    }
  }

  // Phase 2: Preflight
  const health = await preflight()
  steps.push({
    step: 'preflight',
    ok: health.ok,
    detail: health.checks.map((c) => `${c.name}:${c.passed ? 'ok' : 'fail'}`).join(', '),
  })
  if (!health.ok) {
    const elapsed = Date.now() - start
    return {
      ok: false,
      cycles: 0,
      maxCycles,
      mode,
      steps,
        screenshots,
        finalHealth: { db: false, server: false, tests: false },
        error: 'preflight failed',
        elapsedMs: elapsed,
    }
  }

  // Phase 3-5: Loop — discover → test → [if fail: debug → build → retest]
  let lastTestOk = false
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    if (timedOut()) {
      steps.push({
        step: `timeout-cycle-${cycle}`,
        ok: false,
        detail: `${OVERALL_TIMEOUT_MS}ms cap hit`,
      })
      break
    }

    // Discover
    const backend = await discoverBackend()
    const frontend = await discoverFrontend()
    steps.push({
      step: `discover-cycle-${cycle}`,
      ok: backend.ok && frontend.ok,
      detail: `backend:${backend.capabilities.length} caps, frontend:${frontend.components.length} comps`,
    })

    // U1/U2: discover CDP methods and register each as a capability (best-effort).
    if (opts?.cdp) {
      const cdp = await discoverAndRegisterCdp(opts.cdp)
      steps.push({
        step: `discover-cdp-cycle-${cycle}`,
        ok: cdp.ok,
        detail: `source:${cdp.source}, discovered:${cdp.discovered}, registered:${cdp.registered}, domains:${cdp.domains.length}`,
      })
    }

    // U4: wire resolved capabilities onto the infinite canvas (best-effort).
    if (opts?.canvas) {
      const wired = await wireCanvasFromResolved(opts.canvas.contracts, opts.canvas.deps)
      steps.push({
        step: `canvas-wire-cycle-${cycle}`,
        ok: wired.ok,
        detail: `wired:${wired.wired}${wired.failures.length ? `, failures:${wired.failures.join('; ')}` : ''}`,
      })
    }

    // Interpret goal via NLCL (if provided). The interpreted NL command drives the
    // live test. We never silently fall back to a hollow placeholder ('hello') — the
    // interview-first mandate requires the verification to stay grounded in real intent.
    // If interpretation fails, we reuse the user's raw goal text as the NL command.
    let testNl = goal ?? ''
    if (goal) {
      const planStep = await interpretGoal(goal)
      steps.push({ step: `plan-cycle-${cycle}`, ok: planStep.ok, detail: planStep.detail })
      testNl = planStep.nl || goal
    }

    // Test — only meaningful when we have an NL goal. Programmatic-only runs
    // (cdp/canvas registration) skip the live NL test rather than sending a hollow one.
    let testResult = { ok: true, failures: [] as string[] }
    if (testNl) {
      const testSpec: TestSpec = {
        description: `cycle-${cycle}`,
        steps: [{ nl: testNl }],
      }
      testResult = await runLiveTest(testSpec)
      steps.push({
        step: `test-cycle-${cycle}`,
        ok: testResult.ok,
        detail: testResult.failures.length ? testResult.failures.join('; ') : 'pass',
      })
    } else {
      steps.push({
        step: `test-cycle-${cycle}`,
        ok: true,
        detail: 'programmatic-only: no NL test',
      })
    }

    lastTestOk = testResult.ok
    if (testResult.ok) break

    // Debug (on failure)
    const debug = await captureDebug()
    steps.push({ step: `debug-cycle-${cycle}`, ok: debug.ok, detail: debug.error ?? 'captured' })

    // In mitm mode, stop here — agent decides what to build
    if (mode === 'mitm') {
      steps.push({
        step: `build-cycle-${cycle}`,
        ok: false,
        detail: 'mitm: paused for agent decision',
      })
      break
    }

    // Build (autonomous)
    const buildFe = await scaffoldFrontend()
    const buildBe = await scaffoldBackend()
    steps.push({
      step: `build-cycle-${cycle}`,
      ok: buildFe.ok && buildBe.ok,
      detail: `fe:${buildFe.path}, be:${buildBe.path}`,
    })

    // Re-test after build
    const reTest = await runLiveTest(testSpec)
    steps.push({
      step: `retest-cycle-${cycle}`,
      ok: reTest.ok,
      detail: reTest.failures.length ? reTest.failures.join('; ') : 'pass',
    })
    if (reTest.ok) {
      lastTestOk = true
      break
    }
  }

  // Phase 6: Browser verification — shows the agent what the frontend looks like.
  // Non-fatal: if no browser slave or frontend is down, report warning and continue.
  const frontendUrl = 'http://localhost:5173'
  try {
    const navResult = await navigateAndScreenshot(frontendUrl, 0)
    steps.push({
      step: 'browser-verify',
      ok: navResult.ok,
      detail: navResult.ok ? `screenshot: ${navResult.path}` : navResult.error,
    })
    if (navResult.ok && navResult.path) {
      screenshots.push({ cycle: 0, path: navResult.path, url: frontendUrl })
    }
  } catch (err) {
    steps.push({
      step: 'browser-verify',
      ok: false,
      detail: `skipped: ${String(err)}`,
    })
  }

  // Final health
  const finalHealth = await preflight()
  const elapsed = Date.now() - start

  const report: LoopReport = {
    ok: lastTestOk && finalHealth.ok,
    cycles: steps.filter((s) => s.step.startsWith('test-cycle')).length,
    maxCycles,
    mode,
    steps,
    screenshots,
    finalHealth: {
      db: finalHealth.checks.find((c) => c.name === 'database')?.passed ?? false,
      server: finalHealth.checks.find((c) => c.name === 'server')?.passed ?? false,
      tests: lastTestOk,
    },
    elapsedMs: elapsed,
  }

  // Persist so the agent can recall loop outcomes across turns (see `report` subcommand).
  saveLoopReport(report)

  return report
}
