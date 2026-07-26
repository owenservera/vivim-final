// tests/unit/engines/autonomous-pause.test.ts
// HITL v2 pause/resume with snapshot validation.
import { describe, expect, it } from 'bun:test'
import { AutonomousExecutionEngine } from '../../../src/engines/autonomous-execution.js'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type { ExecutionPolicyEngine } from '../../../src/engines/execution-policy.js'
import type { IntentResolver, ParsedIntent } from '../../../src/engines/nlcl/types.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { AutonomousExecutionStore } from '../../../src/storage/contracts/autonomous-store.js'

function makeStore(): AutonomousExecutionStore & { getPausedState(id: string): string | null } {
  const tasks = new Map<string, Record<string, unknown>>()
  const steps = new Map<string, Record<string, unknown>>()
  const stepsByTask = new Map<string, string[]>()

  const store = {
    async createTask(t: Record<string, unknown>) {
      tasks.set(t.id as string, { ...t })
    },
    async updateTask(id: string, patch: Record<string, unknown>) {
      tasks.set(id, { ...(tasks.get(id) ?? {}), ...patch })
    },
    async getTask(id: string) {
      return tasks.get(id) ?? null
    },
    async listTasks() {
      return [...tasks.values()]
    },
    async createStep(s: Record<string, unknown>) {
      steps.set(s.id as string, { ...s })
      const list = stepsByTask.get(s.taskId as string) ?? []
      list.push(s.id as string)
      stepsByTask.set(s.taskId as string, list)
    },
    async updateStep(id: string, patch: Record<string, unknown>) {
      steps.set(id, { ...(steps.get(id) ?? {}), ...patch })
    },
    async getSteps(taskId: string) {
      return (stepsByTask.get(taskId) ?? [])
        .map((id) => steps.get(id))
        .filter((s): s is Record<string, unknown> => s != null)
    },
    async getStep(id: string) {
      return steps.get(id) ?? null
    },
    async createHitlGate() {},
    async updateHitlGate() {},
    async getPendingGates() {
      return []
    },
    async getGate() {
      return null
    },
    getPausedState(id: string) {
      const task = tasks.get(id)
      return (task?.pausedStateJson as string) ?? null
    },
  } as unknown as AutonomousExecutionStore & { getPausedState(id: string): string | null }

  return store
}

function makeResolver(): IntentResolver {
  const intent: ParsedIntent = {
    patternId: 'p',
    intent: 'do it',
    input: {},
    confidence: 1,
    rawInput: 'do it',
    matchedPattern: 'do',
    alternatives: [
      {
        patternId: 'p2',
        intent: 'second',
        input: {},
        confidence: 1,
        rawInput: 'second',
        matchedPattern: 'second',
        alternatives: [],
        resolvedAt: Date.now(),
        capabilityId: 'capability_call',
        classification: 'read',
      },
    ],
    resolvedAt: Date.now(),
    capabilityId: 'capability_call',
    classification: 'read',
  }
  return {
    name: 'mock',
    async resolve() {
      return intent
    },
  }
}

function makeGoal() {
  return {
    description: 'do two things',
    maxSteps: 10,
    maxDurationMs: 60_000,
    requireApprovalAbove: 'destructive' as const,
    allowBrowser: true,
    costBudgetCents: 100,
    tokenBudget: 50_000,
    iterationBudget: 30,
  }
}

describe('AutonomousExecutionEngine pause/resume (Unit 34.3)', () => {
  it('pauses after the in-flight step and emits autonomous:paused', async () => {
    const store = makeStore()
    const emitted: unknown[] = []
    const bus = {
      emit: (e: unknown) => emitted.push(e),
      on: () => {},
    } as unknown as CapabilityEventBus

    const policy = {
      evaluate: () => ({
        allowed: true,
        requiresApproval: false,
        classification: 'read',
        reason: '',
      }),
    } as unknown as ExecutionPolicyEngine

    let callCount = 0
    let engine!: AutonomousExecutionEngine
    const registry = {
      execute: async (_slug: string, _input: unknown, opts: { metadata?: { taskId?: string } }) => {
        if (callCount++ === 0) await engine.pause(opts.metadata?.taskId ?? 'missing')
        return { ok: true }
      },
    } as unknown as UnifiedCapabilityRegistry

    engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
    )

    const task = await engine.execute(makeGoal())
    const status = await engine.getStatus(task.id)
    expect(status?.status).toBe('paused')
    const completed = status?.steps.filter((s) => s.status === 'complete').length ?? 0
    expect(completed).toBe(1)
    expect(emitted.some((e) => (e as { type?: string }).type === 'autonomous:paused')).toBe(true)
  })

  it('resume continues from the first pending step and completes', async () => {
    const store = makeStore()
    const bus = { emit: () => {}, on: () => {} } as unknown as CapabilityEventBus
    const policy = {
      evaluate: () => ({
        allowed: true,
        requiresApproval: false,
        classification: 'read',
        reason: '',
      }),
    } as unknown as ExecutionPolicyEngine
    let engine!: AutonomousExecutionEngine
    const registry = {
      execute: async () => ({ ok: true }),
    } as unknown as UnifiedCapabilityRegistry

    engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
    )

    const task = await engine.execute(makeGoal())
    await engine.pause(task.id)
    const resumed = await engine.resume(task.id)
    expect(resumed?.status).toBe('complete')
    const allComplete = (resumed?.steps ?? []).every((s) => s.status === 'complete') ?? false
    expect(allComplete).toBe(true)
  })

  it('pause writes paused_state_json with cursor + plan + provenanceRoot', async () => {
    const store = makeStore()
    const bus = { emit: () => {}, on: () => {} } as unknown as CapabilityEventBus
    const policy = {
      evaluate: () => ({
        allowed: true,
        requiresApproval: false,
        classification: 'read',
        reason: '',
      }),
    } as unknown as ExecutionPolicyEngine
    let callCount = 0
    let engine!: AutonomousExecutionEngine
    // Pause during first step execution
    const registry = {
      execute: async () => {
        if (callCount++ === 0) await engine.pause(engine ? (engine as unknown as { activeTasks: Map<string, unknown> }).activeTasks.keys().next().value ?? '' : '')
        return { ok: true }
      },
    } as unknown as UnifiedCapabilityRegistry

    engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
    )

    const task = await engine.execute(makeGoal())
    // Task should be paused (registry paused it during first step)
    const status = await engine.getStatus(task.id)
    expect(status?.status).toBe('paused')

    const pausedJson = store.getPausedState(task.id)
    expect(pausedJson).not.toBeNull()

    const snapshot = JSON.parse(pausedJson!)
    expect(typeof snapshot.cursor).toBe('number')
    expect(Array.isArray(snapshot.plan)).toBe(true)
    expect(typeof snapshot.provenanceRoot).toBe('string')
    // First step was 'running' when paused, cursor points to it
    expect(snapshot.cursor).toBe(0)
    // Plan should have entries for each step
    expect(snapshot.plan.length).toBeGreaterThanOrEqual(2)
  })

  it('resume with matching world continues without replan', async () => {
    const store = makeStore()
    const emitted: unknown[] = []
    const bus = {
      emit: (e: unknown) => emitted.push(e),
      on: () => {},
    } as unknown as CapabilityEventBus
    const policy = {
      evaluate: () => ({
        allowed: true,
        requiresApproval: false,
        classification: 'read',
        reason: '',
      }),
    } as unknown as ExecutionPolicyEngine
    let engine!: AutonomousExecutionEngine
    const registry = {
      execute: async () => ({ ok: true }),
    } as unknown as UnifiedCapabilityRegistry

    engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
    )

    const task = await engine.execute(makeGoal())
    await engine.pause(task.id)
    await engine.resume(task.id)

    // Should emit resumed with replanned: false
    const resumedEvent = emitted.find((e) => (e as { type?: string }).type === 'autonomous:resumed')
    expect(resumedEvent).toBeDefined()
    expect((resumedEvent as { replanned?: boolean }).replanned).toBe(false)
  })

  it('resume with mismatched cursor triggers replan', async () => {
    const store = makeStore()
    const emitted: unknown[] = []
    const bus = {
      emit: (e: unknown) => emitted.push(e),
      on: () => {},
    } as unknown as CapabilityEventBus
    const policy = {
      evaluate: () => ({
        allowed: true,
        requiresApproval: false,
        classification: 'read',
        reason: '',
      }),
    } as unknown as ExecutionPolicyEngine
    let callCount = 0
    let engine!: AutonomousExecutionEngine
    // Pause during first step execution
    const registry = {
      execute: async () => {
        if (callCount++ === 0) await engine.pause(engine ? (engine as unknown as { activeTasks: Map<string, unknown> }).activeTasks.keys().next().value ?? '' : '')
        return { ok: true }
      },
    } as unknown as UnifiedCapabilityRegistry

    engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
    )

    const task = await engine.execute(makeGoal())
    // Task is paused by registry during first step

    // Tamper with the cursor — mark all steps as complete in the store
    // This simulates the world changing between pause and resume
    const steps = await (store as unknown as { getSteps(id: string): Promise<Record<string, unknown>[]> }).getSteps(task.id)
    for (const step of steps) {
      await store.updateStep(step.id as string, { status: 'complete' })
    }

    await engine.resume(task.id)

    // Should emit resumed with replanned: true
    const resumedEvent = emitted.find((e) => (e as { type?: string }).type === 'autonomous:resumed')
    expect(resumedEvent).toBeDefined()
    expect((resumedEvent as { replanned?: boolean }).replanned).toBe(true)
  })

  it('resume emits autonomous:resumed event', async () => {
    const store = makeStore()
    const emitted: unknown[] = []
    const bus = {
      emit: (e: unknown) => emitted.push(e),
      on: () => {},
    } as unknown as CapabilityEventBus
    const policy = {
      evaluate: () => ({
        allowed: true,
        requiresApproval: false,
        classification: 'read',
        reason: '',
      }),
    } as unknown as ExecutionPolicyEngine
    let engine!: AutonomousExecutionEngine
    const registry = {
      execute: async () => ({ ok: true }),
    } as unknown as UnifiedCapabilityRegistry

    engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
    )

    const task = await engine.execute(makeGoal())
    await engine.pause(task.id)
    emitted.length = 0 // Clear events
    await engine.resume(task.id)

    expect(emitted.some((e) => (e as { type?: string }).type === 'autonomous:resumed')).toBe(true)
  })

  it('pause/resume cycle works across multiple pause-resume iterations', async () => {
    const store = makeStore()
    const bus = { emit: () => {}, on: () => {} } as unknown as CapabilityEventBus
    const policy = {
      evaluate: () => ({
        allowed: true,
        requiresApproval: false,
        classification: 'read',
        reason: '',
      }),
    } as unknown as ExecutionPolicyEngine
    let engine!: AutonomousExecutionEngine
    const registry = {
      execute: async () => ({ ok: true }),
    } as unknown as UnifiedCapabilityRegistry

    engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
    )

    const task = await engine.execute(makeGoal())
    // First pause/resume
    await engine.pause(task.id)
    const r1 = await engine.resume(task.id)
    expect(r1?.status).not.toBe('paused')

    // Second pause/resume
    await engine.pause(task.id)
    const r2 = await engine.resume(task.id)
    expect(r2?.status).toBe('complete')
  })
})
