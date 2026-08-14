// tests/unit/engines/execution-kernel.test.ts
// ExecutionKernel — lifecycle, policy, confirmation, verification, journal tests.

import { describe, expect, test } from 'bun:test'
import type { ActionPlan } from '../../../src/engines/action-plan.js'
import { ExecutionKernel, MemoryJournal } from '../../../src/engines/execution-kernel.js'
import { P0PolicyEngine } from '../../../src/engines/policy-engine.js'

// ── Helpers ──────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  return {
    version: 1,
    goal: 'test-goal',
    nodes: [
      {
        id: 'n1',
        capability: 'cap:test:read',
        input: { x: 1 },
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

/** Helper: build a plan with a single node, merging node-level overrides. */
function makeNodePlan(
  nodeOverrides: Partial<ActionPlan['nodes'][number]> = {},
  planOverrides: Partial<ActionPlan> = {},
): ActionPlan {
  return makePlan({
    nodes: [
      {
        id: 'n1',
        capability: 'cap:test:read',
        input: { x: 1 },
        dependsOn: [],
        risk: 'read',
        requiresConfirmation: false,
        verify: { type: 'none' },
        ...nodeOverrides,
      },
    ],
    ...planOverrides,
  })
}

// ── ExecutionKernel tests ────────────────────────────────────────────────

describe('ExecutionKernel', () => {
  test('executes a safe read and journals full lifecycle', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: true,
        allowFinancial: true,
        allowCommunication: true,
      }),
      journal,
    })

    const result = await kernel.execute(makePlan(), async (_node, input) => ({ ok: true, input }))

    expect(result.ok).toBe(true)
    expect(result.output).toEqual({ ok: true, input: { x: 1 } })
    expect(journal.events.map((e) => e.phase)).toEqual([
      'planned',
      'policy',
      'started',
      'completed',
    ])
  })

  test('blocks destructive operation by default', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine(),
      journal,
    })

    const result = await kernel.execute(
      makeNodePlan({ risk: 'destructive', requiresConfirmation: true }),
      async () => 'must not run',
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Destructive')
    // Executor never ran
    expect(journal.events.map((e) => e.phase)).toEqual(['planned', 'policy'])
  })

  test('blocks security_sensitive operation by default', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine(),
      journal,
    })

    const result = await kernel.execute(
      makeNodePlan({ risk: 'security_sensitive', requiresConfirmation: true }),
      async () => 'must not run',
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain('exceeds')
    expect(journal.events.map((e) => e.phase)).toEqual(['planned', 'policy'])
  })

  test('blocks external_communication by default', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine(),
      journal,
    })

    const result = await kernel.execute(
      makeNodePlan({
        risk: 'external_communication',
        requiresConfirmation: true,
      }),
      async () => 'must not run',
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Communication')
  })

  test('requires confirmation before execution', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: true,
        allowFinancial: true,
        allowCommunication: true,
      }),
      journal,
    })

    const result = await kernel.execute(
      makeNodePlan({
        risk: 'external_communication',
        requiresConfirmation: true,
      }),
      async () => 'must not run',
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Confirmation required')
  })

  test('executes when confirmation token is present in metadata', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: true,
        allowFinancial: true,
        allowCommunication: true,
      }),
      journal,
    })

    const result = await kernel.execute(
      makeNodePlan(
        { risk: 'external_communication', requiresConfirmation: true },
        { metadata: { confirmationToken: 'valid-token-abc' } },
      ),
      async () => ({ sent: true }),
    )

    expect(result.ok).toBe(true)
    expect(result.output).toEqual({ sent: true })
  })

  test('catches executor errors and journals failure', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: true,
        allowFinancial: true,
        allowCommunication: true,
      }),
      journal,
    })

    const result = await kernel.execute(makePlan(), async () => {
      throw new Error('Boom!')
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Boom!')
    expect(journal.events.map((e) => e.phase)).toEqual(['planned', 'policy', 'started', 'failed'])
  })

  test('runs verification when node has non-none verify spec', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: true,
        allowFinancial: true,
        allowCommunication: true,
      }),
      journal,
      verify: {
        verify: async () => ({ ok: true }),
      },
    })

    const result = await kernel.execute(
      makeNodePlan({
        verify: { type: 'text_present', value: 'hello' },
      }),
      async () => 'hello world',
    )

    expect(result.ok).toBe(true)
    expect(journal.events.map((e) => e.phase)).toEqual([
      'planned',
      'policy',
      'started',
      'verified',
      'completed',
    ])
  })

  test('verification failure blocks completion', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: true,
        allowFinancial: true,
        allowCommunication: true,
      }),
      journal,
      verify: {
        verify: async () => ({ ok: false, reason: 'File hash mismatch' }),
      },
    })

    const result = await kernel.execute(
      makeNodePlan({
        verify: { type: 'text_present', value: 'hello' },
      }),
      async () => 'wrong output',
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe('File hash mismatch')
    expect(journal.events.map((e) => e.phase)).toEqual(['planned', 'policy', 'started', 'failed'])
  })

  test('does not run verification when verify dep is absent', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: true,
        allowFinancial: true,
        allowCommunication: true,
      }),
      journal,
      // No verify dep
    })

    const result = await kernel.execute(
      makeNodePlan({
        verify: { type: 'text_present', value: 'hello' },
      }),
      async () => 'hello world',
    )

    // Should succeed — no verify dep means skip verification
    expect(result.ok).toBe(true)
    expect(journal.events.map((e) => e.phase)).not.toContain('verified')
  })

  test('executes multi-node plan in dependency order', async () => {
    const journal = new MemoryJournal()
    const kernel = new ExecutionKernel({
      policy: new P0PolicyEngine({
        allowDestructive: true,
        allowFinancial: true,
        allowCommunication: true,
      }),
      journal,
    })

    const executionOrder: string[] = []

    const plan: ActionPlan = {
      version: 1,
      goal: 'multi-step',
      nodes: [
        {
          id: 'step-a',
          capability: 'cap:test:read',
          input: {},
          dependsOn: [],
          risk: 'read',
          requiresConfirmation: false,
          verify: { type: 'none' },
        },
        {
          id: 'step-b',
          capability: 'cap:test:read',
          input: {},
          dependsOn: ['step-a'],
          risk: 'read',
          requiresConfirmation: false,
          verify: { type: 'none' },
        },
      ],
      groundedRefs: [],
      metadata: {},
    }

    const result = await kernel.execute(plan, async (node, _input) => {
      executionOrder.push(node.id)
      return { step: node.id }
    })

    expect(result.ok).toBe(true)
    expect(executionOrder).toEqual(['step-a', 'step-b'])
  })
})

// ── P0PolicyEngine tests ────────────────────────────────────────────────

describe('P0PolicyEngine', () => {
  test('allows read operations by default', () => {
    const engine = new P0PolicyEngine()
    const decision = engine.evaluate(makeNodePlan({ risk: 'read' }))
    expect(decision.allowed).toBe(true)
  })

  test('blocks destructive by default', () => {
    const engine = new P0PolicyEngine()
    const decision = engine.evaluate(makeNodePlan({ risk: 'destructive' }))
    expect(decision.allowed).toBe(false)
  })

  test('allows destructive when opted in', () => {
    const engine = new P0PolicyEngine({ allowDestructive: true })
    const decision = engine.evaluate(makeNodePlan({ risk: 'destructive' }))
    expect(decision.allowed).toBe(true)
  })

  test('blocks security_sensitive by default', () => {
    const engine = new P0PolicyEngine()
    const decision = engine.evaluate(makeNodePlan({ risk: 'security_sensitive' }))
    expect(decision.allowed).toBe(false)
  })

  test('requires confirmation for external_communication', () => {
    const engine = new P0PolicyEngine({ allowCommunication: true })
    const decision = engine.evaluate(makeNodePlan({ risk: 'external_communication' }))
    expect(decision.allowed).toBe(true)
    expect(decision.requiresConfirmation).toBe(true)
  })

  test('does not require confirmation for read', () => {
    const engine = new P0PolicyEngine()
    const decision = engine.evaluate(makeNodePlan({ risk: 'read' }))
    expect(decision.allowed).toBe(true)
    expect(decision.requiresConfirmation).toBe(false)
  })

  test('maxRiskTier blocks above threshold', () => {
    const engine = new P0PolicyEngine({ maxRiskTier: 1 })
    const decision = engine.evaluate(makeNodePlan({ risk: 'external_communication' }))
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.reason).toContain('exceeds')
    }
  })
})

// ── MemoryJournal tests ──────────────────────────────────────────────────

describe('MemoryJournal', () => {
  test('appends and freezes events', () => {
    const journal = new MemoryJournal()
    journal.append({
      executionId: 'e1',
      actionId: 'a1',
      phase: 'planned',
      timestamp: 1000,
    })

    expect(journal.events).toHaveLength(1)
    expect(journal.events[0]?.executionId).toBe('e1')

    // Events should be frozen
    expect(journal.events[0] && Object.isFrozen(journal.events[0])).toBe(true)
  })
})
