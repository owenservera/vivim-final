import { describe, expect, it } from 'bun:test'
import type { AutonomousStep } from '../../../src/engines/autonomous-execution.js'
import { ReplayController } from '../../../src/engines/autonomous-replay.js'
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
    const seed = seedSteps[i]!
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
      return (stepsByTask.get(taskId) ?? []).map((id) => steps.get(id)!)
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
    const origResult = JSON.parse((await store.getStep(stepIds[1]!))?.resultJson as string)
    expect(origResult.input.input.n).toBe(1)
  })
})
