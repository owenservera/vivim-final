// devops/llm-testing/capabilities.ts
// Spec 032 — register the LLM-as-Human testing system as a single
// UnifiedCapability instead of a hand-written CLI command tree.
// This collapses `llm-test` into the One Entry Point: the capability is
// defined once and auto-exported to cli / api / mcp surfaces, exactly like
// every other capability. The orchestrator is invoked through the registry
// handler, never as a parallel transport.
// (Relocated from src/engines per architecture decision: llm-testing is a
// devops system; the local-provider engine stays in src/engines/opencode.)

import { type BootstrapServices, makeCapability } from '../../src/engines/capability-bootstrap.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { UnifiedCapability, UnifiedCapabilityRegistry } from '../../src/engines/unified-registry.js'
import {
  TestOrchestrator,
  SystemBrief,
  type TestMode,
  type TestSurface,
} from './index.js'

const MODES = ['smoke', 'full', 'parity', 'providers', 'workflow'] as const
const SURFACES = ['cli', 'ui', 'api', 'mcp', 'workflow', 'provider'] as const

function coerceMode(v: unknown): TestMode {
  return (MODES as readonly string[]).includes(String(v)) ? (v as TestMode) : 'smoke'
}
function coerceSurfaces(v: unknown): TestSurface[] | undefined {
  if (!Array.isArray(v)) return undefined
  const valid = v.filter((s) => (SURFACES as readonly string[]).includes(String(s)))
  return valid.length > 0 ? (valid as TestSurface[]) : undefined
}
function coerceProviders(v: unknown): string[] | undefined {
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  if (Array.isArray(v)) return v.map(String)
  return undefined
}

// Best-effort read of the live backend port so the brief can probe real state.
function liveBackendPort(): number {
  try {
    const p = Number(readFileSync(join(process.cwd(), '.runtime', 'backend.port'), 'utf8').trim())
    if (!Number.isNaN(p) && p > 0) return p
  } catch {
  // [audit] log the error with context here
    /* fall through */
  }
  return Number(process.env.CAP_STORE_PORT ?? 9420)
}

/**
 * Register the LLM-testing capability into the unified registry.
 * Handler runs the orchestrator and returns the session trace — the same
 * object that was previously emitted by the hand-written `llm-test run` CLI
 * command. No second transport is opened.
 */
export function registerLlmTestCapabilities(
  registry: UnifiedCapabilityRegistry,
  services: BootstrapServices,
): void {
  const runCap = makeCapability(
    {
      id: 'cap:llm_test:run',
      // Surface-aware: the orchestrator needs the live registry so the mcp
      // adapter can discover tools and parity can assert cross-surface reach.
      slug: 'llm_test_run',
      name: 'Run LLM-as-Human Tests',
      description:
        'Run the LLM-as-Human production test suite across surfaces (cli/ui/api/mcp/workflow/provider) and providers.',
      category: 'testing',
      inputSchema: {
        type: 'object',
        properties: {
          mode: { type: 'string', description: `One of: ${MODES.join(', ')}` },
          surfaces: {
            type: 'array',
            description: `Subset of: ${SURFACES.join(', ')}`,
          },
          providers: { type: 'array', description: 'Provider slugs to test' },
        },
      },
      outputSchema: { type: 'object' },
      cliCommand: {
        name: 'llm-test run',
        aliases: ['ltr'],
        examples: [
          'llm-test run --mode smoke',
          'llm-test run --mode full --surface cli --surface ui',
          'llm-test run --mode providers --providers gemini,chatgpt',
        ],
      },
      mcpToolName: 'llm_test_run',
      apiEndpoint: { method: 'POST', path: '/api/capabilities/cap:llm_test:run/execute' },
      ui: { component: 'llm-test-panel', position: 'devtools', order: 1 },
      surfaces: ['cli', 'ui', 'api', 'mcp'],
    },
    async (input) => {
      const orchestrator = new TestOrchestrator({
        registry,
        localAgentStore: services.localAgentStore,
      })
      const trace = await orchestrator.run({
        mode: coerceMode(input.mode),
        surfaces: coerceSurfaces(input.surfaces),
        providers: coerceProviders(input.providers),
      })
      return {
        sessionId: trace.sessionId,
        summary: trace.summary,
        trace,
      }
    },
  )

  const reportCap = makeCapability(
    {
      id: 'cap:llm_test:report',
      slug: 'llm_test_report',
      name: 'Show LLM Test Report',
      description: 'Show the markdown report for a finished LLM test session.',
      category: 'testing',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Session id (sess_YYYYMMDD_HHMMSS)' },
        },
        required: ['sessionId'],
      },
      outputSchema: { type: 'string' },
      cliCommand: {
        name: 'llm-test report',
        aliases: ['ltrr'],
        examples: ['llm-test report sess_20260720_120000'],
      },
      mcpToolName: 'llm_test_report',
      apiEndpoint: { method: 'POST', path: '/api/capabilities/cap:llm_test:report/execute' },
      ui: { component: 'llm-test-panel', position: 'devtools', order: 2 },
      surfaces: ['cli', 'ui', 'api', 'mcp'],
    },
    async (input) => {
      const sessionId = String(input.sessionId ?? '')
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const path = join(
        process.cwd(),
        '.runtime',
        'llm-testing',
        'reports',
        `${sessionId}.md`,
      )
      try {
        return readFileSync(path, 'utf8')
      } catch {
        return `Report not found: ${path}`
      }
    },
  )

  const statusCap = makeCapability(
    {
      id: 'cap:llm_test:status',
      slug: 'llm_test_status',
      name: 'LLM Test Status',
      description: 'Show test coverage and prioritized risk queue.',
      category: 'testing',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object' },
      cliCommand: {
        name: 'llm-test status',
        aliases: ['lts'],
        examples: ['llm-test status'],
      },
      mcpToolName: 'llm_test_status',
      apiEndpoint: { method: 'POST', path: '/api/capabilities/cap:llm_test:status/execute' },
      ui: { component: 'llm-test-panel', position: 'devtools', order: 3 },
      surfaces: ['cli', 'ui', 'api', 'mcp'],
    },
    async () => {
      const { KnowledgeStore } = await import('./knowledge-store.js')
      const { PriorityEngine } = await import('./priority-engine.js')
      const knowledge = new KnowledgeStore()
      const priorities = new PriorityEngine(knowledge)
      const coverage = SURFACES.map((s) => ({
        surface: s,
        coverage: knowledge.getSurfaceCoverage(s)?.coverage ?? 0,
      }))
      return { coverage, priorities: priorities.computePriorities().slice(0, 10) }
    },
  )

  const patternsCap = makeCapability(
    {
      id: 'cap:llm_test:patterns',
      slug: 'llm_test_patterns',
      name: 'LLM Test Patterns',
      description: 'Show learned LLM-as-Human test patterns.',
      category: 'testing',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'array' },
      cliCommand: {
        name: 'llm-test patterns',
        aliases: ['ltp'],
        examples: ['llm-test patterns'],
      },
      mcpToolName: 'llm_test_patterns',
      apiEndpoint: { method: 'POST', path: '/api/capabilities/cap:llm_test:patterns/execute' },
      ui: { component: 'llm-test-panel', position: 'devtools', order: 4 },
      surfaces: ['cli', 'ui', 'api', 'mcp'],
    },
    async () => {
      const { KnowledgeStore } = await import('./knowledge-store.js')
      return new KnowledgeStore().getPatterns()
    },
  )

  const providersCap = makeCapability(
    {
      id: 'cap:llm_test:providers',
      slug: 'llm_test_providers',
      name: 'LLM Test Providers',
      description: 'Show provider knowledge (selectors, quirks, success rates).',
      category: 'testing',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object' },
      cliCommand: {
        name: 'llm-test providers',
        aliases: ['ltpv'],
        examples: ['llm-test providers'],
      },
      mcpToolName: 'llm_test_providers',
      apiEndpoint: { method: 'POST', path: '/api/capabilities/cap:llm_test:providers/execute' },
      ui: { component: 'llm-test-panel', position: 'devtools', order: 5 },
      surfaces: ['cli', 'ui', 'api', 'mcp'],
    },
    async () => {
      const { KnowledgeStore } = await import('./knowledge-store.js')
      return new KnowledgeStore().getAllProviderKnowledge()
    },
  )

  registry.register(runCap)
  registry.register(reportCap)
  registry.register(statusCap)
  registry.register(patternsCap)
  registry.register(providersCap)

  // V3+ — system brief: live state snapshot + conceptual understanding so the
  // LLM tester is state-aware and self-guiding before it runs anything.
  const briefCap = makeCapability(
    {
      id: 'cap:llm_test:brief',
      slug: 'llm_test_brief',
      name: 'LLM Test System Brief',
      description:
        'Live system snapshot (backend/mcp/registry/coverage/parity/providers) plus conceptual understanding of the architecture, objectives, and invariants so the tester can self-direct.',
      category: 'testing',
      inputSchema: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            description: 'Optional subset: state | concept | both',
          },
        },
      },
      outputSchema: { type: 'object' },
      cliCommand: {
        name: 'llm-test brief',
        aliases: ['ltb'],
        examples: ['llm-test brief', 'llm-test brief --section concept'],
      },
      mcpToolName: 'llm_test_brief',
      apiEndpoint: { method: 'POST', path: '/api/capabilities/cap:llm_test:brief/execute' },
      ui: { component: 'llm-test-panel', position: 'devtools', order: 6 },
      surfaces: ['cli', 'ui', 'api', 'mcp'],
    },
    async (input) => {
      const brief = new SystemBrief(registry, liveBackendPort())
      const section = String(input.section ?? 'both')
      const out: Record<string, unknown> = {}
      if (section !== 'concept') out.state = await brief.snapshot()
      if (section !== 'state') out.concept = brief.concept()
      return out
    },
  )

  // V3+ — atomic test plan: exactly what is untested, down to surface::capability,
  // cross-referenced with the devops atomic tracker (Phase 14 units).
  const planCap = makeCapability(
    {
      id: 'cap:llm_test:plan',
      slug: 'llm_test_plan',
      name: 'LLM Test Atomic Plan',
      description:
        'Atomic-level test plan: enumerate untested surface::capability pairs, prioritized, with the autonomous run loop.',
      category: 'testing',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object' },
      cliCommand: {
        name: 'llm-test plan',
        aliases: ['ltpl'],
        examples: ['llm-test plan'],
      },
      mcpToolName: 'llm_test_plan',
      apiEndpoint: { method: 'POST', path: '/api/capabilities/cap:llm_test:plan/execute' },
      ui: { component: 'llm-test-panel', position: 'devtools', order: 7 },
      surfaces: ['cli', 'ui', 'api', 'mcp'],
    },
    async () => {
      const brief = new SystemBrief(registry, 9420)
      return brief.plan()
    },
  )

  registry.register(briefCap)
  registry.register(planCap)

  // V3 — explicit cross-surface parity assertion. This is the machine-readable
  // form of the "frontend = backend = cli = api = mcp" mandate: it confirms
  // every canonical capability is reachable from all four parity surfaces.
  const parityCap = makeCapability(
    {
      id: 'cap:llm_test:parity',
      slug: 'llm_test_parity',
      name: 'Verify Cross-Surface Parity',
      description:
        'Verify every capability is reachable from all four parity surfaces (cli/ui/api/mcp).',
      category: 'testing',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          tag: { type: 'string' },
        },
      },
      outputSchema: { type: 'object' },
      cliCommand: {
        name: 'llm-test parity',
        aliases: ['ltpar'],
        examples: ['llm-test parity', 'llm-test parity --category conversation'],
      },
      mcpToolName: 'llm_test_parity',
      apiEndpoint: { method: 'POST', path: '/api/capabilities/cap:llm_test:parity/execute' },
      ui: { component: 'llm-test-panel', position: 'devtools', order: 8 },
      surfaces: ['cli', 'ui', 'api', 'mcp'],
    },
    async (input) => {
      const orchestrator = new TestOrchestrator({ registry })
      const result = orchestrator.verifyCrossSurface({
        category: input.category ? String(input.category) : undefined,
        tag: input.tag ? String(input.tag) : undefined,
      })
      return {
        ...result,
        pass: result.parityGaps.length === 0,
      }
    },
  )

  registry.register(parityCap)
}
