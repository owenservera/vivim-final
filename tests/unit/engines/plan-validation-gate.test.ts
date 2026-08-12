// tests/unit/engines/plan-validation-gate.test.ts
// Phase 2 — PlanValidationGate unit tests.

import { describe, expect, it } from 'bun:test'
import type { ActionPlan } from '../../../src/engines/action-plan.js'
import { PlanValidationGate } from '../../../src/engines/plan-validation-gate.js'

function makePlan(overrides?: Partial<ActionPlan>): ActionPlan {
  return {
    id: 'plan-test-001',
    version: 1,
    goal: 'test goal',
    nodes: [
      {
        id: 'node-1',
        capability: 'cap:browser:open_url',
        input: { url: 'https://example.com' },
        dependsOn: [],
        risk: 'read',
        requiresConfirmation: false,
        verify: { type: 'none' },
      },
    ],
    groundedRefs: [],
    metadata: {},
    ...overrides,
  }
}

describe('PlanValidationGate', () => {
  const gate = new PlanValidationGate()

  it('should accept a valid plan', () => {
    const plan = makePlan()
    const result = gate.validate(plan)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject a plan with no nodes', () => {
    const plan = makePlan({ nodes: [] })
    const result = gate.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Plan must have at least one node')
  })

  it('should detect dependency cycles', () => {
    const plan = makePlan({
      nodes: [
        {
          id: 'a',
          capability: 'cap:browser:click',
          input: { selector: '#btn' },
          dependsOn: ['b'],
          risk: 'read',
          requiresConfirmation: false,
          verify: { type: 'none' },
        },
        {
          id: 'b',
          capability: 'cap:browser:click',
          input: { selector: '#btn2' },
          dependsOn: ['a'],
          risk: 'read',
          requiresConfirmation: false,
          verify: { type: 'none' },
        },
      ],
    })
    const result = gate.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Plan contains a dependency cycle')
  })

  it('should reject risk tier exceeding max', () => {
    const strictGate = new PlanValidationGate({ maxRiskTier: 'A' })
    const plan = makePlan({
      risk: { tier: 'C', reason: 'test', mitigation: 'none' },
    })
    const result = strictGate.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Risk tier'))).toBe(true)
  })

  it('should warn about destructive risk without confirmation', () => {
    const plan = makePlan({
      nodes: [
        {
          id: 'node-del',
          capability: 'cap:browser:delete_item',
          input: { target: '#item-1' },
          dependsOn: [],
          risk: 'destructive',
          requiresConfirmation: false,
          verify: { type: 'none' },
        },
      ],
    })
    const result = gate.validate(plan)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some((w) => w.toLowerCase().includes('confirmation'))).toBe(true)
  })

  it('should report unknown dependency refs', () => {
    const plan = makePlan({
      nodes: [
        {
          id: 'node-1',
          capability: 'cap:browser:click',
          input: { selector: '#btn' },
          dependsOn: ['nonexistent'],
          risk: 'read',
          requiresConfirmation: false,
          verify: { type: 'none' },
        },
      ],
    })
    const result = gate.validate(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('unknown node'))).toBe(true)
  })

  it('should validate via isSafe boolean', () => {
    expect(gate.isSafe(makePlan())).toBe(true)
    expect(gate.isSafe(makePlan({ nodes: [] }))).toBe(false)
  })

  it('should warn when confirmation required but no prompt', () => {
    const plan = makePlan({ requiresConfirmation: true })
    const result = gate.validate(plan)
    expect(result.warnings.some((w) => w.includes('confirmationPrompt'))).toBe(true)
  })
})
