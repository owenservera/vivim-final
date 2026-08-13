// src/engines/autonomous-execution.ts
// AutonomousExecutionEngine — autonomous task planning + execution.
//
// Session 7 (2026-08-07): Types extracted to autonomous-types.ts.
// This file now contains only the engine class + planner functions.

import { BudgetExceededError, ConsentViolationError, EngineError } from '../errors.js'
import { newId } from '../ids.js'
import { catchDebug } from '../lib/catch-logger.js'
import { safeJsonParse } from '../lib/safe-json.js'
import type { AutonomousExecutionStore } from '../storage/contracts/autonomous-store.js'
import { ReplayController, type ReplayResult } from './autonomous-replay.js'
import type {
  ActionClassification,
  AutonomousGoal,
  AutonomousStep,
  AutonomousTask,
  BudgetUsage,
  FailoverRouter,
  GateStatus,
  GateType,
  HitlGate,
  ReplayOptions,
  StepStatus,
  TaskStatus,
} from './autonomous-types.js'
import { classificationAtLeast } from './autonomous-types.js'
import type { CapabilityComposer } from './capability-composer.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { ExecutionPolicyEngine, PolicyDecision } from './execution-policy.js'
import type { IntentResolver, NLCContext } from './nlcl/types.js'
import { planStepsFromIntent, planStepsLocally, resolvePlanner } from './autonomous-planner.js'
import type { SelectorHealer } from './selector-healer.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

// Re-export types so existing imports continue to work
export type {
  ActionClassification,
  AutonomousGoal,
  AutonomousStep,
  AutonomousTask,
  BudgetUsage,
  FailoverRouter,
  GateStatus,
  GateType,
  HitlGate,
  ReplayOptions,
  StepStatus,
  TaskStatus,
  TaskTemplate,
} from './autonomous-types.js'

// Planner helpers extracted to autonomous-planner.ts (Phase 1.3). Re-exported
// so existing imports (src/index.ts, autonomous-*.test.ts) continue to work.
export { planStepsFromIntent, planStepsLocally, resolvePlanner } from './autonomous-planner.js'
export type { PlannerResolution } from './autonomous-planner.js'

export class AutonomousExecutionEngine {
  private activeTasks = new Map<string, AutonomousTask>()
  private gateWaiters = new Map<
    string,
    { resolve: (gate: HitlGate) => void; timer: ReturnType<typeof setTimeout> }
  >()
  // Unit 8.6: per-task budget tracking
  private usage = new Map<string, BudgetUsage>()
  // Unit 8.12: canvas instance tracking per task
  private canvasByTask = new Map<string, string>()

  constructor(
    private readonly store: AutonomousExecutionStore,
    private readonly registry: UnifiedCapabilityRegistry,
    private readonly policyEngine: ExecutionPolicyEngine,
    private readonly governor: ChromeGovernor,
    private readonly eventBus: CapabilityEventBus,
    private readonly resolver?: IntentResolver,
    private readonly failoverRouter?: FailoverRouter,
    // Unit 36.2: offline-first defaults. airgap=true → planner uses local model
    // unless an explicit, consented cloud provider override is given.
    private readonly airgap: boolean = true,
    private readonly consentCheck: () => boolean | Promise<boolean> = () => false,
    // Unit 8.9: optional composer for composite step resolution
    private readonly composer?: CapabilityComposer,
    // Unit 8.5: optional provenance tracker for replay-branch causal links
    private readonly provenance?: {
      record(node: {
        traceId: string
        parentId: string | null
        kind: string
        engineId: string
        label: string
        metaJson: string
      }): Promise<string>
    },
    // Self-healing: optional injected SelectorHealer. When present, selector
    // repair uses the injected instance (testable, no dynamic import overhead).
    // When absent, falls back to a dynamic import for lazy loading.
    private readonly injectedHealer?: SelectorHealer,
  ) {}

  // Unit 8.6: per-task budget enforcement — checks cost/tokens/iterations
  // against the goal's budgets. Throws BudgetExceededError and pauses the task
  // if any budget is exceeded.
  private assertBudget(task: AutonomousTask, stepCost: { cents: number; tokens: number }): void {
    const u = this.usage.get(task.id) ?? { costCents: 0, tokens: 0, iterations: 0 }
    u.costCents += stepCost.cents
    u.tokens += stepCost.tokens
    u.iterations += 1
    const g = task.goal
    const over =
      u.costCents >= g.costBudgetCents ||
      u.tokens >= g.tokenBudget ||
      u.iterations >= g.iterationBudget
    if (over) {
      task.status = 'paused'
      this.store.updateTask(task.id, { status: 'paused', pauseReason: 'budget_exceeded' })
      this.usage.set(task.id, u)
      throw new BudgetExceededError(
        'budget',
        JSON.stringify(u),
        JSON.stringify({
          costBudgetCents: g.costBudgetCents,
          tokenBudget: g.tokenBudget,
          iterationBudget: g.iterationBudget,
        }),
      )
    }
    this.usage.set(task.id, u)
  }

  // Expose budget usage for UI burn-down (4.x)
  getBudgetUsage(taskId: string): BudgetUsage | undefined {
    return this.usage.get(taskId)
  }

  // Unit 8.6: simulate token/cost consumption for testing budget enforcement
  recordUsage(taskId: string, delta: Partial<BudgetUsage>): void {
    const u = this.usage.get(taskId) ?? { costCents: 0, tokens: 0, iterations: 0 }
    if (delta.costCents !== undefined) u.costCents += delta.costCents
    if (delta.tokens !== undefined) u.tokens += delta.tokens
    if (delta.iterations !== undefined) u.iterations += delta.iterations
    this.usage.set(taskId, u)
  }

  // Unit 8.10: task templates
  async saveTemplate(
    name: string,
    planJson: string,
    params: string[],
    isShared = false,
  ): Promise<string> {
    const id = newId()
    await this.store.insertTaskTemplate({
      id,
      name,
      paramsJson: JSON.stringify(params),
      planJson,
      version: 1,
      isShared: isShared ? 1 : 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    return id
  }

  async spawnFromTemplate(
    templateId: string,
    bindings: Record<string, string>,
  ): Promise<AutonomousTask> {
    const row = await this.store.getTaskTemplate(templateId)
    if (!row) throw new EngineError(`Template not found: ${templateId}`)
    const params: string[] = safeJsonParse(row.paramsJson as string, [])
    const description = this.bindParams(row.planJson as string, params, bindings)
    const goal: AutonomousGoal = {
      description,
      maxSteps: 20,
      maxDurationMs: 10 * 60_000,
      requireApprovalAbove: 'write',
      allowBrowser: true,
      costBudgetCents: 100,
      tokenBudget: 50_000,
      iterationBudget: 30,
    }
    return this.execute(goal)
  }

  private bindParams(plan: string, params: string[], bindings: Record<string, string>): string {
    return params.reduce((acc, p) => acc.replaceAll(`{${p}}`, bindings[p] ?? ''), plan)
  }

  async execute(goal: AutonomousGoal): Promise<AutonomousTask> {
    const taskId = newId()
    const task: AutonomousTask = {
      id: taskId,
      goal,
      status: 'planning',
      steps: [],
      startedAt: Date.now(),
      completedAt: null,
      result: null,
      error: null,
    }

    await this.store.createTask({
      id: taskId,
      goalJson: JSON.stringify(goal),
      status: 'planning',
      startedAt: task.startedAt,
    })
    this.activeTasks.set(taskId, task)

    this.eventBus.emit({
      type: 'autonomous:started',
      taskId,
      goal: goal.description,
    })

    try {
      const plan = await this.planGoal(goal)
      task.steps = plan

      for (const step of plan) {
        await this.store.createStep({
          id: step.id,
          taskId,
          stepIndex: step.stepIndex,
          description: step.description,
          action: step.action,
          actionInputJson: JSON.stringify(step.actionInput),
          classification: step.classification,
          status: 'pending',
          requiresHumanApproval: step.requiresHumanApproval ? 1 : 0,
        })
      }

      return this.runTask(task)
    } catch (err) {
      task.status = 'failed'
      task.error = err instanceof Error ? err.message : String(err)
      task.completedAt = Date.now()
      await this.store.updateTask(taskId, {
        status: 'failed',
        error: task.error,
        completedAt: task.completedAt,
      })
    }

    return task
  }

  // ── Pause / Resume (HITL v2) ──────────────────────────────────────────

  private async runTask(task: AutonomousTask): Promise<AutonomousTask> {
    const taskId = task.id
    if ((task.status as string) !== 'executing') {
      task.status = 'executing'
      await this.store.updateTask(taskId, { status: 'executing' })
    }

    try {
      // Unit 8.6: pre-loop budget gate — catches token/cost violations even with zero/one steps
      this.assertBudget(task, { cents: 0, tokens: 0 })

      for (const step of task.steps) {
        if ((task.status as string) === 'cancelled') break
        if ((task.status as string) === 'paused') break
        if (step.status === 'complete' || step.status === 'skipped') continue

        const decision = await this.policyEngine.evaluate(step.action, step.actionInput)
        step.requiresHumanApproval =
          decision.requiresApproval ||
          classificationAtLeast(step.classification, task.goal.requireApprovalAbove)

        if (step.requiresHumanApproval) {
          const gate = await this.createGate(taskId, step, decision)
          task.status = 'waiting_approval'
          await this.store.updateTask(taskId, { status: 'waiting_approval' })

          this.eventBus.emit({
            type: 'autonomous:gate_created',
            taskId,
            gateId: gate.id,
            prompt: gate.prompt,
          })

          const resolved = await this.waitForGateResolution(gate.id, 300_000)
          if (!resolved || resolved.status === 'denied') {
            step.status = 'skipped'
            await this.store.updateStep(step.id, { status: 'skipped' })
            continue
          }
          if (resolved.status === 'expired') {
            task.status = 'failed'
            task.error = 'Gate expired'
            break
          }

          task.status = 'executing'
          await this.store.updateTask(taskId, { status: 'executing' })
        }

        if (!decision.allowed) {
          step.status = 'skipped'
          step.error = `Blocked by policy: ${decision.reason}`
          await this.store.updateStep(step.id, { status: 'skipped', error: step.error })
          continue
        }

        // Unit 8.6: check budgets before executing step
        this.assertBudget(task, { cents: 0, tokens: 0 })

        step.status = 'running'
        step.startedAt = Date.now()
        await this.store.updateStep(step.id, { status: 'running', startedAt: step.startedAt })

        try {
          const result = await this.executeStepWithComposite(step, task)
          step.result = result
          step.status = 'complete'
          step.completedAt = Date.now()
          await this.store.updateStep(step.id, {
            status: 'complete',
            resultJson: JSON.stringify(result),
            completedAt: step.completedAt,
          })

          this.eventBus.emit({
            type: 'autonomous:step_complete',
            taskId,
            stepId: step.id,
            stepIndex: step.stepIndex,
          })
        } catch (err) {
          catchDebug(err, 'engines:autonomous-execution:442')
          step.status = 'failed'
          step.error = err instanceof Error ? err.message : String(err)
          step.completedAt = Date.now()
          await this.store.updateStep(step.id, {
            status: 'failed',
            error: step.error,
            completedAt: step.completedAt,
          })

          this.eventBus.emit({
            type: 'autonomous:step_failed',
            taskId,
            stepId: step.id,
            error: step.error,
          })

          if (
            step.classification === 'destructive' ||
            step.classification === 'financial' ||
            step.isCompositeRoot
          ) {
            task.status = 'failed'
            task.error = `Critical step failed: ${step.error}`
            break
          }
        }
      }

      if (
        (task.status as string) !== 'failed' &&
        (task.status as string) !== 'cancelled' &&
        (task.status as string) !== 'paused'
      ) {
        task.status = 'complete'
        task.result = task.steps.map((s) => ({ step: s.description, result: s.result }))
      }

      task.completedAt = Date.now()
      await this.store.updateTask(taskId, {
        status: task.status,
        resultJson: JSON.stringify(task.result),
        error: task.error,
        completedAt: task.completedAt,
      })

      if ((task.status as string) === 'complete') {
        this.eventBus.emit({
          type: 'autonomous:complete',
          taskId,
          status: task.status,
          stepsCompleted: task.steps.filter((s) => s.status === 'complete').length,
          stepsTotal: task.steps.length,
        })
      }
    } catch (err) {
      // Unit 8.6: BudgetExceededError already sets task.status = 'paused'; preserve it
      if (!(err instanceof BudgetExceededError)) {
        task.status = 'failed'
      }
      task.error = err instanceof Error ? err.message : String(err)
      task.completedAt = Date.now()
      await this.store.updateTask(taskId, {
        status: task.status as string,
        error: task.error,
        completedAt: task.completedAt,
      })
    } finally {
      this.activeTasks.delete(taskId)
    }

    return task
  }

  // ── Pause / Resume (HITL v2) ──────────────────────────────────────────

  // Snapshot the current cursor + plan + provenance root into paused_state_json
  private cursorOf(task: AutonomousTask): number {
    return task.steps.findIndex((s) => s.status === 'pending' || s.status === 'running')
  }

  private provRoot(task: AutonomousTask): string | null {
    return task.steps[0]?.id ?? null
  }

  private cursorMatches(task: AutonomousTask, savedCursor: number): boolean {
    return this.cursorOf(task) === savedCursor
  }

  private provChainIntact(task: AutonomousTask, savedRoot: string | null): boolean {
    return this.provRoot(task) === savedRoot
  }

  async pause(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId) ?? (await this.getStatus(taskId))
    if (!task) return
    task.status = 'paused'
    // Build snapshot from in-memory task (more accurate than store during mid-execution)
    const snapshot = {
      cursor: this.cursorOf(task),
      plan: task.steps.map((s) => ({ id: s.id, stepIndex: s.stepIndex, status: s.status })),
      provenanceRoot: this.provRoot(task),
    }
    await this.store.updateTask(taskId, {
      status: 'paused',
      pausedStateJson: JSON.stringify(snapshot),
    })
    this.eventBus.emit({ type: 'autonomous:paused', taskId })
  }

  async resume(taskId: string): Promise<AutonomousTask | null> {
    const task = this.activeTasks.get(taskId) ?? (await this.getStatus(taskId))
    if (!task) return null
    if ((task.status as string) !== 'paused') return task

    // Validate world state against snapshot
    const pausedRow = await this.store.getTask(taskId)
    const pausedStateJson = pausedRow?.pausedStateJson as string | null
    let worldMatches = true
    if (pausedStateJson) {
      const snapshot = safeJsonParse(pausedStateJson, {
        cursor: 0,
        plan: [],
        provenanceRoot: null,
      }) as {
        cursor: number
        plan: Array<{ id: string; stepIndex: number; status: string }>
        provenanceRoot: string | null
      }
      worldMatches =
        this.cursorMatches(task, snapshot.cursor) &&
        this.provChainIntact(task, snapshot.provenanceRoot)
    }

    this.activeTasks.set(taskId, task)
    this.eventBus.emit({ type: 'autonomous:resumed', taskId, replanned: !worldMatches })

    if (!worldMatches) {
      // World changed — replan remaining steps instead of blindly continuing
      void this.replanRemainingSteps(task)
      return task
    }

    return this.runTask(task)
  }

  // Replan remaining steps when world state doesn't match snapshot.
  // Marks incomplete steps as 'skipped' and creates new steps from the goal.
  private async replanRemainingSteps(task: AutonomousTask): Promise<void> {
    // Mark all pending/running steps as skipped
    for (const step of task.steps) {
      if (step.status === 'pending' || step.status === 'running') {
        step.status = 'skipped'
        await this.store.updateStep(step.id, { status: 'skipped' })
      }
    }

    // Create new steps from the goal
    const newSteps = await this.planGoal(task.goal)
    task.steps = [...task.steps.filter((s) => s.status === 'complete'), ...newSteps]

    for (const step of newSteps) {
      await this.store.createStep({
        id: step.id,
        taskId: task.id,
        stepIndex: step.stepIndex,
        description: step.description,
        action: step.action,
        actionInputJson: JSON.stringify(step.actionInput),
        classification: step.classification,
        status: 'pending',
        requiresHumanApproval: step.requiresHumanApproval ? 1 : 0,
      })
    }

    // Continue execution with new plan
    task.status = 'executing'
    await this.store.updateTask(task.id, { status: 'executing' })
    void this.runTask(task)
  }

  async cancel(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (task) {
      task.status = 'cancelled'
    }
    await this.store.updateTask(taskId, { status: 'cancelled' })
    this.eventBus.emit({ type: 'autonomous:cancelled', taskId })
  }

  async getStatus(taskId: string): Promise<AutonomousTask | null> {
    const active = this.activeTasks.get(taskId)
    if (active) return active

    const row = await this.store.getTask(taskId)
    if (!row) return null

    const steps = await this.store.getSteps(taskId)
    return {
      id: row.id as string,
      goal: safeJsonParse(row.goalJson as string, {} as AutonomousGoal),
      status: row.status as TaskStatus,
      steps: steps.map((s) => ({
        id: s.id as string,
        taskId: s.taskId as string,
        stepIndex: s.stepIndex as number,
        description: s.description as string,
        action: s.action as string,
        actionInput: safeJsonParse(s.actionInputJson as string, {}),
        classification: s.classification as ActionClassification,
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

  // Unit 8.11: expose store for TaskHistoryService
  getStore(): AutonomousExecutionStore {
    return this.store
  }

  async listTasks(opts?: { status?: string; limit?: number }): Promise<AutonomousTask[]> {
    const rows = await this.store.listTasks(opts)
    const tasks: AutonomousTask[] = []
    for (const row of rows) {
      const steps = await this.store.getSteps(row.id as string)
      tasks.push({
        id: row.id as string,
        goal: safeJsonParse(row.goalJson as string, {} as AutonomousGoal),
        status: row.status as TaskStatus,
        steps: steps.map((s) => ({
          id: s.id as string,
          taskId: s.taskId as string,
          stepIndex: s.stepIndex as number,
          description: s.description as string,
          action: s.action as string,
          actionInput: safeJsonParse(s.actionInputJson as string, {}),
          classification: s.classification as ActionClassification,
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
      })
    }
    return tasks
  }

  async resolveGate(gateId: string, response: string, resolvedBy: string): Promise<void> {
    const gateRow = await this.store.getGate(gateId)
    if (!gateRow) throw new EngineError(`Gate not found: ${gateId}`)
    if (gateRow.status !== 'pending') throw new EngineError(`Gate already resolved: ${gateId}`)

    const gateType = gateRow.gateType as GateType

    // Approval gates accept approve/deny/skip; clarification gates (question,
    // option, file, url) accept the human's free-form answer.
    const approvalResponses = ['approve', 'deny', 'skip']
    if (gateType === 'approval' && !approvalResponses.includes(response)) {
      throw new EngineError(`Invalid gate response: ${response}`)
    }

    const statusMap: Record<string, GateStatus> = {
      approve: 'approved',
      deny: 'denied',
      skip: 'skipped',
    }
    const gateStatus: GateStatus =
      gateType === 'approval' ? (statusMap[response] ?? 'denied') : 'resolved'

    await this.store.updateHitlGate(gateId, {
      status: gateStatus,
      resolvedBy,
      resolvedAt: Date.now(),
      response,
    })

    this.eventBus.emit({
      type: 'autonomous:gate_resolved',
      gateId,
      taskId: gateRow.taskId,
      response,
      resolvedBy,
    })

    // Notify any waiting goroutine
    const waiter = this.gateWaiters.get(gateId)
    if (waiter) {
      clearTimeout(waiter.timer)
      const gate: HitlGate = {
        id: gateId,
        taskId: gateRow.taskId as string,
        stepId: gateRow.stepId as string,
        gateType: gateRow.gateType as GateType,
        prompt: gateRow.prompt as string,
        options: safeJsonParse(gateRow.optionsJson as string, [] as string[]),
        defaultValue: gateRow.defaultValue as string | null,
        status: gateStatus,
        resolvedBy,
        resolvedAt: Date.now(),
        response,
        createdAt: gateRow.createdAt as number,
        expiresAt: gateRow.expiresAt as number | null,
      }
      waiter.resolve(gate)
      this.gateWaiters.delete(gateId)
    }
  }

  async getPendingGates(): Promise<HitlGate[]> {
    const rows = await this.store.getPendingGates()
    return rows.map((r) => ({
      id: r.id as string,
      taskId: r.taskId as string,
      stepId: r.stepId as string,
      gateType: r.gateType as GateType,
      prompt: r.prompt as string,
      options: safeJsonParse(r.optionsJson as string, [] as string[]),
      defaultValue: r.defaultValue as string | null,
      status: r.status as GateStatus,
      resolvedBy: r.resolvedBy as string | null,
      resolvedAt: r.resolvedAt as number | null,
      response: r.response as string | null,
      createdAt: r.createdAt as number,
      expiresAt: r.expiresAt as number | null,
    }))
  }

  // ── Proactive clarification (HITL v2) ──────────────────────────────────
  // Opens a mid-task clarification gate (open question / option select /
  // file picker / URL input) and resolves with the human response.

  async clarify(
    step: AutonomousStep,
    prompt: string,
    kind: GateType,
    opts?: { options?: string[]; defaultValue?: string; timeoutMs?: number },
  ): Promise<string | null> {
    const timeoutMs = opts?.timeoutMs ?? 300_000
    const gate: HitlGate = {
      id: newId(),
      taskId: step.taskId,
      stepId: step.id,
      gateType: kind,
      prompt,
      options: opts?.options ?? [],
      defaultValue: opts?.defaultValue ?? null,
      status: 'pending',
      resolvedBy: null,
      resolvedAt: null,
      response: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + timeoutMs,
    }

    await this.store.createHitlGate({
      id: gate.id,
      taskId: gate.taskId,
      stepId: gate.stepId,
      gateType: gate.gateType,
      prompt: gate.prompt,
      optionsJson: JSON.stringify(gate.options),
      defaultValue: gate.defaultValue,
      status: 'pending',
      createdAt: gate.createdAt,
      expiresAt: gate.expiresAt,
    })

    this.eventBus.emit({
      type: 'agent:clarify',
      gateId: gate.id,
      taskId: gate.taskId,
      stepId: gate.stepId,
      gateType: kind,
      prompt,
      options: gate.options,
    })

    const resolved = await this.waitForGateResolution(gate.id, timeoutMs)
    return resolved?.response ?? null
  }

  // Unit 8.5: Replay with branching — unified interface.
  // branch:false → re-execute the original task from fromStep (mutates it).
  // branch:true → clone prefix 0..fromStep into a new task, leave original untouched.
  // Returns the task id (original for in-place, new for branch).
  async replay(taskId: string, opts: ReplayOptions): Promise<string> {
    const original = this.activeTasks.get(taskId) ?? (await this.getStatus(taskId))
    if (!original) throw new EngineError(`No task ${taskId}`)

    if (!opts.branch) {
      // In-place re-execution from fromStep. Mark steps after fromStep as pending
      // so runTask picks them up.
      for (let i = opts.fromStep; i < original.steps.length; i++) {
        const s = original.steps[i]
        if (s && s.status !== 'complete' && s.status !== 'skipped') {
          s.status = 'pending'
          s.result = null
          s.error = null
          s.startedAt = null
          s.completedAt = null
          await this.store.updateStep(s.id, {
            status: 'pending',
            resultJson: null,
            error: null,
            startedAt: null,
            completedAt: null,
          })
        }
      }
      original.status = 'executing'
      original.completedAt = null
      original.result = null
      original.error = null
      await this.store.updateTask(taskId, {
        status: 'executing',
        completedAt: null,
        resultJson: null,
        error: null,
      })
      this.activeTasks.set(taskId, original)
      await this.runTask(original)
      return original.id
    }

    // Branch: clone prefix 0..fromStep, create new task, untouched original.
    const branchId = newId()
    const branchSteps: AutonomousStep[] = original.steps
      .slice(0, opts.fromStep + 1)
      .map((s, i) => ({
        ...s,
        id: newId(),
        taskId: branchId,
        stepIndex: i,
        status: s.status === 'complete' ? ('complete' as StepStatus) : ('pending' as StepStatus),
        result: s.status === 'complete' ? s.result : null,
        error: null,
        startedAt: s.status === 'complete' ? s.startedAt : null,
        completedAt: s.status === 'complete' ? s.completedAt : null,
      }))

    const branchTask: AutonomousTask = {
      id: branchId,
      goal: { ...original.goal },
      status: 'executing',
      steps: branchSteps,
      startedAt: Date.now(),
      completedAt: null,
      result: null,
      error: null,
    }

    await this.store.createTask({
      id: branchId,
      goalJson: JSON.stringify(branchTask.goal),
      status: 'running',
      startedAt: branchTask.startedAt,
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
        resultJson: step.result != null ? JSON.stringify(step.result) : null,
        requiresHumanApproval: step.requiresHumanApproval ? 1 : 0,
      })
    }

    this.activeTasks.set(branchId, branchTask)
    this.eventBus.emit({
      type: 'autonomous:branch_created',
      branchId,
      sourceTaskId: taskId,
      fromStep: opts.fromStep,
    })

    // Record provenance: branch → origin causal link
    if (this.provenance) {
      const traceId = `replay-branch:${branchId}`
      await this.provenance.record({
        traceId,
        parentId: original.steps[0]?.id ?? taskId,
        kind: 'replay-branch',
        engineId: 'autonomous-execution',
        label: `Branch from step ${opts.fromStep} of task ${taskId}`,
        metaJson: JSON.stringify({ sourceTaskId: taskId, fromStep: opts.fromStep }),
      })
    }

    // Continue execution from the step after fromStep
    await this.runTask(branchTask)
    return branchId
  }

  // Replay a finished task with branching (backward compat). Delegates to
  // ReplayController; the branch re-executes capability steps via the
  // capability registry, leaving the original timeline untouched.
  async replayBranch(
    taskId: string,
    opts?: {
      fromStep?: string
      overrideInput?: Record<string, unknown>
      overrideProvider?: string
    },
  ): Promise<ReplayResult> {
    const controller = new ReplayController(
      this.store,
      async (step, branchId) => {
        if (!this.registry) throw new EngineError('No registry bound for replay branch')
        return this.registry.execute(
          (step.actionInput.capabilitySlug as string) ?? step.action,
          (step.actionInput.input as Record<string, unknown>) ?? {},
          { metadata: { taskId: branchId, branch: true } },
        )
      },
      this.eventBus,
    )
    return controller.branch(taskId, opts)
  }

  // ── Private: Planning ────────────────────────────────────────────────
  // planGoal delegates to the IntentDecomposer (nlcl resolver): each resolved
  // CapabilityNode becomes an AutonomousStep whose `action` is the capability
  // slug, carrying its inputMapping + classification. No regex action parsing.

  private async planGoal(goal: AutonomousGoal): Promise<AutonomousStep[]> {
    // Unit 36.2: enforce offline-first planning consent before any work begins.
    // resolvePlanner throws ConsentViolationError for a cloud llmProvider when
    // the user has not consented; airgap/local goals are always allowed.
    const consented = await this.consentCheck()
    resolvePlanner(goal, { airgap: this.airgap, consented })
    // LLM-backed planning when a resolver is injected (Unit 34.1).
    if (this.resolver) {
      const ctx: NLCContext = { surface: 'cli', metadata: {} }
      const intent = await this.resolver.resolve(goal.description, ctx)
      return planStepsFromIntent(goal, intent)
    }
    // Offline built-in planner: always `local` (no outbound model). Used when no
    // resolver is wired (e.g. unit tests, airgap-default instances).
    return planStepsLocally(goal)
  }

  // ── Private: Execution ───────────────────────────────────────────────

  private async executeStepWithHealing(
    step: AutonomousStep,
    task: AutonomousTask,
  ): Promise<unknown> {
    try {
      return await this.executeStep(step, task)
    } catch (err) {
      if (this.isSelectorError(err) && step.actionInput.selector) {
        const healed = await this.healSelector(step.actionInput.selector as string, task)
        if (healed) {
          step.actionInput.selector = healed
          return await this.executeStep(step, task)
        }
      }
      throw err
    }
  }

  // Unit 8.9: composite step execution. When a step's action starts with
  // 'composite:', resolve the composite via CapabilityComposer and execute
  // each inner node as a sub-step with parentStepId set.
  private async executeStepWithComposite(
    step: AutonomousStep,
    task: AutonomousTask,
  ): Promise<unknown> {
    if (!step.action.startsWith('composite:') || !this.composer) {
      return this.executeStepWithFailover(step, task)
    }

    const compositeSlug = step.action.slice('composite:'.length)
    step.isCompositeRoot = true
    const composite = await this.composer.get(compositeSlug)
    if (!composite) {
      throw new EngineError(`Composite not found: ${compositeSlug}`)
    }

    const subSteps: AutonomousStep[] = []

    for (const node of composite.nodes) {
      const subStep: AutonomousStep = {
        id: newId(),
        taskId: task.id,
        stepIndex: task.steps.length,
        description: `Sub-step: ${node.capabilitySlug}`,
        action: 'capability_call',
        actionInput: {
          ...node.inputMapping,
          capabilitySlug: node.capabilitySlug,
          classification: 'read',
        },
        classification: 'read',
        status: 'pending',
        result: null,
        error: null,
        startedAt: null,
        completedAt: null,
        requiresHumanApproval: false,
        parentStepId: step.id,
        isCompositeRoot: false,
      }
      subSteps.push(subStep)
      task.steps.push(subStep)

      subStep.status = 'running'
      subStep.startedAt = Date.now()
      await this.store.createStep(subStep as unknown as Record<string, unknown>)
      await this.store.updateStep(subStep.id, { status: 'running', startedAt: subStep.startedAt })

      try {
        const result = await this.executeStepWithFailover(subStep, task)
        subStep.result = result
        subStep.status = 'complete'
        subStep.completedAt = Date.now()
        await this.store.updateStep(subStep.id, {
          status: 'complete',
          resultJson: JSON.stringify(result),
          completedAt: subStep.completedAt,
        })
      } catch (err) {
        subStep.status = 'failed'
        subStep.error = err instanceof Error ? err.message : String(err)
        subStep.completedAt = Date.now()
        await this.store.updateStep(subStep.id, {
          status: 'failed',
          error: subStep.error,
          completedAt: subStep.completedAt,
        })
        throw err
      }
    }

    return subSteps.map((s) => ({ step: s.description, result: s.result }))
  }

  // Unit 34.5: provider failover. Attempts the step (with selector healing);
  // on failure, consults the failover router for fallback providers, opens an
  // `option` clarification gate, and on approval re-executes against the chosen
  // fallback with adapted input. With no fallback, the original error propagates.
  private async executeStepWithFailover(
    step: AutonomousStep,
    task: AutonomousTask,
  ): Promise<unknown> {
    const attempted = (step.actionInput.provider as string) ?? 'default'
    try {
      return await this.executeStepWithHealing(step, task)
    } catch (err) {
      catchDebug(err, 'engines:autonomous-execution:1114')
      const fallbacks = this.failoverRouter ? await this.failoverRouter.fallbacksFor(attempted) : []
      if (fallbacks.length === 0) throw err

      const choice = await this.clarify(
        step,
        `Provider "${attempted}" failed mid-task. Choose a fallback provider to continue.`,
        'option',
        { options: fallbacks },
      )
      if (!choice || !fallbacks.includes(choice)) throw err

      step.actionInput = this.adaptInputForProvider(step.actionInput, choice)
      this.eventBus.emit({
        type: 'autonomous:failover',
        taskId: task.id,
        fromProvider: attempted,
        toProvider: choice,
        stepId: step.id,
      })
      return await this.executeStepWithHealing(step, task)
    }
  }

  private adaptInputForProvider(
    input: Record<string, unknown>,
    provider: string,
  ): Record<string, unknown> {
    return { ...input, provider }
  }

  private async executeStep(step: AutonomousStep, task: AutonomousTask): Promise<unknown> {
    switch (step.action) {
      case 'navigate': {
        const slave = await this.governor.ensureRunning('default')
        await this.governor.cdp.send(slave.slaveId, 'Page.navigate', {
          url: step.actionInput.url,
        })
        await this.waitForPageLoad(slave.slaveId)
        return { navigated: true, url: step.actionInput.url }
      }

      case 'click': {
        const slave = await this.governor.ensureRunning('default')
        await this.governor.cdp.send(slave.slaveId, 'Runtime.evaluate', {
          expression: `document.querySelector('${step.actionInput.target}')?.click()`,
        })
        return { clicked: true, target: step.actionInput.target }
      }

      case 'fill_form': {
        const slave = await this.governor.ensureRunning('default')
        return { filled: true, slaveId: slave.slaveId }
      }

      case 'search': {
        const slave = await this.governor.ensureRunning('default')
        await this.governor.cdp.send(slave.slaveId, 'Runtime.evaluate', {
          expression: `document.querySelector('input[type="search"], input[name="q"]')?.value = '${step.actionInput.query}'`,
        })
        await this.governor.cdp.send(slave.slaveId, 'Runtime.evaluate', {
          expression: `document.querySelector('form')?.submit()`,
        })
        await this.waitForPageLoad(slave.slaveId)
        return { searched: true, query: step.actionInput.query }
      }

      case 'screenshot': {
        const slave = await this.governor.ensureRunning('default')
        const screenshot = await this.governor.cdp.captureScreenshot(slave.slaveId)
        return { screenshot }
      }

      // Unit 8.12: canvas spawn — delegates to canvas_spawn capability via registry
      case 'canvas_spawn': {
        const result = await this.registry.execute(
          'canvas_spawn',
          { definitionId: step.actionInput.definitionId ?? step.actionInput.title ?? 'default' },
          { metadata: { taskId: task.id } },
        )
        const instanceId = (result as Record<string, unknown>)?.instanceId as string
        if (instanceId) {
          this.canvasByTask.set(task.id, instanceId)
        }
        return result
      }

      // Unit 8.12: canvas mutate — delegates to canvas_mutate capability via registry
      case 'canvas_mutate': {
        const canvasId = this.canvasByTask.get(task.id)
        if (!canvasId) {
          throw new EngineError('canvas_mutate called with no spawned canvas for this task')
        }
        const result = await this.registry.execute(
          'canvas_mutate',
          {
            instanceId: canvasId,
            regionId: step.actionInput.regionId ?? 'body',
            state: step.actionInput.state ?? step.actionInput.js,
          },
          { metadata: { taskId: task.id } },
        )
        return result
      }

      case 'capability_call': {
        const result = await this.registry.execute(
          step.actionInput.capabilitySlug as string,
          step.actionInput.input as Record<string, unknown>,
          { metadata: { taskId: task.id } },
        )
        return result
      }

      default:
        throw new EngineError(`Unknown action: ${step.action}`)
    }
  }

  private isSelectorError(err: unknown): boolean {
    if (err instanceof Error) {
      return err.message.includes('selector') || err.message.includes('querySelector')
    }
    return false
  }

  private async healSelector(failedSelector: string, task: AutonomousTask): Promise<string | null> {
    try {
      const slave = await this.governor.ensureRunning('default')
      const transport = this.governor.getTransport()
      if (!transport) return null

      // Prefer injected healer (testable, no dynamic import overhead).
      // Fall back to dynamic import for lazy loading when not injected.
      let healer: SelectorHealer
      if (this.injectedHealer) {
        healer = this.injectedHealer
      } else {
        const { SelectorHealer } = await import('./selector-healer.js')
        const { SemanticGroundingEngine } = await import('./semantic-grounding.js')
        const grounding = new SemanticGroundingEngine(transport)
        healer = new SelectorHealer(grounding)
      }

      const result = await healer.heal({
        slaveId: slave.slaveId,
        failedSelector: { type: 'css', selector: failedSelector },
        capabilityId: task.goal.description,
        providerId: 'autonomous',
        context: `Autonomous task: ${task.goal.description}`,
      })
      if (result?.healed.type === 'css') return result.healed.selector
      return null
    } catch {
      return null
    }
  }

  private async waitForPageLoad(slaveId: string, timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const state = await this.governor.cdp.getPageState(slaveId)
        if (state?.readyState === 'complete') return
      } catch (err) {
        catchDebug(err, 'engines:autonomous-execution:1278')
        // ignore
      }
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  // ── Private: HITL Gates ─────────────────────────────────────────────

  private async createGate(
    taskId: string,
    step: AutonomousStep,
    decision: PolicyDecision,
  ): Promise<HitlGate> {
    const gate: HitlGate = {
      id: newId(),
      taskId,
      stepId: step.id,
      gateType: 'approval',
      prompt: `Step "${step.description}" requires approval.\nAction: ${step.action}\nClassification: ${decision.classification}\nReason: ${decision.reason}`,
      options: ['approve', 'deny', 'skip'],
      defaultValue: 'deny',
      status: 'pending',
      resolvedBy: null,
      resolvedAt: null,
      response: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + 300_000,
    }

    await this.store.createHitlGate({
      id: gate.id,
      taskId,
      stepId: step.id,
      gateType: gate.gateType,
      prompt: gate.prompt,
      optionsJson: JSON.stringify(gate.options),
      defaultValue: gate.defaultValue,
      status: 'pending',
      createdAt: gate.createdAt,
      expiresAt: gate.expiresAt,
    })

    return gate
  }

  private waitForGateResolution(gateId: string, timeoutMs: number): Promise<HitlGate | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.gateWaiters.delete(gateId)
        await this.store.updateHitlGate(gateId, { status: 'expired' })
        resolve(null)
      }, timeoutMs)

      this.gateWaiters.set(gateId, { resolve, timer })

      // Also poll in case resolveGate was called before we registered
      this.store
        .getGate(gateId)
        .then((gate) => {
          if (gate && gate.status !== 'pending') {
            clearTimeout(timer)
            this.gateWaiters.delete(gateId)
            resolve({
              id: gateId,
              taskId: gate.taskId as string,
              stepId: gate.stepId as string,
              gateType: gate.gateType as GateType,
              prompt: gate.prompt as string,
              options: safeJsonParse(gate.optionsJson as string, [] as string[]),
              defaultValue: gate.defaultValue as string | null,
              status: gate.status as GateStatus,
              resolvedBy: gate.resolvedBy as string | null,
              resolvedAt: gate.resolvedAt as number | null,
              response: gate.response as string | null,
              createdAt: gate.createdAt as number,
              expiresAt: gate.expiresAt as number | null,
            })
          }
        })
        .catch(() => {
  // [audit] log the error with context here
          /* poll failure — timer fallback handles it */
        })
    })
  }
}
