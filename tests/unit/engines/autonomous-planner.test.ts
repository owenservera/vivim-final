import { describe, expect, it } from 'bun:test'
import {
  type AutonomousGoal,
  type AutonomousStep,
  planStepsFromIntent,
} from '../../../src/engines/autonomous-execution.js'
import type { ParsedIntent } from '../../../src/engines/nlcl/types.js'

function makeGoal(overrides: Partial<AutonomousGoal> = {}): AutonomousGoal {
  return {
    description: 'open the dashboard and summarize',
    maxSteps: 10,
    maxDurationMs: 60_000,
    requireApprovalAbove: 'destructive',
    allowBrowser: true,
    costBudgetCents: 100,
    ...overrides,
  }
}

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    patternId: 'p1',
    intent: 'open dashboard',
    input: { url: 'https://x.test' },
    confidence: 0.9,
    rawInput: 'open the dashboard',
    matchedPattern: 'open',
    alternatives: [],
    resolvedAt: Date.now(),
    capabilityId: 'cap.open-dashboard',
    ...overrides,
  }
}

describe('planStepsFromIntent (Unit 34.1)', () => {
  it('maps a resolved CapabilityNode to a slug step with inputMapping + classification', () => {
    const goal = makeGoal()
    const intent = makeIntent({ classification: 'read' })
    const steps = planStepsFromIntent(goal, intent)

    expect(steps).toHaveLength(1)
    const step = steps[0] as AutonomousStep
    expect(step.action).toBe('cap.open-dashboard')
    expect(step.actionInput.inputMapping).toEqual({ url: 'https://x.test' })
    expect(step.classification).toBe('read')
  })

  it('returns 0 steps for an empty DAG (null intent)', () => {
    expect(planStepsFromIntent(makeGoal(), null)).toHaveLength(0)
  })

  it('returns 0 steps when the intent has no capabilityId', () => {
    const intent = makeIntent({ capabilityId: undefined })
    expect(planStepsFromIntent(makeGoal(), intent)).toHaveLength(0)
  })

  it('expands alternatives into additional slug steps', () => {
    const alt: ParsedIntent = makeIntent({
      capabilityId: 'cap.summarize',
      intent: 'summarize',
      classification: 'read',
    })
    const intent = makeIntent({ alternatives: [alt] })
    const steps = planStepsFromIntent(makeGoal(), intent)
    expect(steps).toHaveLength(2)
    expect(steps.map((s) => s.action)).toEqual(['cap.open-dashboard', 'cap.summarize'])
  })

  it('does not require approval for a low classification', () => {
    const intent = makeIntent({ classification: 'read' })
    const steps = planStepsFromIntent(makeGoal({ requireApprovalAbove: 'destructive' }), intent)
    expect(steps[0]?.requiresHumanApproval).toBe(false)
  })

  it('requires approval when classification meets the threshold', () => {
    const intent = makeIntent({ classification: 'destructive' })
    const steps = planStepsFromIntent(makeGoal({ requireApprovalAbove: 'destructive' }), intent)
    expect(steps[0]?.requiresHumanApproval).toBe(true)
  })

  it('respects the maxSteps cap', () => {
    const intents: ParsedIntent[] = Array.from({ length: 3 }, (_, i) =>
      makeIntent({ capabilityId: `cap.s${i}`, intent: `s${i}`, classification: 'read' }),
    )
    const root = makeIntent({ alternatives: intents.slice(1) })
    const steps = planStepsFromIntent(makeGoal({ maxSteps: 2 }), root)
    expect(steps).toHaveLength(2)
  })
})
