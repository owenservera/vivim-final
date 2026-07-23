// tests/unit/devops/onboard-controller.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { automationLog } from '../../../devops/automation-activity-log.js'
import { decomposeGoal, dispatchMode, modeTestSelectors, runOnboard, modeDiscover } from '../../../devops/onboard-controller.js'
import type { SelectorConfidenceMap } from '../../../devops/selector-tester.js'

beforeEach(() => {
  ;(automationLog as any).sinks.length = 0
})

describe('decomposeGoal', () => {
  it('extracts provider + url from a domain goal', () => {
    const { provider, url } = decomposeGoal('onboard chatgpt.com with full frontend capability')
    expect(provider).toBe('chatgpt')
    expect(url).toBe('https://chatgpt.com')
  })

  it('produces the fixed static phase list', () => {
    const { phases } = decomposeGoal('onboard x.com')
    expect(phases).toEqual([
      'discover',
      'infer',
      'test-selectors',
      'test-parse',
      'test-cap',
      'test-frontend',
      'verify',
      'converge',
    ])
  })
})

describe('dispatchMode graceful degradation', () => {
  it('discover fails without cdp/url (no crash)', async () => {
    const r = await dispatchMode('discover', { goal: 'onboard x.com' })
    expect(r.ok).toBe(false)
    expect(r.detail).toContain('live Chrome')
  })

  it('test-selectors fails without cdp', async () => {
    const r = await dispatchMode('test-selectors', { provider: 'x' })
    expect(r.ok).toBe(false)
  })

  it('infer runs offline and returns a skeleton', async () => {
    const r = await dispatchMode('infer', { provider: 'x' })
    expect(r.ok).toBe(true)
    const data = r.data as { _inferred?: { transport: string } }
    expect(data._inferred?.transport).toBeDefined()
  })
})

describe('runOnboard ledger + gate-halt', () => {
  it('halts at discover without cdp and appends a convergence task', async () => {
    const report = await runOnboard({ goal: 'onboard chatgpt.com' })
    expect(report.ok).toBe(false)
    expect(report.failedAt).toBe('discover')
    expect(report.convergenceTasks.length).toBeGreaterThan(0)
  })
})

describe('modeTestSelectors selector repair (Phase 3.1)', () => {
  it('accepts a healed css selector from SelectorHealer', async () => {
    const healedSelector = 'button[aria-label="Send"]'

    const { SelectorHealer } = await import('../../../src/engines/selector-healer.js')
    const originalHeal = SelectorHealer.prototype.heal
    ;(SelectorHealer.prototype as any).heal = async function () {
      return {
        healed: { type: 'css', selector: healedSelector },
        strategy: 'text_match',
        confidence: 0.8,
        originalSelector: { type: 'css', selector: 'div#composer' } as any,
      }
    }

    const mockClient = {
      connected: true,
      send: async (_method: string, params?: any, _opts?: any) => {
        const expr = params?.expression ?? ''
        if (expr.includes('div#composer')) {
          return { result: { value: { found: false, visible: false } } }
        }
        if (expr.includes('aria-label') && expr.includes('Send')) {
          return { result: { value: { found: true, visible: true } } }
        }
        return {}
      },
    }

    const result = await modeTestSelectors(
      {
        provider: 'x',
        cdp: { client: mockClient as any, sessionId: 'test-session' },
        minConfidence: 0.8,
      },
      { composer: 'div#composer' },
    )

    ;(SelectorHealer.prototype as any).heal = originalHeal
    expect(result.ok).toBe(true)
    const data = result.data as SelectorConfidenceMap
    expect(data.composer?.selector).toBe(healedSelector)
    expect(data.composer?.confidence).toBeGreaterThanOrEqual(0.8)
  })
})

describe('modeDiscover auth state check (Phase 3.2)', () => {
  it('fails discover when Chrome profile is not authenticated', async () => {
    const mockClient = {
      connected: true,
      send: async () => ({}),
    }

    const result = await modeDiscover({
      provider: 'nonexistent-provider',
      url: 'https://example.com',
      cdp: { client: mockClient as any, sessionId: 'test-session' },
    })

    expect(result.ok).toBe(false)
    expect(result.detail).toContain('not authenticated')
    expect(result.detail).toContain('setup')
  })
})
