import { beforeEach, describe, expect, it } from 'bun:test'
import {
  AutonomousExecutionEngine,
  type AutonomousGoal,
  type AutonomousStep,
} from '../../../src/engines/autonomous-execution.js'
import { ReplayController } from '../../../src/engines/autonomous-replay.js'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { ExecutionPolicyEngine, type PolicyStore } from '../../../src/engines/execution-policy.js'
import type { AutonomousExecutionStore } from '../../../src/storage/contracts/autonomous-store.js'

// In-memory store prefilled with a completed source task + steps.
function seedStore(): { store: AutonomousExecutionStore; sourceId: string; stepIds: string[] } {
  const tasks = new Map<string, Record<string, unknown>>()
  const steps = new Map<string, Record<string, unknown>>()
  const stepsByTask = new Map<string, string[]>()
  const sourceId = 'src-1'
  const stepIds = ['s0', 's1', 's2']
  tasks.set(sourceId, {
    id: sourceId,
    goalJson: JSON.stringify({ description: 'do three things' }),
    status: 'complete',
    startedAt: 1,
    completedAt: 2,
    resultJson: 'null',
    error: null,
  })
  const seedSteps: Array<Partial<AutonomousStep>> = [
    {
      id: 's0',
      status: 'complete',
      result: { input: { capabilitySlug: 'cap.x', input: { n: 0 } } },
    },
    {
      id: 's1',
      status: 'complete',
      result: { input: { capabilitySlug: 'cap.x', input: { n: 1 } } },
    },
    {
      id: 's2',
      status: 'complete',
      result: { input: { capabilitySlug: 'cap.x', input: { n: 2 } } },
    },
  ]
  stepIds.forEach((id, i) => {
    const seed = seedSteps[i] ?? {}
    const rec = {
      id,
      taskId: sourceId,
      stepIndex: i,
      description: `step ${i}`,
      action: 'capability_call',
      actionInputJson: JSON.stringify({ capabilitySlug: 'cap.x', input: { n: i } }),
      classification: 'read',
      status: seed.status,
      resultJson: JSON.stringify(seed.result),
      error: null,
      startedAt: 1,
      completedAt: 2,
      requiresHumanApproval: 0,
    }
    steps.set(id, rec)
    stepsByTask.set(sourceId, [...(stepsByTask.get(sourceId) ?? []), id])
  })

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
        .sort((a, b) => (a.stepIndex as number) - (b.stepIndex as number))
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

  return { store, sourceId, stepIds }
}

describe('ReplayController branching (Unit 34.4)', () => {
  it('reproduces the original result on unchanged input (acceptance 1)', async () => {
    const { store, sourceId } = seedStore()
    const executor = async (step: AutonomousStep) => ({ input: step.actionInput })
    const controller = new ReplayController(store, executor)

    const res = await controller.branch(sourceId)
    expect(res.branchTask.status).toBe('complete')
    // all steps re-run but match original results
    expect(res.diff.every((d) => !d.changed)).toBe(true)
    // original untouched
    const orig = await store.getTask(sourceId)
    expect(orig?.status).toBe('complete')
    // branch is a new run id
    expect(res.branchId).not.toBe(sourceId)
  })

  it("overriding a step's input re-runs from that step only (acceptance 2 & 3)", async () => {
    const { store, sourceId, stepIds } = seedStore()
    let _calls = 0
    const executor = async (step: AutonomousStep) => {
      _calls++
      return { input: step.actionInput }
    }
    const controller = new ReplayController(store, executor)

    const res = await controller.branch(sourceId, {
      fromStep: stepIds[1],
      overrideInput: { n: 99 },
    })

    // steps before branch-from are copied (skipped, not executed)
    expect(res.diff[0]?.branchStatus).toBe('complete')
    expect(res.diff[0]?.changed).toBe(false)
    // branch-from step reflects the override and diverged
    expect(res.diff[1]?.branchStatus).toBe('complete')
    expect(res.diff[1]?.changed).toBe(true)
    expect(res.branchTask.steps[1]?.actionInput).toMatchObject({ n: 99 })
    // original timeline intact
    const orig = await store.getTask(sourceId)
    expect(orig?.status).toBe('complete')
    const origResult = JSON.parse((await store.getStep(stepIds[1] ?? ''))?.resultJson as string)
    expect(origResult.input.input.n).toBe(1)
  })
})

// ── Engine-level replay tests (Unit 8.5) ─────────────────────────────────

function mockAutonomousStore() {
  const tasks = new Map<string, Record<string, unknown>>()
  const steps = new Map<string, Record<string, unknown>>()
  const stepsByTask = new Map<string, string[]>()
  const gates = new Map<string, Record<string, unknown>>()
  return {
    tasks,
    steps,
    stepsByTask,
    gates,
    async createTask(t: Record<string, unknown>) {
      tasks.set(t.id as string, { ...t })
      stepsByTask.set(t.id as string, [])
    },
    async updateTask(id: string, patch: Record<string, unknown>) {
      const t = tasks.get(id)
      if (t) Object.assign(t, patch)
    },
    async getTask(id: string) {
      return tasks.get(id) ?? null
    },
    async listTasks(opts?: { status?: string; limit?: number }) {
      let rows = Array.from(tasks.values())
      if (opts?.status) rows = rows.filter((r) => r.status === opts.status)
      return rows.slice(0, opts?.limit ?? 50)
    },
    async createStep(s: Record<string, unknown>) {
      steps.set(s.id as string, { ...s })
      stepsByTask.set(s.taskId as string, [
        ...(stepsByTask.get(s.taskId as string) ?? []),
        s.id as string,
      ])
    },
    async updateStep(id: string, patch: Record<string, unknown>) {
      const s = steps.get(id)
      if (s) Object.assign(s, patch)
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
      gates.set(gate.id as string, gate)
    },
    async updateHitlGate(id: string, patch: Record<string, unknown>) {
      const g = gates.get(id)
      if (g) Object.assign(g, patch)
    },
    async getPendingGates() {
      return Array.from(gates.values()).filter((g) => g.status === 'pending')
    },
    async getGate(id: string) {
      return gates.get(id) ?? null
    },
    async insertTaskTemplate() {},
    async getTaskTemplate() {
      return null
    },
  } as unknown as AutonomousExecutionStore
}

function mockPolicyStore(): PolicyStore & {
  rules: Map<string, Record<string, unknown>>
  occurrences: Map<string, number[]>
} {
  const rules = new Map<string, Record<string, unknown>>()
  const occurrences = new Map<string, number[]>()
  return {
    rules,
    occurrences,
    async createRule(rule) {
      rules.set(rule.id as string, rule)
    },
    async updateRule(id, patch) {
      const r = rules.get(id)
      if (r) Object.assign(r, patch)
    },
    async getRule(id) {
      return rules.get(id) ?? null
    },
    async listRules() {
      return Array.from(rules.values())
    },
    async getRecentOccurrences(action, windowMs) {
      const now = Date.now()
      return (occurrences.get(action) ?? []).filter((t) => now - t < windowMs).length
    },
  }
}

function mockRegistry() {
  const caps = new Map<string, { id: string; handler: (input: unknown) => Promise<unknown> }>()
  return {
    caps,
    register(id: string, handler: (input: unknown) => Promise<unknown>) {
      caps.set(id, { id, handler })
    },
    async execute(capId: string, input: Record<string, unknown>) {
      const cap = caps.get(capId)
      if (!cap) throw new Error(`Capability not found: ${capId}`)
      return cap.handler(input)
    },
    list() {
      return []
    },
  }
}

function mockGovernor() {
  return {
    cdp: {
      async send() {
        return {}
      },
      async captureScreenshot() {
        return 'base64'
      },
      async getPageState() {
        return { readyState: 'complete' }
      },
    },
    async ensureRunning() {
      return { slaveId: 'test-slave' }
    },
  }
}

describe('AutonomousExecutionEngine.replay (Unit 8.5)', () => {
  let store: ReturnType<typeof mockAutonomousStore>
  let policyStore: ReturnType<typeof mockPolicyStore>
  let policyEngine: ExecutionPolicyEngine
  let registry: ReturnType<typeof mockRegistry>
  let governor: ReturnType<typeof mockGovernor>
  let eventBus: CapabilityEventBus
  let engine: AutonomousExecutionEngine

  beforeEach(async () => {
    store = mockAutonomousStore()
    policyStore = mockPolicyStore()
    policyEngine = new ExecutionPolicyEngine(policyStore)
    await policyEngine.initialize()
    registry = mockRegistry()
    governor = mockGovernor()
    eventBus = new CapabilityEventBus()
    engine = new AutonomousExecutionEngine(
      store as never,
      registry as never,
      policyEngine as never,
      governor as never,
      eventBus,
    )
  })

  async function seedCompletedTask(): Promise<{ taskId: string; stepIds: string[] }> {
    const goal: AutonomousGoal = {
      description: 'test goal',
      maxSteps: 10,
      maxDurationMs: 60_000,
      requireApprovalAbove: 'write',
      allowBrowser: false,
      costBudgetCents: 100,
      tokenBudget: 50_000,
      iterationBudget: 30,
    }
    // Execute the task to create it with steps
    registry.register('test-cap', async () => ({ ok: true }))
    const task = await engine.execute(goal)

    // Manually mark all steps as complete
    for (const step of task.steps) {
      step.status = 'complete'
      step.result = { done: true }
      step.completedAt = Date.now()
      await store.updateStep(step.id, {
        status: 'complete',
        resultJson: JSON.stringify({ done: true }),
        completedAt: step.completedAt,
      })
    }
    await store.updateTask(task.id, {
      status: 'complete',
      resultJson: JSON.stringify(
        task.steps.map((s) => ({ step: s.description, result: s.result })),
      ),
      completedAt: Date.now(),
    })
    task.status = 'complete'

    return { taskId: task.id, stepIds: task.steps.map((s) => s.id) }
  }

  it('branch:false re-executes original from fromStep, returns same id', async () => {
    const { taskId } = await seedCompletedTask()
    const resultId = await engine.replay(taskId, { fromStep: 1, branch: false })
    expect(resultId).toBe(taskId)
    // Task should be back in executing state
    const task = await engine.getStatus(taskId)
    expect(task).not.toBeNull()
  })

  it('branch:true creates a new task, original untouched', async () => {
    const { taskId } = await seedCompletedTask()
    const branchId = await engine.replay(taskId, { fromStep: 1, branch: true })
    expect(branchId).not.toBe(taskId)

    // Original task should still be complete
    const orig = await engine.getStatus(taskId)
    expect(orig?.status).toBe('complete')

    // Branch task should exist
    const branch = await engine.getStatus(branchId)
    expect(branch).not.toBeNull()
    if (!branch) throw new Error('branch not found')
    expect(branch.goal.description).toBe('test goal')
  })

  it('branch:true copies steps 0..fromStep from original', async () => {
    // Use a goal that produces multiple steps via planStepsLocally
    const goal: AutonomousGoal = {
      description: 'https://example.com screenshot search test',
      maxSteps: 10,
      maxDurationMs: 60_000,
      requireApprovalAbove: 'write',
      allowBrowser: false,
      costBudgetCents: 100,
      tokenBudget: 50_000,
      iterationBudget: 30,
    }
    registry.register('test-cap', async () => ({ ok: true }))
    const task = await engine.execute(goal)
    // planStepsLocally produces: navigate, screenshot, search = 3 steps
    expect(task.steps.length).toBeGreaterThanOrEqual(2)

    // Mark all complete
    for (const s of task.steps) {
      s.status = 'complete'
      s.result = { done: true }
      s.completedAt = Date.now()
      await store.updateStep(s.id, {
        status: 'complete',
        resultJson: JSON.stringify({ done: true }),
        completedAt: s.completedAt,
      })
    }
    await store.updateTask(task.id, {
      status: 'complete',
      resultJson: 'null',
      completedAt: Date.now(),
    })

    const branchId = await engine.replay(task.id, { fromStep: 1, branch: true })
    const branch = await engine.getStatus(branchId)
    expect(branch).not.toBeNull()
    if (!branch) throw new Error('branch not found')
    // Branch should have fromStep+1 steps (0 and 1)
    expect(branch.steps.length).toBe(2)
    // First step should be complete (copied from original)
    const firstStep = branch.steps[0]
    if (!firstStep) throw new Error('first step missing')
    expect(firstStep.status).toBe('complete')
    expect(firstStep.result).toEqual({ done: true })
  })

  it('branch emits autonomous:branch_created event', async () => {
    const { taskId } = await seedCompletedTask()
    const events: unknown[] = []
    const unsub = eventBus.on('autonomous:branch_created', (e) => events.push(e))

    await engine.replay(taskId, { fromStep: 0, branch: true })

    const branchEvent = events.find(
      (e) => (e as { type: string }).type === 'autonomous:branch_created',
    )
    expect(branchEvent).toBeDefined()
    expect((branchEvent as { sourceTaskId: string }).sourceTaskId).toBe(taskId)
    unsub()
  })

  it('replay of unknown taskId throws', async () => {
    await expect(engine.replay('nonexistent', { fromStep: 0, branch: false })).rejects.toThrow(
      'No task nonexistent',
    )
  })
})
