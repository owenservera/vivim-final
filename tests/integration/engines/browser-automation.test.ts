import { describe, expect, mock, test } from 'bun:test'
import { AutomationOrchestrator } from '../../../src/engines/automation/orchestrator.js'
import { getRecipe } from '../../../src/engines/browser-automation/recipes.js'
import { SelectorHealer } from '../../../src/engines/browser-automation/selector-healer.js'
import type { CDPTransport } from '../../../src/engines/chrome-governor.js'
import { compileRecipe } from '../../../src/engines/harness/recipe-compiler.js'
import type { GovernorStore } from '../../../src/storage/contracts/governor-store.js'
import type {
  SelectorHealStore,
  SelectorStrategyRow,
} from '../../../src/storage/contracts/selector-heal-store.js'

/**
 * Integration test of the orchestration layer (recipe → compile → governor).
 * We mock the ChromeGovernor surface so no real browser is launched; the point
 * is to verify the orchestrator drives the governor ONLY through its public
 * `runHarnessPlan` entry (Governor Canon: all CDP is funneled via the governor).
 */
function makeMockGovernor() {
  const cdpCalls: Array<{ method: string; params?: Record<string, unknown> }> = []
  const transport: CDPTransport = {
    async send(_slaveId: string, method: string, params?: Record<string, unknown>) {
      cdpCalls.push({ method, params })
      if (method === 'Page.navigate') return {}
      if (method === 'Runtime.evaluate')
        return { result: { result: { value: '<html><body>ok</body></html>' } } }
      if (method === 'DOM.getBoxModel')
        return { model: { content: { x: 0, y: 0, width: 5, height: 5 } } }
      return {}
    },
    async capture(_slaveId: string, _pattern: RegExp, _timeoutMs?: number) {
      return { body: '', matches: [] }
    },
    async getPageState(_slaveId: string) {
      return { url: 'about:blank', title: '' }
    },
    async captureScreenshot(_slaveId: string, _format?: 'png' | 'jpeg') {
      return ''
    },
  }
  const govStore = {
    getAccount: async () => null,
    getAccountsByProvider: async () => [],
    upsertAccount: async () => {},
    deleteAccount: async () => {},
    createFleetEvent: async () => ({}) as any,
    getFleetEvents: async () => [],
    getCircuitState: async () => null,
    upsertCircuitState: async () => {},
    createHealthTick: async () => ({}) as any,
    createTraceEntry: async () => ({}) as any,
    getTrace: async () => [],
    getProviderFleetConfig: async () => null,
    getHarnessCommand: async () => null,
    listHarnessCommands: async () => [],
    upsertHarnessCommand: async () => {},
  } as unknown as GovernorStore

  // Minimal governor double exposing only the orchestrator-relevant surface.
  const gov: any = {
    cdp: { send: transport.send.bind(transport) },
    capture: transport.capture.bind(transport),
    getPageState: transport.getPageState.bind(transport),
    captureScreenshot: transport.captureScreenshot.bind(transport),
    enableDomains: mock(() => Promise.resolve()),
    evaluate: mock((_s: string, _e: string) =>
      Promise.resolve({ x: 0, y: 0, width: 5, height: 5 }),
    ),
    ensureGenericBrowser: mock(() =>
      Promise.resolve({ slaveId: 'generic:default:abc', sessionId: 'sess1' }),
    ),
    runHarnessPlan: mock(() =>
      Promise.resolve({ success: true, stepsCompleted: 3, capturedBody: '<html/>' }),
    ),
  }
  return { gov, govStore, cdpCalls }
}

function makeHealStore(): SelectorHealStore {
  const makeRow = (
    targetKey: string,
    selectorFormat: string,
    mode: string,
  ): SelectorStrategyRow => ({
    id: `s_${targetKey}`,
    targetKey,
    selectorFormat,
    mode,
    semanticData: {},
    healCount: 0,
    lastUsed: Date.now(),
    createdAt: Date.now(),
  })
  return {
    getStrategy: async () => null,
    recordUse: async () => {},
    upsertStrategy: async (input) => makeRow(input.targetKey, input.selectorFormat, input.mode),
    bumpHealCount: async () => {},
  }
}

describe('browser-automation integration: orchestrator → governor (Governor Canon)', () => {
  test('orchestrator composes a recipe and drives the governor via runHarnessPlan', async () => {
    const { gov } = makeMockGovernor()
    const orch = new AutomationOrchestrator(gov)

    const recipe = getRecipe('auto:research:report')
    expect(recipe).toBeDefined()

    const result = await orch.run({
      role: 'researcher',
      recipeId: recipe.id,
      intent: 'auto',
      params: { queryUrl: 'https://example.com' },
      destructive: false,
    })

    expect(result.role).toBe('researcher')
    expect(result.steps).toBeGreaterThan(0)
    expect(gov.ensureGenericBrowser).toHaveBeenCalled()
    expect(gov.runHarnessPlan).toHaveBeenCalled()
  })

  test('all browser action flows through the governor (no direct CDP in orchestrator)', async () => {
    const { gov, cdpCalls } = makeMockGovernor()
    const orch = new AutomationOrchestrator(gov)
    await orch.run({
      role: 'researcher',
      recipeId: 'auto:research:report',
      intent: 'auto',
      params: { queryUrl: 'https://example.com' },
      destructive: false,
    })
    // The orchestrator must not call the transport directly; it delegates to gov.runHarnessPlan.
    expect(cdpCalls.length).toBe(0)
  })

  test('recipe compiles to a runnable DAG', () => {
    const recipe = getRecipe('auto:research:report')
    const dag = compileRecipe(recipe)
    expect(dag.nodes.length).toBeGreaterThan(0)
    expect(dag.nodes.some((n) => n.type === 'action' && n.action === 'loop_while')).toBe(true)
  })

  test('selector healer integrates with grounding + store end-to-end', async () => {
    const { gov } = makeMockGovernor()
    const store = makeHealStore()
    // Stub the grounding engine so the healer resolves deterministically without
    // a real browser (Governor Canon preserved: only governor.evaluate is used).
    const grounding = {
      resolveBySelector: mock((_slaveId: string, selector: string) =>
        Promise.resolve({ selector, mode: 'css' as const }),
      ),
      resolve: mock((_slaveId: string, _sel: unknown) =>
        Promise.resolve({ selector: '#fallback', mode: 'css' as const }),
      ),
    } as unknown as SemanticGroundingEngine
    const healer = new SelectorHealer(gov, grounding, store)
    const r = await healer.heal('generic:default:abc', { css: '#gone' }, 'go-btn')
    expect(r.healed).toBe(true)
  })
})
