// tests/unit/engines/autonomous-budgets.test.ts
// Unit 8.6: Per-task budget enforcement tests
import { beforeEach, describe, expect, it } from 'bun:test'
import {
  AutonomousExecutionEngine,
  type AutonomousGoal,
} from '../../../src/engines/autonomous-execution.js'
import { BudgetExceededError } from '../../../src/errors.js'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { ExecutionPolicyEngine, type PolicyStore } from '../../../src/engines/execution-policy.js'

// ── Mock stores ─────────────────────────────────────────────────────────

function mockAutonomousStore() {
  const tasks = new Map<string, Record<string, unknown>>()
  const steps = new Map<string, Record<string, unknown>>()
  const gates = new Map<string, Record<string, unknown>>()

  return {
    tasks,
    steps,
    gates,
    async createTask(task: Record<string, unknown>) {
      tasks.set(task.id as string, task)
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
    async createStep(step: Record<string, unknown>) {
      steps.set(step.id as string, step)
    },
    async updateStep(id: string, patch: Record<string, unknown>) {
      const s = steps.get(id)
      if (s) Object.assign(s, patch)
    },
    async getSteps(taskId: string) {
      return Array.from(steps.values())
        .filter((s) => s.taskId === taskId)
        .sort((a, b) => (a.stepIndex as number) - (b.stepIndex as number))
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
    async getPendingGates(taskId?: string) {
      return Array.from(gates.values()).filter(
        (g) => g.status === 'pending' && (!taskId || g.taskId === taskId),
      )
    },
    async getGate(id: string) {
      return gates.get(id) ?? null
    },
  }
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
      async send(_slaveId: string, _method: string, _params: unknown) {
        return {}
      },
      async captureScreenshot(_slaveId: string) {
        return 'base64-screenshot'
      },
      async getPageState(_slaveId: string) {
        return { readyState: 'complete' }
      },
    },
    async ensureRunning(_profile: string) {
      return { slaveId: 'test-slave' }
    },
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function makeGoal(overrides?: Partial<AutonomousGoal>): AutonomousGoal {
  return {
    description: 'Test task',
    maxSteps: 10,
    maxDurationMs: 60_000,
    requireApprovalAbove: 'financial',  // Only financial actions need approval
    allowBrowser: false,
    costBudgetCents: 100,
    tokenBudget: 10_000,
    iterationBudget: 5,
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('AutonomousExecutionEngine — Unit 8.6: Per-task budgets', () => {
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

  it('completes steps under all budgets', async () => {
    const goal = makeGoal({ iterationBudget: 5, tokenBudget: 10_000, costBudgetCents: 100 })
    const task = await engine.execute(goal)

    // Task should complete (mocked policy allows all, no real execution)
    expect(task.status).toBe('complete')
    expect(task.steps.length).toBeGreaterThan(0)

    // Budget usage should track iterations
    const usage = engine.getBudgetUsage(task.id)
    expect(usage).toBeDefined()
    expect(usage!.iterations).toBeGreaterThanOrEqual(1)
  })

  it('pauses task when tokenBudget exceeded', async () => {
    // Budget of 0 means any token usage (or even 0 used with 0 budget) pauses
    const goal = makeGoal({ tokenBudget: 0, iterationBudget: 100, costBudgetCents: 100 })
    const task = await engine.execute(goal)

    // Task should be paused due to budget exceeded
    expect(task.status).toBe('paused')

    // Store should have been updated with pause reason
    const stored = store.tasks.get(task.id)
    expect(stored?.status).toBe('paused')
    expect(stored?.pauseReason).toBe('budget_exceeded')
  })

  it('pauses task when costBudgetCents exceeded', async () => {
    // Set very low cost budget
    const goal = makeGoal({ costBudgetCents: 0, tokenBudget: 10_000, iterationBudget: 100 })
    const task = await engine.execute(goal)

    // Task should be paused due to budget exceeded
    expect(task.status).toBe('paused')

    const stored = store.tasks.get(task.id)
    expect(stored?.status).toBe('paused')
    expect(stored?.pauseReason).toBe('budget_exceeded')
  })

  it('pauses task when iterationBudget exceeded', async () => {
    // Set very low iteration budget
    const goal = makeGoal({ iterationBudget: 0, tokenBudget: 10_000, costBudgetCents: 100 })
    const task = await engine.execute(goal)

    // Task should be paused due to budget exceeded
    expect(task.status).toBe('paused')

    const stored = store.tasks.get(task.id)
    expect(stored?.status).toBe('paused')
    expect(stored?.pauseReason).toBe('budget_exceeded')
  })

  it('getBudgetUsage returns undefined for unknown task', () => {
    const usage = engine.getBudgetUsage('nonexistent')
    expect(usage).toBeUndefined()
  })
})
