// devops/llm-testing/system-brief.ts
// Spec 032 enhancement — makes the LLM-as-Human tester state-aware, atomic-aware,
// and conceptually guided so it can run more autonomously.
//
// Three capabilities are served from here:
//   1. brief  — a live system snapshot + conceptual understanding of the system
//               (architecture, objectives, invariants, how-to-run guide).
//   2. plan   — an atomic-level test plan: which capabilities / devops units are
//               untested, prioritized by risk, down to the single-capability grain.
//   3. status — extended to surface the brief + plan pointers (registry-extended).

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getLogger } from '../../src/lib/logger.js'
import type { UnifiedCapabilityRegistry } from '../../src/engines/unified-registry.js'
import { KnowledgeStore } from './knowledge-store.js'
import { PriorityEngine } from './priority-engine.js'
import type { TestSurface } from './types.js'

const log = getLogger('llm-testing:system-brief')

const PARITY_SURFACES: TestSurface[] = ['cli', 'ui', 'api', 'mcp']

// ── Conceptual understanding of the system (the "guide" the LLM reads) ──────

export interface SystemConcept {
  name: string
  summary: string
  objectives: string[]
  invariants: string[]
  architecture: string[]
  howToRun: string[]
  surfaces: Record<string, string>
}

export const SYSTEM_CONCEPT: SystemConcept = {
  name: 'vivim-final (cap-store v1 Knowledge Graph Rebuild)',
  summary:
    'A local-first AI conversation platform. Every operation is a UnifiedCapability resolved through ONE entry point: POST /api/capabilities/:id/execute. CLI and frontend are thin NL shells over that endpoint — there is no second transport.',
  objectives: [
    'Frontend = backend = cli = api = mcp: every capability reachable from all four parity surfaces.',
    'Governor Canon: only ChromeGovernor touches CDP; engines depend on store contracts, never impl.',
    'Research-first: no implementation without a classified research report.',
    'DB-only parser logic: stream parsers execute only from DB rows via SandboxRunner.',
    'LLM-as-Human: the platform tests itself across every surface as if it were a real user.',
  ],
  invariants: [
    'Only ChromeGovernor may open a CDP connection — never an engine directly.',
    'Engines depend on src/storage/contracts/*, never src/storage/impl/*.',
    'Parser logic lives only in DB (logic_type=inline); file-based parsers are rejected.',
    'Every capability is a UnifiedCapability; new behaviour is never a hand-written CLI command.',
    'One entry point: capabilities resolve to the same handler from cli/ui/api/mcp.',
  ],
  architecture: [
    'L0-L1 Provider Knowledge Graph: ProviderRegistrar, ProviderHealthKernel.',
    'L2-L3 Capability System: CapabilityResolutionEngine, CapabilityEngine.',
    'L4 Session & State: ConversationManager, StreamBlockStore.',
    'Chrome Layer: ChromeGovernor (CDP proxy, lifecycle, trace, health).',
    'Cross-cutting: CapabilityEventBus, ConfigManager, StreamParserEngine.',
    'Lifecycle: RegistrationAuditor, VersionManager, TelemetryAggregator.',
    'LLM-as-Human: 6 cap:llm_test:* capabilities drive the test orchestrator.',
  ],
  howToRun: [
    'Run a smoke pass: cap:llm_test:run { mode: "smoke" } — exercises first 10 tests per surface.',
    'Run full: mode "full" hits every discovered capability on every surface.',
    'Verify parity: cap:llm_test:parity — asserts every capability is on cli/ui/api/mcp.',
    'Target a provider: mode "providers", providers: ["gemini","chatgpt"].',
    'Read the brief first: cap:llm_test:brief gives you live state + this guide.',
    'Read the plan: cap:llm_test:plan tells you exactly what is untested, atom by atom.',
    'Autonomous loop: brief → plan → run(untested) → parity → fix gaps → re-run.',
  ],
  surfaces: {
    cli: 'Thin client to the running server. Derives commands from registry caps with cliCommand.name/aliases.',
    ui: 'Playwright via a Governor-routed PlaywrightBridge. Never direct CDP.',
    api: 'Universal route POST /api/capabilities/:id/execute — same handler the CLI calls.',
    mcp: 'WebSocket MCP server exposing every mcp-surface capability as a tool (port backendPort+1).',
    workflow: 'Mock WorkflowEngine execution — verifies capability wiring without side effects.',
    provider: 'Chrome slave via Governor-routed ChromeToolBridge. Rate-limited 5s, max 10 prompts.',
  },
}

export interface SystemSnapshot {
  capturedAt: string
  backend: {
    reachable: boolean
    port: number
    health?: Record<string, unknown>
  }
  mcp: {
    reachable: boolean
    port: number
    toolCount: number
  }
  registry: {
    totalCapabilities: number
    bySurface: Record<string, number>
    llmTestCapabilities: string[]
  }
  coverage: Array<{ surface: TestSurface; coverage: number }>
  parity: {
    total: number
    gaps: Array<{ capability: string; missing: string[] }>
  }
  providers: {
    known: string[]
    tested: string[]
    untested: string[]
  }
  recentSessions: Array<{ sessionId: string; mode: string; summary: string }>
  priorities: Array<{ surface: TestSurface; capability: string; reason: string; riskScore: number }>
}

export class SystemBrief {
  constructor(
    private readonly registry?: UnifiedCapabilityRegistry,
    private readonly backendPort = 9420,
  ) {}

  /** (1) Live state snapshot of the entire system. */
  async snapshot(): Promise<SystemSnapshot> {
    const knowledge = new KnowledgeStore()
    const priorities = new PriorityEngine(knowledge)
    const mcpPort = Number(process.env.MCP_PORT ?? 0) || this.backendPort + 1

    // backend health
    let backendReachable = false
    let health: Record<string, unknown> | undefined
    try {
      const r = await fetch(`http://localhost:${this.backendPort}/api/health`, { method: 'GET' })
      backendReachable = r.ok
      try {
        health = (await r.json()) as Record<string, unknown>
      } catch {
  // [audit] log the error with context here
        /* ignore */
      }
    } catch {
  // [audit] log the error with context here
      /* unreachable */
    }

    // mcp reachability
    let mcpReachable = false
    let toolCount = 0
    try {
      const r = await fetch(`http://127.0.0.1:${mcpPort}/tools`, { method: 'GET' })
      if (r.ok) {
        mcpReachable = true
        const j = (await r.json()) as { tools?: unknown[] }
        toolCount = j.tools?.length ?? 0
      }
    } catch {
  // [audit] log the error with context here
      /* mcp down */
    }

    // registry
    const caps = this.registry?.list() ?? []
    const bySurface: Record<string, number> = {}
    for (const c of caps) for (const s of c.surfaces) bySurface[s] = (bySurface[s] ?? 0) + 1
    const llmCaps = caps.filter((c) => c.slug.startsWith('llm_test')).map((c) => c.slug)

    // coverage + parity
    const coverage = (['cli', 'ui', 'api', 'mcp', 'workflow', 'provider'] as TestSurface[]).map(
      (s) => ({ surface: s, coverage: knowledge.getSurfaceCoverage(s)?.coverage ?? 0 }),
    )

    let parity = { total: 0, gaps: [] as Array<{ capability: string; missing: string[] }> }
    if (this.registry) {
      const gaps: Array<{ capability: string; missing: string[] }> = []
      for (const cap of this.registry.list()) {
        const missing = PARITY_SURFACES.filter((s) => !cap.surfaces.includes(s as never))
        if (missing.length > 0) gaps.push({ capability: cap.id, missing })
      }
      parity = { total: caps.length, gaps }
    }

    // providers
    const known = Object.keys(knowledge.getAllProviderKnowledge())
    const tested = known.filter((p) => (knowledge.getProviderKnowledge(p)?.successRate ?? 0) > 0)
    const untested = known.filter((p) => !tested.includes(p))

    // recent sessions
    const recentSessions = await this.readRecentSessions()

    return {
      capturedAt: new Date().toISOString(),
      backend: { reachable: backendReachable, port: this.backendPort, health },
      mcp: { reachable: mcpReachable, port: mcpPort, toolCount },
      registry: {
        totalCapabilities: caps.length,
        bySurface,
        llmTestCapabilities: llmCaps,
      },
      coverage,
      parity,
      providers: { known, tested, untested },
      recentSessions,
      priorities: priorities.computePriorities().slice(0, 10),
    }
  }

  /** (2) Atomic-level test plan: what is untested, down to the single capability. */
  async plan(): Promise<AtomicTestPlan> {
    const knowledge = new KnowledgeStore()
    const caps = this.registry?.list() ?? []

    const testedCapIds = new Set(
      knowledge
        .getPatterns()
        .map((p) => `${p.surface}:${p.capability}`),
    )

    const untested: AtomicTestItem[] = []
    for (const cap of caps) {
      for (const surface of cap.surfaces as TestSurface[]) {
        const key = `${surface}:${cap.slug}`
        if (!testedCapIds.has(key)) {
          untested.push({
            surface,
            capability: cap.slug,
            capabilityId: cap.id,
            inputShape: cap.inputSchema,
            reason: 'No learned pattern / execution record for this surface+capability.',
          })
        }
      }
    }

    // cross-reference with devops atomic tracker (Phase 14 units if present)
    const trackerUnits = await this.readTrackerUnits()

    // priority sort: mcp/ui first (historically dead surfaces), then by capability
    const rank: Record<string, number> = { mcp: 0, ui: 1, provider: 2, workflow: 3, api: 4, cli: 5 }
    untested.sort((a, b) => (rank[a.surface] ?? 9) - (rank[b.surface] ?? 9))

    return {
      generatedAt: new Date().toISOString(),
      totalCapabilities: caps.length,
      untestedCount: untested.length,
      untested,
      atomicUnits: trackerUnits,
      recommendedFirstPass: untested.slice(0, 20).map((u) => `${u.surface}::${u.capability}`),
      autonomousLoop: [
        '1. Read brief (cap:llm_test:brief) to learn system state + invariants.',
        '2. Read plan (cap:llm_test:plan) to see untested surface::capability pairs.',
        '3. Run cap:llm_test:run targeting untested surfaces (mode "full" or specific surfaces).',
        '4. Run cap:llm_test:parity — assert every capability is on cli/ui/api/mcp.',
        '5. For each parity gap or failure, record the fix and re-run.',
        '6. Repeat until parityGaps is empty and coverage is 100% on all four parity surfaces.',
      ],
    }
  }

  /** (3) Conceptual understanding the LLM reads to self-direct. */
  concept(): SystemConcept {
    return SYSTEM_CONCEPT
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async readRecentSessions(): Promise<
    Array<{ sessionId: string; mode: string; summary: string }>
  > {
    try {
      const dir = join(process.cwd(), '.runtime', 'llm-testing', 'reports')
      if (!existsSync(dir)) return []
      const { readdirSync } = await import('node:fs')
      const md = readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .slice(-5)
      return md.map((f) => {
        const sid = f.replace('.md', '')
        const head = readFileSync(join(dir, f), 'utf8').split('\n').slice(0, 12).join(' ')
        return { sessionId: sid, mode: sid.includes('parity') ? 'parity' : 'mixed', summary: head }
      })
    } catch {
      return []
    }
  }

  private async readTrackerUnits(): Promise<
    Array<{ id: string; name: string; phase: string; status: string }>
  > {
    const trackerPath = join(
      process.cwd(),
      'docs',
      'atomic-v3-fork-canon',
      '01-tracker.md',
    )
    if (!existsSync(trackerPath)) return []
    try {
      const raw = readFileSync(trackerPath, 'utf8')
      // Capture unit header lines like "### 14.1 Unit name — status"
      const re = /###\s+(\S+)\s+(.+?)\s+[—-]\s+(pending|in_progress|done|blocked|exists|not-implemented)/gi
      const out: Array<{ id: string; name: string; phase: string; status: string }> = []
      let m = re.exec(raw)
      while (m !== null) {
        out.push({ id: m[1]!, name: (m[2] ?? '').trim(), phase: '14', status: (m[3] ?? '').toLowerCase() })
        m = re.exec(raw)
      }
      return out.slice(0, 40)
    } catch {
      return []
    }
  }
}

// ── Types returned to the LLM ───────────────────────────────────────────────

export interface AtomicTestItem {
  surface: TestSurface
  capability: string
  capabilityId: string
  inputShape?: unknown
  reason: string
}

export interface AtomicTestPlan {
  generatedAt: string
  totalCapabilities: number
  untestedCount: number
  untested: AtomicTestItem[]
  atomicUnits: Array<{ id: string; name: string; phase: string; status: string }>
  recommendedFirstPass: string[]
  autonomousLoop: string[]
}
