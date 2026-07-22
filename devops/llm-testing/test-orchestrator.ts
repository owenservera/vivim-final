// devops/llm-testing/test-orchestrator.ts
// Main orchestrator — routes tests to adapters, collects results, triggers knowledge updates.

import { getLogger } from '../../src/lib/logger.js'
import type { UnifiedCapabilityRegistry } from '../../src/engines/unified-registry.js'
import type { LocalAgentStore } from '../../src/storage/contracts/local-agent-store.js'
import type { AgenticStoreContract } from '../../src/storage/contracts/agentic-store.js'
import type { EventRecordStore } from '../../src/engines/event-record-store.js'
import { ApiAdapter } from './adapters/api-adapter.js'
import { CliAdapter } from './adapters/cli-adapter.js'
import { McpAdapter } from './adapters/mcp-adapter.js'
import type { SurfaceAdapter } from './adapters/surface-adapter.js'
import { UiAdapter, type PlaywrightBridge } from './adapters/ui-adapter.js'
import { WorkflowAdapter } from './adapters/workflow-adapter.js'
import { ProviderAdapter, type ChromeToolBridge } from './adapters/provider-adapter.js'
import { KnowledgeStore } from './knowledge-store.js'
import { PatternAnalyzer } from './pattern-analyzer.js'
import { PriorityEngine } from './priority-engine.js'
import { SessionWriter } from './session-writer.js'
import type {
  SessionSummary,
  SessionTrace,
  TestConfig,
  TestCase,
  TestMode,
  TestResult,
  TestSurface,
} from './types.js'

const log = getLogger('llm-testing:orchestrator')

const DEFAULT_CONFIG: TestConfig = {
  backendPort: 9420,
  frontendPort: 5175,
  // `opencode` is vivim's bundled LOCAL provider LLM (supervised `opencode
  // serve` subprocess) — exercised via its native client, not a Chrome slave.
  providers: ['gemini', 'chatgpt', 'claude', 'opencode'],
  timeoutMs: 10000,
  maxProviderPrompts: 10,
  providerDelayMs: 5000,
}

export interface OrchestratorOptions {
  config?: Partial<TestConfig>
  mode?: TestMode
  surfaces?: TestSurface[]
  providers?: string[]
  playwrightBridge?: PlaywrightBridge
  chromeBridge?: ChromeToolBridge
  registry?: UnifiedCapabilityRegistry
  localAgentStore?: LocalAgentStore
  /** T16 — memory projection stores (also auto-discovered from globalThis.__capStoreMemory). */
  agenticStore?: AgenticStoreContract
  eventRecordStore?: EventRecordStore
}

export class TestOrchestrator {
  private config: TestConfig
  private knowledge: KnowledgeStore
  private analyzer: PatternAnalyzer
  private priorities: PriorityEngine
  private writer: SessionWriter
  private adapters: Map<TestSurface, SurfaceAdapter> = new Map()
  private registry?: UnifiedCapabilityRegistry

  constructor(options?: OrchestratorOptions) {
    this.config = { ...DEFAULT_CONFIG, ...options?.config }
    if (options?.providers) this.config.providers = options.providers
    this.registry = options?.registry

    this.knowledge = new KnowledgeStore()
    this.analyzer = new PatternAnalyzer(this.knowledge)
    this.priorities = new PriorityEngine(this.knowledge)
    this.writer = new SessionWriter()

    this.initAdapters(options)
  }

  async run(options?: OrchestratorOptions): Promise<SessionTrace> {
    const sessionId = this.generateSessionId()
    const mode = options?.mode ?? 'smoke'
    const surfaces = options?.surfaces ?? ['cli', 'api', 'mcp', 'workflow', 'provider']
    const start = new Date().toISOString()

    log.info({ mode, surfaces }, `Starting test session ${sessionId}`)

    const allResults: TestResult[] = []
    const beforeCoverage = this.captureCoverage()

    for (const surface of surfaces) {
      const adapter = this.adapters.get(surface)
      if (!adapter) {
        log.warn(`No adapter for surface: ${surface}`)
        continue
      }

      try {
        await adapter.init(this.config, this.registry)
        const tests = await adapter.discoverCapabilities()
        const selected = this.selectTests(tests, mode)

        for (const test of selected) {
          const result = await adapter.execute(test)
          allResults.push(result)
          log.info({ surface: result.surface, capability: result.capability }, `Test ${result.id}: ${result.status}`)
        }
      } catch (err) {
        log.error({ err }, `Surface ${surface} failed`)
      }
    }

    const delta = this.analyzer.analyze(allResults)
    this.knowledge.mergeDelta(delta)
    this.analyzer.updateCoverage(allResults)
    this.priorities.computePriorities()

    const afterCoverage = this.captureCoverage()
    const summary = this.buildSummary(allResults, delta.newPatterns.length, delta.newErrors.length, beforeCoverage, afterCoverage)

    const trace: SessionTrace = {
      sessionId,
      startedAt: start,
      endedAt: new Date().toISOString(),
      mode,
      config: {
        backendPort: this.config.backendPort,
        frontendPort: this.config.frontendPort,
        providers: this.config.providers,
      },
      tests: allResults,
      summary,
    }

    this.writer.writeSession(trace)
    this.writer.writeReport(trace)

    log.info({ total: summary.total, passed: summary.passed, failed: summary.failed }, `Session ${sessionId} complete`)

    await this.cleanup()

    return trace
  }

  getKnowledge(): KnowledgeStore {
    return this.knowledge
  }

  getPriorities(): PriorityEngine {
    return this.priorities
  }

  /**
   * V3 — Cross-surface parity verification.
   * The user mandate "frontend = backend = cli = api = mcp" means every
   * capability must be reachable from the same canonical slug across the
   * four parity surfaces. This scans the unified registry and reports any
   * capability that is missing from one of the expected surfaces, so the
   * One-Entry-Point invariant can be asserted automatically.
   *
   * If no registry is wired, returns an empty result (nothing to verify).
   */
  verifyCrossSurface(filter?: { category?: string; tag?: string }): {
    total: number
    parityGaps: Array<{
      capability: string
      slug: string
      missing: string[]
    }>
  } {
    if (!this.registry) {
      log.warn('verifyCrossSurface: no registry wired, skipping')
      return { total: 0, parityGaps: [] }
    }

    const PARITY_SURFACES = ['cli', 'ui', 'api', 'mcp'] as const
    const caps = this.registry.list({
      ...(filter?.category ? { category: filter.category } : {}),
      ...(filter?.tag ? { tag: filter.tag } : {}),
    })

    const parityGaps: Array<{ capability: string; slug: string; missing: string[] }> = []
    for (const cap of caps) {
      const missing = PARITY_SURFACES.filter((s) => !cap.surfaces.includes(s as never))
      if (missing.length > 0) {
        parityGaps.push({ capability: cap.id, slug: cap.slug, missing })
      }
    }

    return { total: caps.length, parityGaps }
  }

  private initAdapters(options?: OrchestratorOptions) {
    const cli = new CliAdapter()
    const api = new ApiAdapter()
    const mcp = new McpAdapter()
    const workflow = new WorkflowAdapter()
    const ui = new UiAdapter()
    const provider = new ProviderAdapter(this.knowledge)

    if (options?.playwrightBridge) ui.setBridge(options.playwrightBridge)
    if (options?.chromeBridge) provider.setBridge(options.chromeBridge)
    if (options?.localAgentStore) provider.setLocalAgentStore(options.localAgentStore)

    // T16 — wire memory projection stores (explicit option, else global fallback).
    const mem = (globalThis as Record<string, unknown>).__capStoreMemory as
      | { agenticStore?: AgenticStoreContract; eventRecordStore?: EventRecordStore }
      | undefined
    const agenticStore = options?.agenticStore ?? mem?.agenticStore ?? null
    const eventRecordStore = options?.eventRecordStore ?? mem?.eventRecordStore ?? null
    if (agenticStore || eventRecordStore) {
      provider.setMemoryStores(agenticStore, eventRecordStore)
    }

    const serve = (globalThis as Record<string, unknown>).__opencodeServe as
      | { client?: import('../../src/engines/opencode/opencode-client.js').OpenCodeClient }
      | undefined
    if (serve?.client) provider.setOpenCodeClient(serve.client)

    this.adapters.set('cli', cli)
    this.adapters.set('api', api)
    this.adapters.set('mcp', mcp)
    this.adapters.set('workflow', workflow)
    this.adapters.set('ui', ui)
    this.adapters.set('provider', provider)
  }

  private selectTests(tests: TestCase[], mode: TestMode): TestCase[] {
    if (mode === 'full') return tests
    if (mode === 'smoke') return tests.slice(0, 10)
    if (mode === 'parity') return tests.filter((t) => ['cli', 'ui'].includes(t.surface))
    if (mode === 'providers') return tests.filter((t) => t.surface === 'provider')
    return tests.slice(0, 10)
  }

  private captureCoverage(): Record<TestSurface, number> {
    const result: Partial<Record<TestSurface, number>> = {}
    for (const surface of ['cli', 'ui', 'api', 'mcp', 'workflow', 'provider'] as TestSurface[]) {
      const c = this.knowledge.getSurfaceCoverage(surface)
      result[surface] = c?.coverage ?? 0
    }
    return result as Record<TestSurface, number>
  }

  private buildSummary(
    results: TestResult[],
    newPatterns: number,
    newErrors: number,
    before: Record<TestSurface, number>,
    after: Record<TestSurface, number>,
  ): SessionSummary {
    return {
      total: results.length,
      passed: results.filter((r) => r.status === 'pass').length,
      failed: results.filter((r) => r.status === 'fail').length,
      skipped: results.filter((r) => r.status === 'skip').length,
      errored: results.filter((r) => r.status === 'error').length,
      newPatternsLearned: newPatterns,
      errorsEncountered: newErrors,
      coverageDelta: Object.fromEntries(
        Object.keys(after).map((s) => [s as TestSurface, { before: before[s as TestSurface] ?? 0, after: after[s as TestSurface] ?? 0 }]),
      ) as Record<TestSurface, { before: number; after: number }>,
    }
  }

  private generateSessionId(): string {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `sess_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  }

  private async cleanup() {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.cleanup()
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
