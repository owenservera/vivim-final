// src/engines/task-history.ts
// TaskHistoryService — task list with full-text search + per-task timeline (Unit 8.11)

import type { AutonomousExecutionStore } from '../storage/contracts/autonomous-store.js'

// ── Types ───────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'pending'
  | 'planning'
  | 'executing'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'cancelled'

export interface TaskSummary {
  id: string
  goal: string
  status: TaskStatus
  stepCount: number
  costCents: number
  startedAt: number
  completedAt: number | null
}

export interface TaskTimelineStep {
  id: string
  stepIndex: number
  description: string
  action: string
  classification: string
  status: string
  result: unknown
  error: string | null
  startedAt: number | null
  completedAt: number | null
}

export interface TaskTimelineGate {
  id: string
  gateType: string
  prompt: string
  status: string
  resolvedBy: string | null
  resolvedAt: number | null
  response: string | null
}

export interface TaskTimeline {
  dag: TaskTimelineStep[]
  gates: TaskTimelineGate[]
  taskGoal: string
  taskStatus: TaskStatus
}

// ── Store contract (subset needed for history) ───────────────────────────

export interface TaskHistoryStore {
  listTasks(opts?: {
    status?: string
    limit?: number
    offset?: number
  }): Promise<Array<Record<string, unknown>>>
  getSteps(taskId: string): Promise<Array<Record<string, unknown>>>
  getPendingGates(taskId?: string): Promise<Array<Record<string, unknown>>>
  getTask(id: string): Promise<Record<string, unknown> | null>
}

// ── Service ──────────────────────────────────────────────────────────────

export class TaskHistoryService {
  constructor(private store: TaskHistoryStore) {}

  /**
   * Search tasks by query string, with optional status/date filters.
   * Empty query returns the full filtered list.
   */
  async search(
    query: string,
    filter?: { status?: TaskStatus; from?: number; to?: number },
  ): Promise<TaskSummary[]> {
    const rows = await this.store.listTasks({
      status: filter?.status,
      limit: 200,
    })

    let results = rows.map((r) => ({
      id: r.id as string,
      goal: this.extractGoal(r.goalJson as string),
      status: (r.status as TaskStatus) ?? 'pending',
      stepCount: 0,
      costCents: 0,
      startedAt: r.startedAt as number,
      completedAt: (r.completedAt as number) ?? null,
    }))

    // Date filters
    if (filter?.from !== undefined) {
      results = results.filter((t) => t.startedAt >= filter.from!)
    }
    if (filter?.to !== undefined) {
      results = results.filter((t) => t.startedAt <= filter.to!)
    }

    // Enrich with step counts
    for (const t of results) {
      const steps = await this.store.getSteps(t.id)
      t.stepCount = steps.length
    }

    // Full-text search
    if (query) {
      const q = query.toLowerCase()
      results = results.filter((t) => {
        if (t.goal.toLowerCase().includes(q)) return true
        // Step text search would require fetching step descriptions
        // For now, search goal text only (step text can be added via store)
        return false
      })
    }

    // Sort by startedAt descending (most recent first)
    results.sort((a, b) => b.startedAt - a.startedAt)

    return results
  }

  /**
   * Get the full timeline for a specific task: DAG steps + gates.
   */
  async timeline(taskId: string): Promise<TaskTimeline> {
    const task = await this.store.getTask(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const steps = await this.store.getSteps(taskId)
    const gates = await this.store.getPendingGates(taskId)

    return {
      dag: steps.map((s) => ({
        id: s.id as string,
        stepIndex: s.stepIndex as number,
        description: s.description as string,
        action: s.action as string,
        classification: s.classification as string,
        status: s.status as string,
        result: s.resultJson ? JSON.parse(s.resultJson as string) : null,
        error: (s.error as string) ?? null,
        startedAt: (s.startedAt as number) ?? null,
        completedAt: (s.completedAt as number) ?? null,
      })),
      gates: gates.map((g) => ({
        id: g.id as string,
        gateType: g.gateType as string,
        prompt: g.prompt as string,
        status: g.status as string,
        resolvedBy: (g.resolvedBy as string) ?? null,
        resolvedAt: (g.resolvedAt as number) ?? null,
        response: (g.response as string) ?? null,
      })),
      taskGoal: this.extractGoal(task.goalJson as string),
      taskStatus: (task.status as TaskStatus) ?? 'pending',
    }
  }

  private extractGoal(goalJson: string): string {
    try {
      const goal = JSON.parse(goalJson)
      return goal.description ?? ''
    } catch {
      return goalJson
    }
  }
}
