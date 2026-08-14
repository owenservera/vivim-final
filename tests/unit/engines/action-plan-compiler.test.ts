// tests/unit/engines/action-plan-compiler.test.ts
// ActionPlanCompiler — candidate → validated ActionPlan compilation tests

import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { ActionPlanCompiler, type PlanCompilerInput } from '../../../src/engines/action-plan-compiler.js'
import type { CapabilityDefinition } from '../../../src/engines/action-plan.js'

function cap(slug: string, risk: 'read' | 'reversible_write' | 'external_communication' | 'destructive' | 'security_sensitive', requiresConfirmation = false): CapabilityDefinition {
  return { slug, description: slug, risk, inputSchema: z.object({}), requiresConfirmation }
}

describe('ActionPlanCompiler.compile', () => {
  test('compiles known capabilities into a valid ActionPlan', () => {
    const compiler = new ActionPlanCompiler(new Map([['cap:send', cap('cap:send', 'read')]]))
    const input: PlanCompilerInput = {
      goal: 'send a message',
      candidates: [{ capability: 'cap:send', input: { to: 'x' } }],
    }
    const plan = compiler.compile(input)
    expect(plan.version).toBe(1)
    expect(plan.goal).toBe('send a message')
    expect(plan.nodes).toHaveLength(1)
    expect(plan.nodes[0]!.capability).toBe('cap:send')
  })

  test('throws ActionPlanValidationError on unknown capability', () => {
    const compiler = new ActionPlanCompiler(new Map())
    expect(() => compiler.compile({ goal: 'g', candidates: [{ capability: 'cap:ghost', input: {} }] })).toThrow(/Unknown capability/)
  })

  test('falls back to capability risk when candidate omits risk', () => {
    const compiler = new ActionPlanCompiler(new Map([['cap:send', cap('cap:send', 'destructive')]]))
    const plan = compiler.compile({ goal: 'g', candidates: [{ capability: 'cap:send', input: {} }] })
    expect(plan.nodes[0]!.risk).toBe('destructive')
  })

  test('candidate risk overrides capability risk', () => {
    const compiler = new ActionPlanCompiler(new Map([['cap:send', cap('cap:send', 'read')]]))
    const plan = compiler.compile({ goal: 'g', candidates: [{ capability: 'cap:send', input: {}, risk: 'destructive' }] })
    expect(plan.nodes[0]!.risk).toBe('destructive')
  })

  test('requiresConfirmation propagated from capability when candidate omits it', () => {
    const compiler = new ActionPlanCompiler(new Map([['cap:send', cap('cap:send', 'read', true)]]))
    const plan = compiler.compile({ goal: 'g', candidates: [{ capability: 'cap:send', input: {} }] })
    expect(plan.nodes[0]!.requiresConfirmation).toBe(true)
  })

  test('candidate requiresConfirmation:false overrides a capability default of true', () => {
    const compiler = new ActionPlanCompiler(new Map([['cap:send', cap('cap:send', 'destructive', true)]]))
    const plan = compiler.compile({ goal: 'g', candidates: [{ capability: 'cap:send', input: {}, requiresConfirmation: false }] })
    expect(plan.nodes[0]!.requiresConfirmation).toBe(false)
  })

  test('assigns sequential node ids n1, n2, ...', () => {
    const compiler = new ActionPlanCompiler(
      new Map([
        ['a', cap('a', 'read')],
        ['b', cap('b', 'read')],
      ]),
    )
    const plan = compiler.compile({ goal: 'g', candidates: [{ capability: 'a', input: {} }, { capability: 'b', input: {} }] })
    expect(plan.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
  })
})

describe('ActionPlanCompiler adapters', () => {
  test('intentToCandidates maps ParsedIntent', () => {
    const compiler = new ActionPlanCompiler(new Map())
    const cands = compiler.intentToCandidates({ capabilityId: 'cap:x', input: { q: 1 }, classification: 'write' } as never)
    expect(cands[0]!.capability).toBe('cap:x')
    expect(cands[0]!.risk).toBe('reversible_write')
  })

  test('intentsToCandidates builds dependency edges', () => {
    const compiler = new ActionPlanCompiler(new Map())
    const cands = compiler.intentsToCandidates([
      { capabilityId: 'a', input: {}, classification: 'read' } as never,
      { capabilityId: 'b', input: {}, classification: 'read' } as never,
    ])
    expect(cands[1]!.dependsOn).toEqual(['n1'])
  })

  test('llmToCandidates rejects plans exceeding maxNodes', () => {
    const compiler = new ActionPlanCompiler(new Map())
    const big = { goal: 'g', nodes: Array.from({ length: 20 }, (_, i) => ({ capability: `c${i}`, input: {} })) }
    expect(() => compiler.llmToCandidates(big, 16)).toThrow(/exceeds max nodes/)
  })

  test('llmToCandidates converts within node limit', () => {
    const compiler = new ActionPlanCompiler(new Map())
    const input = compiler.llmToCandidates({ goal: 'g', nodes: [{ capability: 'c1', input: { x: 1 } }] })
    expect(input.candidates).toHaveLength(1)
    expect(input.candidates[0]!.capability).toBe('c1')
  })
})
