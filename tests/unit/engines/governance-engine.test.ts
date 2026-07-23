// tests/unit/engines/governance-engine.test.ts
// GovernanceEngine — allocation, end-strategy, budget assertions.
import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { GovernanceEngine } from '../../../src/engines/governance-engine.js'
import { BudgetExceededError } from '../../../src/errors.js'

function makeStore() {
  return {
    evaluateAllocation: mock(() => Promise.resolve([
      { roleId: 'analyst', agentId: 'a1', model: 'gpt-4', weight: 1 },
      { roleId: 'analyst', agentId: 'a2', model: 'claude', weight: 0.5 },
    ])),
  }
}

describe('GovernanceEngine', () => {
  let store: ReturnType<typeof makeStore>
  let engine: GovernanceEngine

  beforeEach(() => {
    store = makeStore()
    engine = new GovernanceEngine(store as never)
  })

  it('evaluateAllocation returns all bindings', async () => {
    const result = await engine.evaluateAllocation('policy-1')
    expect(result).toHaveLength(2)
    expect(result[0]!.agentId).toBe('a1')
  })

  it('evaluateAllocation filters by reputationFloor', async () => {
    const result = await engine.evaluateAllocation('policy-1', {
      reputationFloor: 0.7,
      agentReputation: { a1: { score: 0.9, avgCostCents: 1 }, a2: { score: 0.5, avgCostCents: 1 } },
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.agentId).toBe('a1')
  })

  it('evaluateAllocation filters by costBudgetCents', async () => {
    const result = await engine.evaluateAllocation('policy-1', {
      costBudgetCents: 2,
      agentReputation: { a1: { score: 1, avgCostCents: 1 }, a2: { score: 1, avgCostCents: 5 } },
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.agentId).toBe('a1')
  })

  it('applyEndStrategy early stops at first success', () => {
    const results = [
      { ok: false, value: 'x' },
      { ok: true, value: 'y' },
      { ok: true, value: 'z' },
    ]
    const r = engine.applyEndStrategy('early', results)
    expect(r.ok).toBe(true)
    expect(r.first).toBe('y')
    expect(r.values).toEqual(['y'])
  })

  it('applyEndStrategy graceful keeps all successes', () => {
    const results = [
      { ok: false, value: 'x' },
      { ok: true, value: 'y' },
      { ok: true, value: 'z' },
    ]
    const r = engine.applyEndStrategy('graceful', results)
    expect(r.ok).toBe(true)
    expect(r.values).toEqual(['y', 'z'])
  })

  it('applyEndStrategy exhaustive fails if any fails', () => {
    const results = [
      { ok: true, value: 'y' },
      { ok: false, value: 'x' },
    ]
    const r = engine.applyEndStrategy('exhaustive', results)
    expect(r.ok).toBe(false)
    expect(r.values).toEqual(['y', 'x'])
  })

  it('applyEndStrategy exhaustive succeeds if all ok', () => {
    const results = [
      { ok: true, value: 'a' },
      { ok: true, value: 'b' },
    ]
    const r = engine.applyEndStrategy('exhaustive', results)
    expect(r.ok).toBe(true)
  })

  it('assertBudget throws BudgetExceededError when exceeded', () => {
    expect(() => engine.assertBudget('cost', 100, 50)).toThrow(BudgetExceededError)
  })

  it('assertBudget passes when within budget', () => {
    expect(() => engine.assertBudget('tokens', 50, 100)).not.toThrow()
  })
})
