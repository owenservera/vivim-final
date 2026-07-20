import { describe, expect, it } from 'bun:test'
import { AutonomousExecutionEngine } from '../../../src/engines/autonomous-execution.js'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type { ExecutionPolicyEngine } from '../../../src/engines/execution-policy.js'
import type { IntentResolver, ParsedIntent } from '../../../src/engines/nlcl/types.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { AutonomousExecutionStore } from '../../../src/storage/contracts/autonomous-store.js'

function makeStore(): AutonomousExecutionStore {
  const tasks = new Map<string, Record<string, unknown>>()
  const steps = new Map<string, Record<string, unknown>>()
  const stepsByTask = new Map<string, string[]>()
  return {
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
  } as unknown as AutonomousExecutionStore
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
    // biome-ignore lint/style/useConst: assigned exactly once after registry closure is defined
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
    // the first step triggers pause via the registry; taskId is known via getStatus
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
    // biome-ignore lint/style/useConst: assigned exactly once after registry closure is defined
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
    // pause it, then resume
    await engine.pause(task.id)
    const resumed = await engine.resume(task.id)
    expect(resumed?.status).toBe('complete')
    const allComplete = (resumed?.steps ?? []).every((s) => s.status === 'complete') ?? false
    expect(allComplete).toBe(true)
  })
})
