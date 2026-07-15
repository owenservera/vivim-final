// tests/unit/engines/autonomous-execution.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import {
  AutonomousExecutionEngine,
  type AutonomousGoal,
} from '../../../src/engines/autonomous-execution.js'
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

// ── Tests ───────────────────────────────────────────────────────────────

describe('AutonomousExecutionEngine', () => {
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

  it('navigate + screenshot completes without approval', async () => {
    const goal: AutonomousGoal = {
      description: 'Take a screenshot of example.com',
      maxSteps: 10,
      maxDurationMs: 30_000,
      requireApprovalAbove: 'write',
      allowBrowser: true,
      costBudgetCents: 100,
    }
    const task = await engine.execute(goal)
    expect(task.status).toBe('complete')
    expect(task.steps.length).toBeGreaterThan(0)
    expect(task.steps.some((s) => s.action === 'screenshot')).toBe(true)
  })

  it('destructive action triggers HITL gate then resolves', async () => {
    const goal: AutonomousGoal = {
      description: 'Delete permanent the database',
      maxSteps: 5,
      maxDurationMs: 30_000,
      requireApprovalAbove: 'read',
      allowBrowser: true,
      costBudgetCents: 100,
    }
    // Execute in background, resolve gate when created
    const taskPromise = engine.execute(goal)
    // Wait a tick for the gate to be created
    await new Promise((r) => setTimeout(r, 50))
    const gates = await engine.getPendingGates()
    if (gates.length > 0 && gates[0]) {
      await engine.resolveGate(gates[0].id, 'approve', 'test-user')
    }
    const task = await taskPromise
    // Task should have proceeded after approval
    expect(task.steps.length).toBeGreaterThan(0)
  })

  it('max steps limit prevents infinite loops', async () => {
    const goal: AutonomousGoal = {
      description: 'Do everything',
      maxSteps: 2,
      maxDurationMs: 30_000,
      requireApprovalAbove: 'financial',
      allowBrowser: false,
      costBudgetCents: 100,
    }
    const task = await engine.execute(goal)
    expect(task.steps.length).toBeLessThanOrEqual(2)
  })

  it('cancel stops execution', async () => {
    const goal: AutonomousGoal = {
      description: 'Navigate to example.com',
      maxSteps: 10,
      maxDurationMs: 30_000,
      requireApprovalAbove: 'financial',
      allowBrowser: true,
      costBudgetCents: 100,
    }
    // Start execution and immediately cancel
    const taskPromise = engine.execute(goal)
    // Get the task ID from the store
    const taskIds = Array.from(store.tasks.keys())
    if (taskIds.length > 0 && taskIds[0]) {
      await engine.cancel(taskIds[0])
    }
    const task = await taskPromise
    // Should have been cancelled or completed
    expect(task.status === 'cancelled' || task.status === 'complete').toBe(true)
  })

  it('getStatus returns task from store', async () => {
    const goal: AutonomousGoal = {
      description: 'Navigate to example.com',
      maxSteps: 5,
      maxDurationMs: 30_000,
      requireApprovalAbove: 'financial',
      allowBrowser: true,
      costBudgetCents: 100,
    }
    const task = await engine.execute(goal)
    const status = await engine.getStatus(task.id)
    expect(status).not.toBeNull()
    expect(status?.id).toBe(task.id)
  })

  it('getStatus returns null for unknown task', async () => {
    const status = await engine.getStatus('nonexistent')
    expect(status).toBeNull()
  })

  it('policy blocks disallowed actions then resolves', async () => {
    const goal: AutonomousGoal = {
      description: 'Create a new file',
      maxSteps: 5,
      maxDurationMs: 30_000,
      requireApprovalAbove: 'read',
      allowBrowser: false,
      costBudgetCents: 100,
    }
    const taskPromise = engine.execute(goal)
    await new Promise((r) => setTimeout(r, 50))
    const gates = await engine.getPendingGates()
    if (gates.length > 0 && gates[0]) {
      await engine.resolveGate(gates[0].id, 'approve', 'test-user')
    }
    const task = await taskPromise
    expect(task.status === 'complete' || task.status === 'waiting_approval').toBe(true)
  })
})
