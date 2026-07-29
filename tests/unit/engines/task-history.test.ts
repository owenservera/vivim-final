import { beforeEach, describe, expect, it } from 'bun:test'
import { TaskHistoryService, type TaskHistoryStore } from '../../../src/engines/task-history.js'

// ── Mock Store ───────────────────────────────────────────────────────────

function mockStore(): TaskHistoryStore & {
  _tasks: Map<string, Record<string, unknown>>
  _steps: Map<string, Array<Record<string, unknown>>>
  _gates: Map<string, Array<Record<string, unknown>>>
} {
  const tasks = new Map<string, Record<string, unknown>>()
  const steps = new Map<string, Array<Record<string, unknown>>>()
  const gates = new Map<string, Array<Record<string, unknown>>>()

  return {
    _tasks: tasks,
    _steps: steps,
    _gates: gates,
    listTasks: async (opts) => {
      let all = [...tasks.values()]
      if (opts?.status) {
        all = all.filter((t) => t.status === opts.status)
      }
      return all.slice(0, opts?.limit ?? 100)
    },
    getSteps: async (taskId) => steps.get(taskId) ?? [],
    getPendingGates: async (taskId) => {
      if (taskId) return gates.get(taskId) ?? []
      return [...gates.values()].flat()
    },
    getTask: async (id) => tasks.get(id) ?? null,
  }
}

function addTask(
  store: ReturnType<typeof mockStore>,
  id: string,
  goal: string,
  status: string,
  startedAt: number,
) {
  store._tasks.set(id, {
    id,
    goalJson: JSON.stringify({ description: goal }),
    status,
    startedAt,
    completedAt: null,
  })
}

function addStep(
  store: ReturnType<typeof mockStore>,
  taskId: string,
  stepId: string,
  description: string,
  action: string,
) {
  const steps = store._steps.get(taskId) ?? []
  steps.push({
    id: stepId,
    stepIndex: steps.length,
    description,
    action,
    classification: 'read',
    status: 'complete',
    resultJson: null,
    error: null,
    startedAt: Date.now(),
    completedAt: Date.now(),
  })
  store._steps.set(taskId, steps)
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('TaskHistoryService — Unit 8.11: Task search + history', () => {
  let store: ReturnType<typeof mockStore>
  let service: TaskHistoryService

  beforeEach(() => {
    store = mockStore()
    service = new TaskHistoryService(store)
  })

  it('search with empty query returns all tasks', async () => {
    addTask(store, 't1', 'Refactor auth module', 'complete', 1000)
    addTask(store, 't2', 'Summarize PR #42', 'failed', 2000)

    const results = await service.search('')
    expect(results.length).toBe(2)
  })

  it('search matches goal text', async () => {
    addTask(store, 't1', 'Refactor auth module', 'complete', 1000)
    addTask(store, 't2', 'Summarize PR #42', 'failed', 2000)
    addTask(store, 't3', 'Deploy to production', 'complete', 3000)

    const results = await service.search('auth')
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('t1')
    expect(results[0]!.goal).toBe('Refactor auth module')
  })

  it('search is case-insensitive', async () => {
    addTask(store, 't1', 'Refactor Auth Module', 'complete', 1000)

    const results = await service.search('auth')
    expect(results.length).toBe(1)
  })

  it('filter by status excludes other statuses', async () => {
    addTask(store, 't1', 'Task 1', 'complete', 1000)
    addTask(store, 't2', 'Task 2', 'failed', 2000)
    addTask(store, 't3', 'Task 3', 'running', 3000)

    const failed = await service.search('', { status: 'failed' })
    expect(failed.length).toBe(1)
    expect(failed[0]!.id).toBe('t2')
  })

  it('filter by date range', async () => {
    addTask(store, 't1', 'Task 1', 'complete', 1000)
    addTask(store, 't2', 'Task 2', 'complete', 2000)
    addTask(store, 't3', 'Task 3', 'complete', 3000)

    const results = await service.search('', { from: 1500, to: 2500 })
    expect(results.length).toBe(1)
    expect(results[0]!.id).toBe('t2')
  })

  it('timeline returns dag + gates', async () => {
    addTask(store, 't1', 'Test task', 'complete', 1000)
    addStep(store, 't1', 's1', 'Navigate to URL', 'navigate')
    addStep(store, 't1', 's2', 'Click button', 'click')
    store._gates.set('t1', [
      {
        id: 'g1',
        gateType: 'approval',
        prompt: 'Approve deletion?',
        status: 'resolved',
        resolvedBy: 'user1',
        resolvedAt: 1500,
        response: 'approve',
      },
    ])

    const timeline = await service.timeline('t1')
    expect(timeline.dag.length).toBe(2)
    expect(timeline.gates.length).toBe(1)
    expect(timeline.taskGoal).toBe('Test task')
    expect(timeline.taskStatus).toBe('complete')
  })

  it('timeline throws for nonexistent task', async () => {
    let threw = false
    try {
      await service.timeline('nonexistent')
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  it('search results sorted by startedAt descending', async () => {
    addTask(store, 't1', 'Task 1', 'complete', 1000)
    addTask(store, 't2', 'Task 2', 'complete', 3000)
    addTask(store, 't3', 'Task 3', 'complete', 2000)

    const results = await service.search('')
    expect(results[0]!.id).toBe('t2')
    expect(results[1]!.id).toBe('t3')
    expect(results[2]!.id).toBe('t1')
  })
})
