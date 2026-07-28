import { describe, expect, it } from 'bun:test'
import { type AutonomousGoal, resolvePlanner } from '../../../src/engines/autonomous-execution.js'
import { ConsentViolationError } from '../../../src/errors.js'

const baseGoal: AutonomousGoal = {
  description: 'summarize my notes',
  maxSteps: 5,
  maxDurationMs: 60_000,
  requireApprovalAbove: 'destructive',
  allowBrowser: false,
  costBudgetCents: 100,
  tokenBudget: 1000,
  iterationBudget: 10,
}

describe('autonomous-offline (36.2)', () => {
  it('airgap on + no override uses the local planner', () => {
    const r = resolvePlanner(baseGoal, { airgap: true, consented: false })
    expect(r.local).toBe(true)
    expect(r.provider).toBe('local')
  })

  it('explicit cloud provider is honored when consented', () => {
    const goal = { ...baseGoal, llmProvider: 'gpt-4o' }
    const r = resolvePlanner(goal, { airgap: true, consented: true })
    expect(r.local).toBe(false)
    expect(r.provider).toBe('gpt-4o')
  })

  it('cloud provider without consent throws ConsentViolationError', () => {
    const goal = { ...baseGoal, llmProvider: 'gpt-4o' }
    expect(() => resolvePlanner(goal, { airgap: true, consented: false })).toThrow(
      ConsentViolationError,
    )
  })

  it('local override is always allowed (no consent needed)', () => {
    const goal = { ...baseGoal, llmProvider: 'local' }
    const r = resolvePlanner(goal, { airgap: true, consented: false })
    expect(r.local).toBe(true)
  })
})
