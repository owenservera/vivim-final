import { describe, expect, it } from 'bun:test'
import { planStepsFromIntent, planStepsLocally } from '../../../src/engines/autonomous-planner.js'
// resolvePlanner is imported through the engine module to prove the
// backward-compat re-export still resolves (Phase 1.3 extraction).
import { resolvePlanner } from '../../../src/engines/autonomous-execution.js'
import { ConsentViolationError } from '../../../src/errors.js'
import type { AutonomousGoal, ParsedIntent } from '../../../src/engines/autonomous-types.js'

const baseGoal = (overrides?: Partial<AutonomousGoal>): AutonomousGoal => ({
  description: 'a test goal',
  maxSteps: 10,
  maxDurationMs: 60_000,
  requireApprovalAbove: 'financial',
  allowBrowser: false,
  costBudgetCents: 100,
  tokenBudget: 1000,
  iterationBudget: 10,
  ...overrides,
})

const intent = (overrides?: Partial<ParsedIntent>): ParsedIntent => ({
  capabilityId: 'cap:test:action',
  classification: 'read',
  input: { query: 'test' },
  confidence: 0.9,
  intent: 'Test action',
  patternId: 'test',
  rawInput: 'test',
  matchedPattern: 'test',
  alternatives: [],
  resolvedAt: Date.now(),
  ...overrides,
})

describe('planStepsLocally (Unit 8.9 keyword matrix)', () => {
  it('composite: prefix emits a single composite step', () => {
    const steps = planStepsLocally(baseGoal({ description: 'composite:cap:test:run' }))
    expect(steps).toHaveLength(1)
    expect(steps[0]?.action).toBe('composite:cap:test:run')
    expect(steps[0]?.classification).toBe('read')
  })

  it('URL in description emits a navigate step with the url', () => {
    const steps = planStepsLocally(baseGoal({ description: 'go to https://example.com/page' }))
    expect(steps[0]?.action).toBe('navigate')
    expect((steps[0]?.actionInput as Record<string, unknown>).url).toBe(
      'https://example.com/page',
    )
  })

  it('screenshot keyword emits a screenshot step', () => {
    const steps = planStepsLocally(baseGoal({ description: 'take a screenshot' }))
    expect(steps.some((s) => s.action === 'screenshot')).toBe(true)
    expect(steps.some((s) => s.classification === 'read')).toBe(true)
  })

  it('destructive keywords classify the step as destructive', () => {
    const steps = planStepsLocally(baseGoal({ description: 'delete the temp folder permanently' }))
    expect(steps.some((s) => s.classification === 'destructive')).toBe(true)
  })

  it('search without a URL emits a search step carrying the description', () => {
    const steps = planStepsLocally(baseGoal({ description: 'find the release notes' }))
    expect(steps[0]?.action).toBe('search')
    expect((steps[0]?.actionInput as Record<string, unknown>).query).toBe(
      'find the release notes',
    )
  })

  it('no matching keywords falls back to a read task step', () => {
    const steps = planStepsLocally(baseGoal({ description: 'zzz something unusual' }))
    expect(steps).toHaveLength(1)
    expect(steps[0]?.action).toBe('task')
    expect(steps[0]?.classification).toBe('read')
  })

  it('respects maxSteps by stopping emission', () => {
    const steps = planStepsLocally(
      baseGoal({
        description: 'go to https://a.com then screenshot then find things and summarize it',
        maxSteps: 2,
      }),
    )
    expect(steps.length).toBeLessThanOrEqual(2)
  })
})

describe('planStepsFromIntent', () => {
  it('null intent produces zero steps', () => {
    expect(planStepsFromIntent(baseGoal(), null)).toHaveLength(0)
  })

  it('expands alternatives into ordered steps with inputMapping', () => {
    const goal = baseGoal({ description: 'primary task' })
    const steps = planStepsFromIntent(goal, intent({ alternatives: [intent({})] }))
    expect(steps).toHaveLength(2)
    expect(steps[0]?.action).toBe('cap:test:action')
    expect((steps[0]?.actionInput as Record<string, unknown>).inputMapping).toBeDefined()
    expect(steps[0]?.stepIndex).toBe(0)
    expect(steps[1]?.stepIndex).toBe(1)
  })

  it('slices steps down to maxSteps', () => {
    const goal = baseGoal({ maxSteps: 1 })
    const many = Array.from({ length: 5 }, () => intent({}))
    const steps = planStepsFromIntent(
      goal,
      intent({ alternatives: many }),
    )
    expect(steps).toHaveLength(1)
  })
})

describe('resolvePlanner re-exported via engine module (36.2)', () => {
  it('airgap off + no override still uses the local planner', () => {
    const r = resolvePlanner(baseGoal(), { airgap: false, consented: false })
    expect(r).toEqual({ provider: 'local', local: true })
  })

  it('cloud override honored when consented, rejected without', () => {
    const goal = baseGoal({ llmProvider: 'claude' })
    expect(resolvePlanner(goal, { airgap: false, consented: true })).toEqual({
      provider: 'claude',
      local: false,
    })
    expect(() => resolvePlanner(goal, { airgap: false, consented: false })).toThrow(
      ConsentViolationError,
    )
  })
})
