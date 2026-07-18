// tests/unit/devops/onboard-controller.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { automationLog } from '../../../devops/automation-activity-log.js'
import { decomposeGoal, dispatchMode, runOnboard } from '../../../devops/onboard-controller.js'

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
