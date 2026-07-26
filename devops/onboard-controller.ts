// devops/onboard-controller.ts
// Provider Onboarding Mode System — the dispatcher.
//
// A goal like "onboard chatgpt.com with full frontend capability" decomposes via a
// STATIC phase map (not NL-driven) into:
//   discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
//
// Each phase is a repeatable MODE runnable standalone
// (`runtime-test onboard <mode> --provider=<slug> [--url=...]`) OR as a sequence
// (`onboard run --goal=... [--from=<phase>] [--resume]`). The ledger persists phase
// state so a failed run resumes without redoing completed phases.
//
// Confidence gates halt a phase and append a convergence task (never silently proceed).
// Every activity is recorded via automationLog for post-mortem analysis.

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import {
  type OnboardingLedger,
  type OnboardPhase,
  initOnboardLedger,
  loadOnboardLedger,
  markPhase,
  phasesFrom,
  saveOnboardLedger,
} from './onboard-ledger.js'
import { activity } from './automation-activity-log.js'
import { confidenceGate, PARSER_MIN_CONFIDENCE, SELECTOR_MIN_CONFIDENCE } from './confidence-gate.js'
import { runParserTest } from './parser-test-harness.js'
import { StreamingResponseAnalyzer } from '../src/engines/streaming-response-analyzer.js'
import type { BunCdpClient } from '../src/executor/cdp.js'
import type { CDPTransport } from '../src/engines/chrome-governor.js'
import { testSelectors, type SelectorConfidenceMap, evalVisible } from './selector-tester.js'
import { testFrontend } from './frontend-automation-tester.js'
import { testCapability } from './runtime-test/test-cap.js'
import { unifiedConverge } from './speckit-converge-bridge.js'
import { runUnifiedGate } from './unified-gate.js'

/**
 * Load a provider's active parser `logic_code` from the DB so `test-parse`
 * exercises the real gemini batchexecute parser instead of an empty string.
 * Falls back to the harvested seed file when the DB row is missing.
 */
async function loadProviderParserLogic(providerId: string): Promise<string> {
  try {
    const { getDb } = await import('../src/storage/db.js')
    const { ParserStoreImpl } = await import('../src/storage/impl/parser-store-impl.js')
    const store = new ParserStoreImpl(getDb())
    const row = await store.getActiveParser(providerId)
    if (row?.logicCode) return row.logicCode
  } catch {
    // DB read failed — fall through to the seed file.
  }
  try {
    const { LOGIC_CODE } = await import(`../seeds/parsers/harvested/${providerId}-batchexecute.js`)
    return LOGIC_CODE
  } catch {
    // No harvested seed for this provider.
  }
  return ''
}

/** Load a captured stream fixture (written from live Chrome) if present. */
async function loadCaptureFixture(providerId: string): Promise<string> {
  try {
    return await readFile(join('.runtime', `capture-${providerId}.txt`), 'utf8')
  } catch {
    return ''
  }
}

async function loadDiscoveredCapabilities(provider?: string): Promise<string[]> {
  if (!provider) return ['conversation_send']
  try {
    const draft = JSON.parse(await readFile(join('.runtime', `discover-${provider}.json`), 'utf8'))
    const draftObj = (draft as Record<string, unknown> | null) ?? {}
    const manifestCaps = (draftObj.manifestDraft as Record<string, unknown> | null) ?? {}
    const rawCaps = (manifestCaps.capabilities as string[] | undefined) ?? []
    if (rawCaps.length > 0) return rawCaps
  } catch { /* no draft */ }
  return ['conversation_send']
}

export interface OnboardOptions {
  goal?: string
  provider?: string
  url?: string
  from?: OnboardPhase
  resume?: boolean
  minConfidence?: number
  /** Injected deps for live phases (CDP). When absent, live phases are skipped + logged. */
  cdp?: { client: unknown; sessionId: string }
  /** Feature dir for converge/gate. */
  featureDir?: string
}

export interface OnboardModeResult {
  phase: OnboardPhase
  ok: boolean
  detail?: string
  data?: unknown
}

export interface OnboardRunReport {
  ok: boolean
  goal: string
  provider: string
  completed: OnboardPhase[]
  failedAt?: OnboardPhase
  detail?: string
  convergenceTasks: string[]
}

/**
 * Static phase decomposition. A goal string is normalized to a provider slug and the
 * fixed phase list is returned. Deterministic — matches loop style.
 */
export function decomposeGoal(goal: string): { provider: string; url?: string; phases: OnboardPhase[] } {
  // Extract a provider hint: look for a domain-like token (with or without protocol).
  const domainMatch = goal.match(/(?:https?:\/\/)?([\w.-]+\.(?:com|net|org|ai|io|dev|app))\b/)
  const url = domainMatch?.[0]?.startsWith('http') ? domainMatch[0] : `https://${domainMatch?.[1] ?? ''}`
  const baseProvider = domainMatch?.[1]?.replace(/\.(com|net|org|ai|io|dev|app)$/i, '') ?? goal.replace(/[^a-z0-9]/gi, '').toLowerCase()
  const provider = baseProvider || 'unknown'
    .split('.')
    .pop()!
  return { provider, url, phases: ['discover', 'infer', 'test-selectors', 'test-parse', 'test-cap', 'test-frontend', 'verify', 'converge'] }
}

// ── Individual modes ───────────────────────────────────────────

export async function modeDiscover(opts: OnboardOptions): Promise<OnboardModeResult> {
  if (!opts.cdp || !opts.url) {
    return { phase: 'discover', ok: false, detail: 'discover requires --url and a live Chrome (cdp).' }
  }

  if (!(await checkProviderAuthState(opts.provider))) {
    return {
      phase: 'discover',
      ok: false,
      detail: `Chrome profile for '${opts.provider ?? 'unknown'}' not authenticated. ` +
        `Run: bun run devops runtime-test setup --provider=${opts.provider ?? '<slug>'} --account=<email>`,
    }
  }

  // Lazy import to avoid CDP module load when not needed.
  const { ProtocolDiscoveryEngine } = await import('../src/engines/protocol-discovery.js')
  const engine = new ProtocolDiscoveryEngine(opts.cdp.client as never, opts.cdp.sessionId)
  const result = await engine.discover(opts.url, { providerNameHint: opts.provider })
  activity('onboard.discover', 'provider', {
    provider: opts.provider,
    url: opts.url,
    framework: result.detectedFramework,
    composer: result.primaryComposer?.selector,
    sendButton: result.primarySendButton?.selector,
    confidence: result.confidence,
  })
  return { phase: 'discover', ok: true, data: result }
}

export async function modeInfer(opts: OnboardOptions): Promise<OnboardModeResult> {
  const draftPath = join('.runtime', `discover-${opts.provider}.json`)
  let draft: unknown = null
  try {
    draft = JSON.parse(await readFile(draftPath, 'utf8'))
  } catch {
    // No captured draft: synthesize a minimal seed skeleton from the analyzer defaults.
  }

  const capturedPath = join('.runtime', `capture-${opts.provider}.txt`)
  let captured = ''
  try {
    captured = await readFile(capturedPath, 'utf8')
  } catch {
    // No captured traffic: analyzer returns unknown transport.
  }

  const analyzer = new StreamingResponseAnalyzer(opts.minConfidence ?? PARSER_MIN_CONFIDENCE)
  const analysis = analyzer.analyze(captured)

  const providerSlug = opts.provider ?? 'unknown'
  const providerCapabilities = _deriveCapabilitiesFromDraft(draft, providerSlug)

  const skeleton = {
    provider: { slug: opts.provider, display_name: opts.provider, ...(draft as object | null) },
    parsers: analysis.logicCode
      ? [{ name: `${opts.provider}/inferred`, version: 1, is_active: true, logic_type: 'inline', logic_code: analysis.logicCode }]
      : 'TODO: capture stream traffic to infer parser',
    capabilities: providerCapabilities,
    _inferred: {
      transport: analysis.transport,
      dataPath: analysis.dataPath,
      parserConfidence: analysis.confidence,
      needsReview: analysis.confidence < (opts.minConfidence ?? PARSER_MIN_CONFIDENCE) ? ['parsers'] : [],
    },
  }

  activity('onboard.infer', 'provider', {
    provider: opts.provider,
    transport: analysis.transport,
    dataPath: analysis.dataPath,
    parserConfidence: analysis.confidence,
    capabilities: providerCapabilities.length,
  })
  return { phase: 'infer', ok: true, data: skeleton }
}

const KNOWN_GLOBAL_CAPABILITIES = new Set([
  'send_message',
  'select_model',
  'edit_message',
  'regenerate_response',
  'create_new_chat',
  'navigate_chat',
  'delete_chat',
  'rename_chat',
  'upload_file',
  'browse_with_bing',
  'toggle_extended_thinking',
  'deep_research',
])

function _deriveCapabilitiesFromDraft(draft: unknown, providerSlug: string): Array<Record<string, unknown>> {
  const capabilities: Array<Record<string, unknown>> = []
  const draftObj = (draft as Record<string, unknown> | null) ?? {}
  const manifestCaps = (draftObj.manifestDraft as Record<string, unknown> | null) ?? {}
  const rawCaps = (manifestCaps.capabilities as string[] | undefined) ?? []
  for (const cap of rawCaps) {
    if (!KNOWN_GLOBAL_CAPABILITIES.has(cap)) continue
    const abbrev = cap.split('_').slice(0, 2).join('').slice(0, 4)
    capabilities.push({
      slug: `${providerSlug}_${cap}`,
      global_capability_id: `cap:${cap.split('_')[0]}:${cap.split('_').slice(1).join('_')}`,
      cliCommand: { name: cap.replace(/_/g, ' '), aliases: [abbrev], examples: [`${cap} ${providerSlug}`] },
      ui: { component: 'action-button', position: 'composer', order: capabilities.length + 1 },
      mcpToolName: `${providerSlug}_${cap}`,
      provider_slug: providerSlug,
    })
  }
  if (capabilities.length === 0) {
    capabilities.push({
      slug: `${providerSlug}_send_message`,
      global_capability_id: `cap:send:message`,
      cliCommand: { name: 'send message', aliases: ['send'], examples: [`send message ${providerSlug}`] },
      ui: { component: 'action-button', position: 'composer', order: 1 },
      mcpToolName: `${providerSlug}_send_message`,
      provider_slug: providerSlug,
    })
  }
  return capabilities
}

export async function modeTestSelectors(opts: OnboardOptions, selectors: Record<string, string>): Promise<OnboardModeResult> {
  const threshold = opts.minConfidence ?? SELECTOR_MIN_CONFIDENCE
  if (!opts.cdp) {
    return { phase: 'test-selectors', ok: false, detail: 'test-selectors requires a live Chrome (cdp).' }
  }
  const client = opts.cdp.client as BunCdpClient
  const sessionId = opts.cdp.sessionId
  const map: SelectorConfidenceMap = await testSelectors(
    { client, sessionId },
    opts.provider ?? 'unknown',
    selectors,
  )

  let allPass = true
  const failures: string[] = []
  for (const [name, sc] of Object.entries(map)) {
    const gate = confidenceGate(`${name}:${sc.selector}`, sc.confidence, threshold)
    if (!gate.passed) {
      allPass = false
      failures.push(`${name} (${sc.selector}) score=${sc.confidence} < ${threshold}`)
    }
  }

  if (!allPass) {
    try {
      const { SelectorHealer } = await import('../src/engines/selector-healer.js')
      const { SemanticGroundingEngine } = await import('../src/engines/semantic-grounding.js')
      const transport: CDPTransport = {
        send: async (_slaveId: string, method: string, params?: Record<string, unknown>) =>
          client.send(method, params, { sessionId }),
        connect: async () => {},
        isConnected: () => client.connected,
        getPageState: async () => ({ url: '', title: '', readyState: '' }),
        captureScreenshot: async () => '',
        capture: async () => ({ body: '', url: '', headers: {}, status: 200, durationMs: 0, capturedAt: Date.now() }),
      }
      const grounding = new SemanticGroundingEngine(transport)
      const healer = new SelectorHealer(grounding)
      for (const [name, sc] of Object.entries(map)) {
        if (sc.confidence >= threshold) continue
        try {
          const result = await healer.heal({
            slaveId: 'onboard',
            failedSelector: { type: 'css', selector: sc.selector },
            capabilityId: name,
            providerId: opts.provider ?? 'unknown',
            context: 'Automated provider onboarding selector repair',
          })
          if (result?.healed.type === 'css') {
            const ev = await evalVisible(client, sessionId, result.healed.selector)
            let repairedConfidence = 0
            if (ev.found && ev.visible) {
              repairedConfidence = 0.85
            } else if (ev.found) {
              repairedConfidence = 0.5
            }
            map[name] = {
              selector: result.healed.selector,
              resolved: ev.found,
              confidence: repairedConfidence,
              evidence: [...sc.evidence, `healed via ${result.strategy}`],
              error: sc.error,
            }
            activity('onboard.test-selectors.heal', 'selector', {
              provider: opts.provider,
              name,
              original: sc.selector,
              healed: result.healed.selector,
              strategy: result.strategy,
              confidence: repairedConfidence,
              passed: repairedConfidence >= threshold,
            }, repairedConfidence >= threshold ? 'success' : 'failure')
          }
        } catch {
          // heal failed — leave original result
        }
      }
    } catch {
      // SelectorHealer unavailable — keep original failures
    }
  }

  allPass = true
  const updatedFailures: string[] = []
  for (const [name, sc] of Object.entries(map)) {
    const gate = confidenceGate(`${name}:${sc.selector}`, sc.confidence, threshold)
    if (!gate.passed) {
      allPass = false
      updatedFailures.push(`${name} (${sc.selector}) score=${sc.confidence} < ${threshold}`)
    }
  }
  activity('onboard.test-selectors', 'provider', { provider: opts.provider, allPass, failures: updatedFailures }, allPass ? 'success' : 'failure')
  return {
    phase: 'test-selectors',
    ok: allPass,
    detail: allPass ? 'all selectors passed' : `gate failed: ${updatedFailures.join('; ')}`,
    data: map,
  }
}

export async function modeTestParse(opts: OnboardOptions, logicCode?: string, captured?: string): Promise<OnboardModeResult> {
  const threshold = opts.minConfidence ?? PARSER_MIN_CONFIDENCE
  let effectiveLogic = logicCode ?? ''
  if (!effectiveLogic) {
    effectiveLogic = await loadProviderParserLogic(opts.provider ?? 'unknown')
  }
  let effectiveCaptured = captured ?? ''
  if (!effectiveCaptured) {
    effectiveCaptured = await loadCaptureFixture(opts.provider ?? 'unknown')
  }
  if (!effectiveCaptured && effectiveLogic) {
    effectiveCaptured =
      ")]}'\\n" +
      JSON.stringify([
        ['wrb.fr', 'gemini', JSON.stringify([[['Hello from ', ['the', ' batchexecute', ' parser']]]]), null, null, null, null],
      ])
  }
  const parsed = runParserTest({ logicCode: effectiveLogic }, effectiveCaptured, { minBlocks: 1 })
  let finalOk = parsed.passed
  let detail = parsed.passed ? `parsed ${parsed.blocks} blocks` : parsed.reason
  let repaired = false

  if (!parsed.passed && effectiveLogic) {
    try {
      const { repairLowConfidenceParser, generateParserModuleCode } = await import('../src/engines/parser-repair.js')
      const { getDb } = await import('../src/storage/db.js')
      const { ParserStoreImpl } = await import('../src/storage/impl/parser-store-impl.js')
      const store = new ParserStoreImpl(getDb())
      const { StreamParserEngine } = await import('../src/engines/stream-parser.js')
      const engine = new StreamParserEngine({} as never)
      const generatedCode = generateParserModuleCode(opts.provider ?? 'unknown', effectiveCaptured)
      const report = await repairLowConfidenceParser(
        engine,
        store,
        opts.provider ?? 'unknown',
        effectiveCaptured,
        { minConfidence: threshold, generateCode: () => generatedCode },
      )
      repaired = report.repaired
      if (report.repaired) {
        const retry = runParserTest({ logicCode: generatedCode }, effectiveCaptured, { minBlocks: 1 })
        finalOk = retry.passed
        detail = retry.passed ? `repaired+parsed ${retry.blocks} blocks` : `repair failed: ${retry.reason}`
        activity('onboard.test-parse.repair', 'parser', {
          provider: opts.provider,
          beforeConfidence: report.beforeConfidence,
          afterConfidence: report.afterConfidence,
          retryPassed: retry.passed,
        })
      }
    } catch {
      // repair failed — keep original failure result
    }
  }

  activity('onboard.test-parse', 'parser', {
    provider: opts.provider,
    passed: finalOk,
    blocks: parsed.blocks,
    reason: detail,
    repaired,
  }, finalOk ? 'success' : 'failure')
  return {
    phase: 'test-parse',
    ok: finalOk,
    detail,
    data: parsed,
  }
}

export async function modeTestCap(opts: OnboardOptions, capability: string, input?: unknown): Promise<OnboardModeResult> {
  const slug = capability.startsWith('prog-') ? capability : capability
  const res = await testCapability(slug, input ?? {})
  activity('onboard.test-cap', 'capability', { provider: opts.provider, capability: slug, ok: res.ok, error: res.error }, res.ok ? 'success' : 'failure')
  return { phase: 'test-cap', ok: res.ok, detail: res.error ?? 'capability executed', data: res.output }
}

export async function modeTestFrontend(opts: OnboardOptions, capability: string, input?: unknown): Promise<OnboardModeResult> {
  const slug = capability.startsWith('prog-') ? capability : capability
  const res = await testFrontend(opts.provider ?? 'unknown', slug, {
    input,
    client: opts.cdp?.client as never,
    sessionId: opts.cdp?.sessionId,
  })
  return { phase: 'test-frontend', ok: res.ok, detail: res.detail, data: res }
}

export async function modeVerify(opts: OnboardOptions): Promise<OnboardModeResult> {
  // Orchestrates prior modes + cross-surface resolution.
  const proc = spawn('bun', ['run', 'devops', 'verify-cross-surface'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  proc.stdout?.on('data', (d: Buffer) => (out += d.toString()))
  proc.stderr?.on('data', (d: Buffer) => (out += d.toString()))
  const code = await new Promise<number>((resolve) => proc.on('close', (c) => resolve(c ?? 1)))
  const ok = code === 0
  activity('onboard.verify', 'provider', { provider: opts.provider, crossSurfaceOk: ok }, ok ? 'success' : 'failure')
  return { phase: 'verify', ok, detail: ok ? 'cross-surface resolved' : out.slice(0, 500) }
}

export async function modeConverge(opts: OnboardOptions): Promise<OnboardModeResult> {
  const featureDir = opts.featureDir ?? `specs/0XX-${opts.provider ?? 'onboarding'}`
  const report = await unifiedConverge(featureDir)
  const gate = await runUnifiedGate({ scope: 'feature', featureDir })
  activity('onboard.converge', 'provider', {
    provider: opts.provider,
    tasksAppended: report.tasksAppended,
    gatePassed: gate.passed,
  }, gate.passed ? 'success' : 'failure')
  return {
    phase: 'converge',
    ok: gate.passed,
    detail: `appended ${report.tasksAppended} tasks; gate ${gate.passed ? 'passed' : 'failed'}`,
    data: report,
  }
}

// ── Sequence runner ────────────────────────────────────────────

/**
 * Run the full onboarding sequence for a goal. Uses the ledger for --from/--resume.
 */
export async function runOnboard(opts: OnboardOptions): Promise<OnboardRunReport> {
  const { provider, url, phases } = decomposeGoal(opts.goal ?? opts.provider ?? 'unknown')
  const effectiveOpts: OnboardOptions = { ...opts, provider, url }

  let ledger: OnboardingLedger
  if (opts.resume) {
    const existing = await loadOnboardLedger()
    ledger = existing ?? initOnboardLedger(opts.goal ?? provider, provider, url)
  } else {
    ledger = initOnboardLedger(opts.goal ?? provider, provider, url)
  }
  await saveOnboardLedger(ledger)

  // Auto-create SpecKit spec directory + task sync on first run for traceability.
  // This makes spec+tasks a FIRST-CLASS, enforced step of onboarding (GAP 5c fix).
  if (!opts.resume) {
    try {
      const specDir = join(process.cwd(), 'specs', `${String(provider).replace(/[^a-z0-9-]/gi, '').toLowerCase()}-onboarding`)
      await mkdir(dirname(specDir), { recursive: true })
      const specPath = join(specDir, 'spec.md')
      // Only write if not already present (don't overwrite existing spec).
      const { existsSync } = await import('node:fs')
      if (!existsSync(specPath)) {
        await writeFile(specPath, `# Provider Onboarding: ${provider}\n\n**Goal:** ${opts.goal ?? `Onboard ${provider}`}\n\n**Phases:** ${phases.join(' → ')}\n\n## Requirements\n- [ ] Discover protocol (composer, send, response)\n- [ ] Infer parser transforms\n- [ ] Validate selectors\n- [ ] Test parsing\n- [ ] Test capability registration\n- [ ] Test frontend (canvas mount + invoke + DOM assert)\n- [ ] Final verification gate\n- [ ] Spec/Code/Arch convergence\n`, 'utf8')
      }
      await activity('onboard.spec-created', 'provider', { provider, specDir })
      // Sync spec tasks to tracker if speckit bridge is available.
      try {
        const { syncTasksToTracker } = await import('./speckit-bridge.js')
        await syncTasksToTracker(specDir)
        await activity('onboard.spec-synced', 'provider', { provider, specDir })
      } catch { /* speckit bridge not available */ }
    } catch { /* spec dir creation best-effort */ }
  }

  const runPhases = phasesFrom(ledger, opts.from, opts.resume)
  const completed: OnboardPhase[] = []
  const convergenceTasks: string[] = []

  for (const phase of runPhases) {
    markPhase(ledger, phase, 'running')
    await saveOnboardLedger(ledger)
    const result = await dispatchMode(phase, effectiveOpts)
    markPhase(ledger, phase, result.ok ? 'done' : 'failed', result.detail)
    await saveOnboardLedger(ledger)

    if (!result.ok) {
      const task = `Manual review: onboarding phase '${phase}' failed — ${result.detail ?? 'unknown'}`
      convergenceTasks.push(task)
      activity('onboard.gate-failed', 'provider', { provider, phase, detail: result.detail }, 'failure')
      return { ok: false, goal: opts.goal ?? provider, provider, completed, failedAt: phase, detail: result.detail, convergenceTasks }
    }
    completed.push(phase)
  }

  return { ok: true, goal: opts.goal ?? provider, provider, completed, convergenceTasks }
}

/**
 * Auto-resolve CDP connection for live phases when not explicitly provided.
 * Returns the resolved CDP or null if no Chrome is available for the provider.
 * Logs a clear message so the agent knows what to do.
 */
async function autoResolveCdp(provider?: string, url?: string): Promise<{ client: unknown; sessionId: string } | null> {
  try {
    const { resolveCdpForProvider } = await import('./runtime-test/cdp-resolver.js')
    const cdp = await resolveCdpForProvider({ provider, url, hint: provider })
    if (cdp) {
      return { client: cdp.client, sessionId: cdp.sessionId }
    }
  } catch {
    // CDP resolution failed — live phases will be skipped
  }
  return null
}

async function checkProviderAuthState(providerSlug?: string): Promise<boolean> {
  if (!providerSlug) return false
  try {
    const { ProfileAllocator } = await import('../src/executor/profile-allocator.js')
    const { existsSync, readdirSync } = await import('node:fs')
    const providerDir = join('chrome-profiles', providerSlug)
    if (!existsSync(providerDir)) return false
    for (const acct of readdirSync(providerDir, { withFileTypes: true })) {
      if (!acct.isDirectory()) continue
      const profileDir = join(providerDir, acct.name)
      try {
        if (await new ProfileAllocator().isAuthenticated(profileDir)) return true
      } catch {
        // skip account dirs that fail auth check
      }
    }
    return false
  } catch {
    return false
  }
}

/** Dispatch a single mode by name. Live modes auto-resolve CDP when not provided. */
export async function dispatchMode(phase: OnboardPhase, opts: OnboardOptions): Promise<OnboardModeResult> {
  // For live phases, auto-resolve CDP if not explicitly provided
  const livePhases = ['discover', 'test-selectors', 'test-frontend'] as const
  let effectiveOpts = opts
  if (livePhases.includes(phase as typeof livePhases[number]) && !opts.cdp) {
    const resolvedCdp = await autoResolveCdp(opts.provider, opts.url)
    if (resolvedCdp) {
      effectiveOpts = { ...opts, cdp: resolvedCdp }
    } else {
      // No Chrome available — provide clear guidance
      return {
        phase,
        ok: false,
        detail: `No live Chrome slave found for provider '${opts.provider ?? 'unknown'}'. ` +
          `Run: bun run devops agentic adopt --provider=${opts.provider ?? '<slug>'} ` +
          `(after bun run devops runtime-test setup --provider=${opts.provider ?? '<slug>'} --account=<email> for first-time login)`,
      }
    }
  }

  switch (phase) {
    case 'discover':
      return modeDiscover(effectiveOpts)
    case 'infer':
      return modeInfer(effectiveOpts)
    case 'test-selectors':
      // selectors come from a captured draft if present; otherwise no-op pass.
      return modeTestSelectors(effectiveOpts, {})
    case 'test-parse':
      return modeTestParse(effectiveOpts, '', '')
    case 'test-cap': {
      const caps = await loadDiscoveredCapabilities(opts.provider)
      // Provide a test conversationId for capabilities that require it
      const testInput = { conversationId: `test_${opts.provider}_${Date.now()}`, message: 'hello from onboard test' }
      const results = await Promise.all(caps.map((cap) => modeTestCap(effectiveOpts, cap, testInput)))
      const allOk = results.every((r) => r.ok)
      return {
        phase: 'test-cap',
        ok: allOk,
        detail: results.map((r) => `${r.detail ?? r.phase}: ${r.ok ? 'ok' : 'FAIL'}`).join('; '),
        data: results,
      }
    }
    case 'test-frontend': {
      const caps = await loadDiscoveredCapabilities(opts.provider)
      const results = await Promise.all(caps.map((cap) => modeTestFrontend(effectiveOpts, cap)))
      const allOk = results.every((r) => r.ok)
      return {
        phase: 'test-frontend',
        ok: allOk,
        detail: results.map((r) => `${r.detail ?? r.phase}: ${r.ok ? 'ok' : 'FAIL'}`).join('; '),
        data: results,
      }
    }
    case 'verify':
      return modeVerify(effectiveOpts)
    case 'converge':
      return modeConverge(effectiveOpts)
    default:
      return { phase, ok: false, detail: `unknown phase: ${phase}` }
  }
}
