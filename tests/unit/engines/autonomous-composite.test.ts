import { beforeEach, describe, expect, it } from 'bun:test'
import { AutonomousExecutionEngine } from '../../../src/engines/autonomous-execution.js'
import type {
  AutonomousGoal,
  AutonomousStep,
  AutonomousTask,
} from '../../../src/engines/autonomous-execution.js'
import type {
  CapabilityComposer,
  CompositeCapability,
  CompositeNode,
} from '../../../src/engines/capability-composer.js'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type { ExecutionPolicyEngine } from '../../../src/engines/execution-policy.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import { newId } from '../../../src/ids.js'
import type { AutonomousExecutionStore } from '../../../src/storage/contracts/autonomous-store.js'

// ── Mocks ────────────────────────────────────────────────────────────────

function mockStore(): AutonomousExecutionStore {
  const tasks = new Map<string, AutonomousTask>()
  const steps = new Map<string, AutonomousStep>()
  return {
    createTask: async (t: Record<string, unknown>) => {
      tasks.set(t.id as string, t as unknown as AutonomousTask)
    },
    updateTask: async (id: string, patch: Record<string, unknown>) => {
      const t = tasks.get(id)
      if (t) Object.assign(t, patch)
    },
    getTask: async (id: string) => (tasks.get(id) ?? null) as unknown as Record<string, unknown>,
    createStep: async (s: Record<string, unknown>) => {
      steps.set(s.id as string, s as unknown as AutonomousStep)
    },
    updateStep: async (id: string, patch: Record<string, unknown>) => {
      const s = steps.get(id)
      if (s) Object.assign(s, patch)
    },
    listTasks: async () => [...tasks.values()] as unknown as Array<Record<string, unknown>>,
    _tasks: tasks,
    _steps: steps,
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

function mockComposer(composites: CompositeCapability[]): CapabilityComposer {
  return {
    get: async (id: string) => composites.find((c) => c.id === id) ?? null,
    execute: async () => ({ ok: true }),
  } as unknown as CapabilityComposer
}

function makeNode(slug: string, inputMapping: Record<string, string> = {}): CompositeNode {
  return {
    id: newId(),
    capabilitySlug: slug,
    inputMapping,
    dependsOn: [],
  }
}

function makeGoal(overrides?: Partial<AutonomousGoal>): AutonomousGoal {
  return {
    description: 'Test composite task',
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

describe('AutonomousExecutionEngine — Unit 8.9: Composite step execution', () => {
  let store: ReturnType<typeof mockStore>
  let engine: AutonomousExecutionEngine

  beforeEach(() => {
    store = mockStore()
    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      undefined,
      undefined,
      true,
      () => false,
      mockComposer([]),
    )
  })

  it('composite:extract_and_summarize produces sub-steps with parentStepId', async () => {
    const composite: CompositeCapability = {
      id: 'extract_and_summarize',
      slug: 'extract_and_summarize',
      name: 'Extract and Summarize',
      description: 'Extract content then summarize',
      version: 1,
      nodes: [makeNode('extract_content'), makeNode('summarize_text')],
      edges: [{ from: 'extract_content', to: 'summarize_text' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      undefined,
      undefined,
      true,
      () => false,
      mockComposer([composite]),
    )

    const goal = makeGoal({ description: 'composite:extract_and_summarize' })

    // Inject a composite step directly into the planner output
    // by overriding the local planner to return a composite step
    const task = await engine.execute(goal)

    // The task should have sub-steps from the composite
    const compositeSteps = task.steps.filter((s) => s.parentStepId !== null)
    expect(compositeSteps.length).toBe(2)
    expect(compositeSteps[0]!.description).toContain('extract_content')
    expect(compositeSteps[1]!.description).toContain('summarize_text')

    // Sub-steps should have parentStepId set
    for (const s of compositeSteps) {
      expect(s.parentStepId).toBeDefined()
    }
  })

  it('sub-step failure causes composite root to fail', async () => {
    const failingRegistry = {
      execute: async () => {
        throw new Error('extract_content failed')
      },
      getBySlug: () => null,
      list: async () => [],
    } as unknown as UnifiedCapabilityRegistry

    const composite: CompositeCapability = {
      id: 'failing_composite',
      slug: 'failing_composite',
      name: 'Failing Composite',
      description: 'A composite that fails',
      version: 1,
      nodes: [makeNode('failing_step'), makeNode('never_reached')],
      edges: [{ from: 'failing_step', to: 'never_reached' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      failingRegistry,
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      undefined,
      undefined,
      true,
      () => false,
      mockComposer([composite]),
    )

    const goal = makeGoal({ description: 'composite:failing_composite' })
    const task = await engine.execute(goal)

    // Task should have failed
    expect(task.status).toBe('failed')
    expect(task.error).toContain('extract_content failed')

    // Only the first sub-step should have been created (second never reached)
    const subSteps = task.steps.filter((s) => s.parentStepId !== null)
    expect(subSteps.length).toBe(1)
    expect(subSteps[0]!.status).toBe('failed')
  })

  it('non-composite steps pass through to regular execution', async () => {
    const goal = makeGoal({ description: 'Navigate to example.com' })
    const task = await engine.execute(goal)

    // Regular steps should not have parentStepId set
    for (const s of task.steps) {
      expect(s.parentStepId).toBeNull()
      expect(s.isCompositeRoot).toBe(false)
    }
  })

  it('composite root is marked isCompositeRoot after execution', async () => {
    const composite: CompositeCapability = {
      id: 'simple_composite',
      slug: 'simple_composite',
      name: 'Simple Composite',
      description: 'A simple composite',
      version: 1,
      nodes: [makeNode('single_step')],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      undefined,
      undefined,
      true,
      () => false,
      mockComposer([composite]),
    )

    const goal = makeGoal({ description: 'composite:simple_composite' })
    const task = await engine.execute(goal)

    // Find the composite root step (the one with isCompositeRoot=true)
    const roots = task.steps.filter((s) => s.isCompositeRoot)
    expect(roots.length).toBe(1)
    expect(roots[0]!.action).toBe('composite:simple_composite')
  })

  it('missing composite throws EngineError', async () => {
    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
      undefined,
      undefined,
      true,
      () => false,
      mockComposer([]), // no composites registered
    )

    const goal = makeGoal({ description: 'composite:nonexistent' })
    const task = await engine.execute(goal)

    expect(task.status).toBe('failed')
    expect(task.error).toContain('Composite not found')
  })
})
