import { beforeEach, describe, expect, it } from 'bun:test'
import type { AutonomousGoal, AutonomousTask } from '../../../src/engines/autonomous-execution.js'
import { AutonomousExecutionEngine } from '../../../src/engines/autonomous-execution.js'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type { ExecutionPolicyEngine } from '../../../src/engines/execution-policy.js'
import type { IntentResolver, ParsedIntent } from '../../../src/engines/nlcl/types.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { AutonomousExecutionStore } from '../../../src/storage/contracts/autonomous-store.js'

// ── Mocks ────────────────────────────────────────────────────────────────

function mockStore(): AutonomousExecutionStore {
  const tasks = new Map<string, AutonomousTask>()
  return {
    createTask: async (t: Record<string, unknown>) => {
      tasks.set(t.id as string, t as unknown as AutonomousTask)
    },
    updateTask: async (id: string, patch: Record<string, unknown>) => {
      const t = tasks.get(id)
      if (t) Object.assign(t, patch)
    },
    getTask: async (id: string) => (tasks.get(id) ?? null) as unknown as Record<string, unknown>,
    createStep: async () => {},
    updateStep: async () => {},
    getSteps: async () => [],
    getStep: async () => null,
    createHitlGate: async () => {},
    updateHitlGate: async () => {},
    getPendingGates: async () => [],
    getGate: async () => null,
    listTasks: async () => [...tasks.values()] as unknown as Array<Record<string, unknown>>,
    getTaskTemplate: async () => null,
    insertTaskTemplate: async () => 'tpl-id',
    updateTaskTemplate: async () => {},
    listTaskTemplates: async () => [],
    _tasks: tasks,
  } as any
}

function mockRegistry(): UnifiedCapabilityRegistry {
  return {
    execute: async () => ({ ok: true }),
    getBySlug: () => null,
    list: async () => [],
  } as unknown as UnifiedCapabilityRegistry
}

function mockPolicy(): ExecutionPolicyEngine {
  return {
    evaluate: async () => ({ allowed: true, reason: 'test' }),
  } as unknown as ExecutionPolicyEngine
}

function mockGovernor(): ChromeGovernor {
  return {
    ensureRunning: async () => ({ slaveId: 'test-slave' }),
    cdp: {
      send: async () => ({}),
      captureScreenshot: async () => 'base64-screenshot',
      getPageState: async () => ({ readyState: 'complete' }),
    },
    getTransport: () => null,
  } as unknown as ChromeGovernor
}

function mockEventBus(): CapabilityEventBus {
  return { emit: () => {} } as unknown as CapabilityEventBus
}

function mockResolver(intent?: ParsedIntent): IntentResolver {
  return {
    resolve: async () => intent ?? null,
  } as unknown as IntentResolver
}

function makeGoal(overrides?: Partial<AutonomousGoal>): AutonomousGoal {
  return {
    description: 'Test planner task',
    maxSteps: 10,
    maxDurationMs: 60_000,
    requireApprovalAbove: 'financial',
    allowBrowser: false,
    costBudgetCents: 100,
    tokenBudget: 1000,
    iterationBudget: 10,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('AutonomousExecutionEngine — Unit 8.1: LLM-backed planner', () => {
  let store: ReturnType<typeof mockStore>
  let engine: AutonomousExecutionEngine

  beforeEach(() => {
    store = mockStore()
  })

  it('planGoal uses resolver when available', async () => {
    const intent: ParsedIntent = {
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
    }
    const resolver = mockResolver(intent)

    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      resolver,
    )

    const goal = makeGoal({ description: 'Do something' })
    const task = await engine.execute(goal)

    // Task should have steps from the resolver
    expect(task.steps.length).toBeGreaterThan(0)
    // Step action should be the capabilityId
    expect(task.steps[0]?.action).toBe('cap:test:action')
  })

  it('planGoal falls back to local planner when no resolver', async () => {
    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      // No resolver
    )

    const goal = makeGoal({ description: 'Navigate to example.com' })
    const task = await engine.execute(goal)

    // Should use local planner and create a navigate step
    expect(task.steps.length).toBeGreaterThan(0)
    expect(task.steps[0]?.action).toBe('navigate')
  })

  it('planGoal with empty intent returns empty steps', async () => {
    const resolver = mockResolver(undefined as any)

    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      resolver,
    )

    const goal = makeGoal({ description: 'Do something' })
    const task = await engine.execute(goal)

    // Empty intent should result in no steps
    expect(task.steps.length).toBe(0)
    expect(task.status).toBe('complete')
  })

  it('planGoal derives requiresHumanApproval from classification', async () => {
    const intent: ParsedIntent = {
      capabilityId: 'cap:test:destructive',
      classification: 'destructive',
      input: {},
      patternId: 'test',
      rawInput: 'test',
      matchedPattern: 'test',
      alternatives: [],
      resolvedAt: Date.now(),
      confidence: 0.9,
      intent: 'Destructive action',
    }
    const resolver = mockResolver(intent)

    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      resolver,
    )

    const goal = makeGoal({
      description: 'Delete something',
      requireApprovalAbove: 'read', // destructive > read, so requires approval
    })

    // Test planStepsFromIntent directly to avoid HITL timeout
    const { planStepsFromIntent } = await import('../../../src/engines/autonomous-execution.js')
    const steps = planStepsFromIntent(goal, intent)

    // Destructive step should require approval when threshold is 'read'
    expect(steps.length).toBe(1)
    expect(steps[0]?.requiresHumanApproval).toBe(true)
    expect(steps[0]?.classification).toBe('destructive')
  })
})
