// src/engines/autonomous-replay.ts
// ReplayController — replay a finished autonomous task with branching.
//
// A branch re-executes the original step graph from a chosen step, allowing a
// single step's input/provider to be overridden. The branch gets a NEW run id;
// the original timeline is never mutated. A diff view compares original vs
// branch step results.

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import { safeJsonParse } from '../lib/safe-json.js'
import type { AutonomousExecutionStore } from '../storage/contracts/autonomous-store.js'
import type {
  AutonomousGoal,
  AutonomousStep,
  AutonomousTask,
  StepStatus,
} from './autonomous-execution.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

export interface ReplayBranchOptions {
  /** Step id to branch from. Steps before it are copied verbatim (skipped). */
  fromStep?: string
  /** Override merged into the branch-from-step's actionInput. */
  overrideInput?: Record<string, unknown>
  /** Override the branch-from-step's provider (stored on actionInput.provider). */
  overrideProvider?: string
}

export interface ReplayStepDiff {
  stepId: string
  description: string
  action: string
  originalStatus: StepStatus
  branchStatus: StepStatus
  originalResult: unknown
  branchResult: unknown
  changed: boolean
}

export interface ReplayResult {
  branchId: string
  branchTask: AutonomousTask
  diff: ReplayStepDiff[]
}

export type ReplayStepExecutor = (step: AutonomousStep, branchId: string) => Promise<unknown>

export class ReplayController {
  constructor(
    private readonly store: AutonomousExecutionStore,
    private readonly executor: ReplayStepExecutor,
    private readonly eventBus?: CapabilityEventBus,
  ) {}

  async branch(taskId: string, opts: ReplayBranchOptions = {}): Promise<ReplayResult> {
    const prev = await this.loadTask(taskId)
    if (!prev) throw new EngineError(`Task not found: ${taskId}`)

    const branchId = newId()
    const fromIdx = opts.fromStep != null ? prev.steps.findIndex((s) => s.id === opts.fromStep) : 0
    if (opts.fromStep != null && fromIdx < 0) {
      throw new EngineError(`Step not found: ${opts.fromStep}`)
    }

    // Clone steps into the branch task. Steps before `fromIdx` are copied as
    // complete (skipped); the branch-from-step and later steps are re-run.
    const branchSteps: AutonomousStep[] = prev.steps.map((s, i) => {
      const cloned: AutonomousStep = {
        ...s,
        id: newId(),
        taskId: branchId,
        status: 'pending' as StepStatus,
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
      }
      if (i < fromIdx) {
        cloned.status = s.status
        cloned.result = s.result
        cloned.error = s.error
        cloned.startedAt = s.startedAt
        cloned.completedAt = s.completedAt
      } else if (i === fromIdx) {
        if (opts.overrideInput) {
          cloned.actionInput = { ...cloned.actionInput, ...opts.overrideInput }
        }
        if (opts.overrideProvider) {
          cloned.actionInput = { ...cloned.actionInput, provider: opts.overrideProvider }
        }
      }
      return cloned
    })

    await this.store.createTask({
      id: branchId,
      goalJson: JSON.stringify(prev.goal),
      status: 'executing',
      startedAt: Date.now(),
    })
    for (const step of branchSteps) {
      await this.store.createStep({
        id: step.id,
        taskId: branchId,
        stepIndex: step.stepIndex,
        description: step.description,
        action: step.action,
        actionInputJson: JSON.stringify(step.actionInput),
        classification: step.classification,
        status: step.status,
        requiresHumanApproval: step.requiresHumanApproval ? 1 : 0,
      })
    }

    this.eventBus?.emit({ type: 'autonomous:branch_created', branchId, sourceTaskId: taskId })

    // Run the branch: skip copied steps, execute the rest.
    for (const step of branchSteps) {
      if (step.status === 'complete' || step.status === 'skipped') continue
      step.status = 'running'
      step.startedAt = Date.now()
      await this.store.updateStep(step.id, { status: 'running', startedAt: step.startedAt })
      try {
        const result = await this.executor(step, branchId)
        step.result = result
        step.status = 'complete'
        step.completedAt = Date.now()
        await this.store.updateStep(step.id, {
          status: 'complete',
          resultJson: JSON.stringify(result),
          completedAt: step.completedAt,
        })
      } catch (err) {
        step.status = 'failed'
        step.error = err instanceof Error ? err.message : String(err)
        step.completedAt = Date.now()
        await this.store.updateStep(step.id, {
          status: 'failed',
          error: step.error,
          completedAt: step.completedAt,
        })
      }
    }

    const branchFailed = branchSteps.some((s) => s.status === 'failed')
    const finalStatus = branchFailed ? 'failed' : 'complete'
    await this.store.updateTask(branchId, { status: finalStatus, completedAt: Date.now() })

    const branchTask = await this.loadTask(branchId)
    if (!branchTask) throw new EngineError(`Branch task missing: ${branchId}`)

    const diff: ReplayStepDiff[] = prev.steps.map((orig, i) => {
      const branch = branchSteps[i]
      const originalResult = orig.result
      const branchResult = branch?.result ?? null
      return {
        stepId: orig.id,
        description: orig.description,
        action: orig.action,
        originalStatus: orig.status,
        branchStatus: (branch?.status ?? 'pending') as StepStatus,
        originalResult,
        branchResult,
        changed: JSON.stringify(originalResult) !== JSON.stringify(branchResult),
      }
    })

    return { branchId, branchTask, diff }
  }

  private async loadTask(taskId: string): Promise<AutonomousTask | null> {
    const row = await this.store.getTask(taskId)
    if (!row) return null
    const steps = await this.store.getSteps(taskId)
    return {
      id: row.id as string,
      goal: safeJsonParse(row.goalJson as string, {} as AutonomousGoal),
      status: row.status as AutonomousTask['status'],
      steps: steps.map((s) => ({
        id: s.id as string,
        taskId: s.taskId as string,
        stepIndex: s.stepIndex as number,
        description: s.description as string,
        action: s.action as string,
        actionInput: safeJsonParse(s.actionInputJson as string, {}),
        classification: s.classification as AutonomousStep['classification'],
        status: s.status as StepStatus,
        result: safeJsonParse(s.resultJson as string, null),
        error: s.error as string | null,
        startedAt: s.startedAt as number | null,
        completedAt: s.completedAt as number | null,
        requiresHumanApproval: (s.requiresHumanApproval as number) === 1,
        parentStepId: (s.parentStepId as string | null) ?? null,
        isCompositeRoot: (s.isCompositeRoot as number) === 1,
      })),
      startedAt: row.startedAt as number,
      completedAt: row.completedAt as number | null,
      result: safeJsonParse(row.resultJson as string, null),
      error: row.error as string | null,
    }
  }
}
