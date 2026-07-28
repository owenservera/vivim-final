import { describe, expect, it } from 'bun:test'
import { AutonomousExecutionEngine } from '../../../src/engines/autonomous-execution.js'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type { ExecutionPolicyEngine } from '../../../src/engines/execution-policy.js'
import type { IntentResolver, ParsedIntent } from '../../../src/engines/nlcl/types.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import { EngineError } from '../../../src/errors.js'
import type { AutonomousExecutionStore } from '../../../src/storage/contracts/autonomous-store.js'

function makeStore(): { store: AutonomousExecutionStore; capture: { gateId: string | null } } {
  const tasks = new Map<string, Record<string, unknown>>()
  const steps = new Map<string, Record<string, unknown>>()
  const stepsByTask = new Map<string, string[]>()
  const gates = new Map<string, Record<string, unknown>>()
  const capture = { gateId: null as string | null }
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
      stepsByTask.set(s.taskId as string, [
        ...(stepsByTask.get(s.taskId as string) ?? []),
        s.id as string,
      ])
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
    async createHitlGate(gate: Record<string, unknown>) {
      gates.set(gate.id as string, { ...gate, status: 'pending' })
      capture.gateId = gate.id as string
    },
    async updateHitlGate(id: string, patch: Record<string, unknown>) {
      gates.set(id, { ...(gates.get(id) ?? {}), ...patch })
    },
    async getPendingGates() {
      return [...gates.values()].filter((g) => g.status === 'pending')
    },
    async getGate(id: string) {
      return gates.get(id) ?? null
    },
  } as unknown as AutonomousExecutionStore
  return { store, capture }
}

function makeResolver(): IntentResolver {
  const intent: ParsedIntent = {
    patternId: 'p',
    intent: 'do it',
    input: {},
    confidence: 1,
    rawInput: 'do it',
    matchedPattern: 'do',
    alternatives: [],
    resolvedAt: Date.now(),
    capabilityId: 'capability_call',
    classification: 'read',
  }
  return {
    name: 'mock',
    async resolve(): Promise<ParsedIntent> {
      return intent
    },
  }
}

function makeGoal(): any {
  return {
    description: 'do one thing',
    maxSteps: 10,
    maxDurationMs: 60_000,
    requireApprovalAbove: 'destructive' as const,
    tokenBudget: 1000,
    iterationBudget: 10,
    allowBrowser: true,
    costBudgetCents: 100,
  }
}

describe('AutonomousExecutionEngine provider failover (Unit 34.5)', () => {
  it('fails, consults fallbacks, opens option gate, re-executes against fallback', async () => {
    const { store, capture } = makeStore()
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
    const registry = {
      execute: async () => {
        callCount++
        if (callCount === 1) throw new EngineError('provider default crashed')
        return { ok: true, provider: 'fb' }
      },
    } as unknown as UnifiedCapabilityRegistry

    const engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
      { fallbacksFor: async () => ['fb'] },
    )

    // Start execute; it suspends inside clarify() awaiting a gate resolution.
    const taskPromise = engine.execute(makeGoal())
    let waited = 0
    while (capture.gateId == null && waited < 2000) {
      await new Promise((r) => setTimeout(r, 5))
      waited += 5
    }
    expect(capture.gateId).not.toBeNull()
    await engine.resolveGate(capture.gateId ?? '', 'fb', 'tester')
    const task = await taskPromise

    expect(task.status).toBe('complete')
    const step = task.steps[0]
    expect(step).toBeDefined()
    expect(step?.status).toBe('complete')
    expect(step?.actionInput.provider).toBe('fb')
    expect(emitted.some((e) => (e as { type?: string }).type === 'agent:clarify')).toBe(true)
    expect(emitted.some((e) => (e as { type?: string }).type === 'autonomous:failover')).toBe(true)
  })

  it('fails with no fallback and surfaces the original error', async () => {
    const { store } = makeStore()
    const bus = { emit: () => {}, on: () => {} } as unknown as CapabilityEventBus
    const policy = {
      evaluate: () => ({
        allowed: true,
        requiresApproval: false,
        classification: 'read',
        reason: '',
      }),
    } as unknown as ExecutionPolicyEngine
    const registry = {
      execute: async () => {
        throw new EngineError('provider default crashed')
      },
    } as unknown as UnifiedCapabilityRegistry

    const engine = new AutonomousExecutionEngine(
      store,
      registry,
      policy,
      {} as unknown as ChromeGovernor,
      bus,
      makeResolver(),
      { fallbacksFor: async () => [] },
    )

    const task = await engine.execute(makeGoal())
    const step = task.steps[0]
    expect(step).toBeDefined()
    expect(step?.status).toBe('failed')
    expect(step?.error).toContain('provider default crashed')
  })
})
