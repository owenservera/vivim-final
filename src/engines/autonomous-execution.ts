// src/engines/autonomous-execution.ts
// AutonomousExecutionEngine — multi-step autonomous task executor with HITL gates

import { ConsentViolationError, EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type { AutonomousExecutionStore } from '../storage/contracts/autonomous-store.js'
import { ReplayController } from './autonomous-replay.js'
import type { ReplayResult } from './autonomous-replay.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { ExecutionPolicyEngine, PolicyDecision } from './execution-policy.js'
import type { IntentResolver, NLCContext, ParsedIntent } from './nlcl/types.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types ───────────────────────────────────────────────────────────────

// Unit 34.5: provider failover. Implemented by ProviderMuxEngine.fallbacksFor.
export interface FailoverRouter {
  fallbacksFor(providerId: string): Promise<string[]>
}

export type TaskStatus =
  | 'pending'
  | 'planning'
  | 'executing'
  | 'waiting_approval'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'cancelled'
export type StepStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped' | 'waiting_human'
export type ActionClassification =
  | 'read'
  | 'write'
  | 'navigate'
  | 'destructive'
  | 'financial'
  | 'communication'
export type GateType =
  | 'approval'
  | 'confirmation'
  | 'selection'
  | 'input'
  | 'question'
  | 'option'
  | 'file'
  | 'url'
export type GateStatus = 'pending' | 'approved' | 'denied' | 'skipped' | 'resolved' | 'expired'

export interface AutonomousGoal {
  description: string
  maxSteps: number
  maxDurationMs: number
  requireApprovalAbove: ActionClassification
  allowBrowser: boolean
  costBudgetCents: number
  // Unit 8.6: per-task budgets — exceeding any transitions task to paused
  tokenBudget: number
  iterationBudget: number
  // Unit 36.2: explicit LLM provider for planning. 'local' (or unset) →
  // LocalModelAdapter (offline). Any other value is an outbound/cloud model
  // and is only honored when the user has consented (see resolvePlanner).
  llmProvider?: string
}

// Unit 8.6: tracks per-task consumption across cost/tokens/iterations
export interface BudgetUsage {
  costCents: number
  tokens: number
  iterations: number
}

export interface AutonomousStep {
  id: string
  taskId: string
  stepIndex: number
  description: string
  action: string
  actionInput: Record<string, unknown>
  classification: ActionClassification
  status: StepStatus
  result: unknown
  error: string | null
  startedAt: number | null
  completedAt: number | null
  requiresHumanApproval: boolean
}

export interface HitlGate {
  id: string
  taskId: string
  stepId: string
  gateType: GateType
  prompt: string
  options: string[]
  defaultValue: string | null
  status: GateStatus
  resolvedBy: string | null
  resolvedAt: number | null
  response: string | null
  createdAt: number
  expiresAt: number | null
}

export interface AutonomousTask {
  id: string
  goal: AutonomousGoal
  status: TaskStatus
  steps: AutonomousStep[]
  startedAt: number
  completedAt: number | null
  result: unknown
  error: string | null
}

// ── Classification priority (lower = more restrictive) ──────────────────

const CLASSIFICATION_PRIORITY: Record<ActionClassification, number> = {
  read: 0,
  navigate: 1,
  communication: 2,
  write: 3,
  destructive: 4,
  financial: 5,
}

function classificationAtLeast(
  classification: ActionClassification,
  threshold: ActionClassification,
): boolean {
  return (CLASSIFICATION_PRIORITY[classification] ?? 0) >= (CLASSIFICATION_PRIORITY[threshold] ?? 0)
}

// The nlcl resolver uses a superset classification ('system' extra); map it
// onto the autonomous engine's classification space.
function toAutonomousClassification(c: string): ActionClassification {
  return c === 'system' ? 'read' : (c as ActionClassification)
}

// ── Engine ──────────────────────────────────────────────────────────────

export class AutonomousExecutionEngine {
  private activeTasks = new Map<string, AutonomousTask>()
  private gateWaiters = new Map<
    string,
    { resolve: (gate: HitlGate) => void; timer: ReturnType<typeof setTimeout> }
  >()

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
  ) {}

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

        step.status = 'running'
        step.startedAt = Date.now()
        await this.store.updateStep(step.id, { status: 'running', startedAt: step.startedAt })

        try {
          const result = await this.executeStepWithFailover(step, task)
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

          if (step.classification === 'destructive' || step.classification === 'financial') {
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
      task.status = 'failed'
      task.error = err instanceof Error ? err.message : String(err)
      task.completedAt = Date.now()
      await this.store.updateTask(taskId, {
        status: 'failed',
        error: task.error,
        completedAt: task.completedAt,
      })
    } finally {
      this.activeTasks.delete(taskId)
    }

    return task
  }

  async pause(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId) ?? (await this.getStatus(taskId))
    if (!task) return
    task.status = 'paused'
    await this.store.updateTask(taskId, { status: 'paused' })
    this.eventBus.emit({ type: 'autonomous:paused', taskId })
  }

  async resume(taskId: string): Promise<AutonomousTask | null> {
    const task = this.activeTasks.get(taskId) ?? (await this.getStatus(taskId))
    if (!task) return null
    if ((task.status as string) !== 'paused') return task
    this.activeTasks.set(taskId, task)
    return this.runTask(task)
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
      goal: JSON.parse(row.goalJson as string),
      status: row.status as TaskStatus,
      steps: steps.map((s) => ({
        id: s.id as string,
        taskId: s.taskId as string,
        stepIndex: s.stepIndex as number,
        description: s.description as string,
        action: s.action as string,
        actionInput: JSON.parse(s.actionInputJson as string),
        classification: s.classification as ActionClassification,
        status: s.status as StepStatus,
        result: s.resultJson ? JSON.parse(s.resultJson as string) : null,
        error: s.error as string | null,
        startedAt: s.startedAt as number | null,
        completedAt: s.completedAt as number | null,
        requiresHumanApproval: (s.requiresHumanApproval as number) === 1,
      })),
      startedAt: row.startedAt as number,
      completedAt: row.completedAt as number | null,
      result: row.resultJson ? JSON.parse(row.resultJson as string) : null,
      error: row.error as string | null,
    }
  }

  async listTasks(opts?: { status?: string; limit?: number }): Promise<AutonomousTask[]> {
    const rows = await this.store.listTasks(opts)
    const tasks: AutonomousTask[] = []
    for (const row of rows) {
      const steps = await this.store.getSteps(row.id as string)
      tasks.push({
        id: row.id as string,
        goal: JSON.parse(row.goalJson as string),
        status: row.status as TaskStatus,
        steps: steps.map((s) => ({
          id: s.id as string,
          taskId: s.taskId as string,
          stepIndex: s.stepIndex as number,
          description: s.description as string,
          action: s.action as string,
          actionInput: JSON.parse(s.actionInputJson as string),
          classification: s.classification as ActionClassification,
          status: s.status as StepStatus,
          result: s.resultJson ? JSON.parse(s.resultJson as string) : null,
          error: s.error as string | null,
          startedAt: s.startedAt as number | null,
          completedAt: s.completedAt as number | null,
          requiresHumanApproval: (s.requiresHumanApproval as number) === 1,
        })),
        startedAt: row.startedAt as number,
        completedAt: row.completedAt as number | null,
        result: row.resultJson ? JSON.parse(row.resultJson as string) : null,
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
        options: JSON.parse(gateRow.optionsJson as string),
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
      options: JSON.parse(r.optionsJson as string),
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

  async replay(taskId: string, fromStep?: string): Promise<AutonomousTask> {
    const prev = await this.getStatus(taskId)
    if (!prev) throw new EngineError(`Task not found: ${taskId}`)

    const newTask = await this.execute(prev.goal)

    if (fromStep) {
      const skipIdx = prev.steps.findIndex((s) => s.id === fromStep)
      if (skipIdx > 0) {
        for (let i = 0; i < skipIdx; i++) {
          const oldStep = prev.steps[i]
          const newStep = newTask.steps[i]
          if (oldStep?.status === 'complete' && newStep) {
            newStep.result = oldStep.result
            newStep.status = 'complete'
            await this.store.updateStep(newStep.id, {
              status: 'complete',
              resultJson: JSON.stringify(oldStep.result),
            })
          }
        }
      }
    }

    return newTask
  }

  // Replay a finished task with branching (Unit 34.4). Delegates to
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
      const { SelectorHealer } = await import('./selector-healer.js')
      const { SemanticGroundingEngine } = await import('./semantic-grounding.js')
      // Create a minimal CDP transport proxy for selector healing
      const slave = await this.governor.ensureRunning('default')
      const transport = this.governor.getTransport()
      if (!transport) return null
      const grounding = new SemanticGroundingEngine(transport)
      const healer = new SelectorHealer(grounding)
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
      } catch {
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
      this.store.getGate(gateId).then((gate) => {
        if (gate && gate.status !== 'pending') {
          clearTimeout(timer)
          this.gateWaiters.delete(gateId)
          resolve({
            id: gateId,
            taskId: gate.taskId as string,
            stepId: gate.stepId as string,
            gateType: gate.gateType as GateType,
            prompt: gate.prompt as string,
            options: JSON.parse(gate.optionsJson as string),
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
    })
  }
}

// ── Pure planner helpers (exported for unit tests) ───────────────────────

// Build an AutonomousStep from a resolved intent node.
function assembleStep(
  index: number,
  goal: AutonomousGoal,
  description: string,
  action: string,
  input: Record<string, unknown>,
): AutonomousStep {
  const classification = toAutonomousClassification((input.classification as string) ?? 'read')
  return {
    id: newId(),
    taskId: '',
    stepIndex: index,
    description,
    action,
    actionInput: input,
    classification,
    status: 'pending',
    result: null,
    error: null,
    startedAt: null,
    completedAt: null,
    requiresHumanApproval: classificationAtLeast(classification, goal.requireApprovalAbove),
  }
}

// Unit 36.2: resolves which LLM provider the planner should use for a goal.
// - no override (or 'local') → LocalModelAdapter (offline, always allowed)
// - any other provider is an outbound/cloud model and is only honored when the
//   user has consented; otherwise a ConsentViolationError is raised.
export interface PlannerResolution {
  provider: string
  local: boolean
}

export function resolvePlanner(
  goal: AutonomousGoal,
  opts: { airgap: boolean; consented: boolean },
): PlannerResolution {
  const override = goal.llmProvider
  if (!override || override === 'local') {
    return { provider: 'local', local: true }
  }
  if (!opts.consented) {
    throw new ConsentViolationError(override)
  }
  return { provider: override, local: false }
}

// Maps a resolved intent (CapabilityDAG root + alternatives) into
// AutonomousSteps. Empty/null intent → 0 steps.
export function planStepsFromIntent(
  goal: AutonomousGoal,
  intent: ParsedIntent | null,
): AutonomousStep[] {
  if (!intent || !intent.capabilityId) return []
  const nodes: ParsedIntent[] = [intent, ...(intent.alternatives ?? [])]
  const steps: AutonomousStep[] = []
  for (const node of nodes) {
    if (!node.capabilityId) continue
    const classification = toAutonomousClassification(node.classification ?? 'read')
    steps.push(
      assembleStep(steps.length, goal, node.intent || goal.description, node.capabilityId, {
        ...node.input,
        inputMapping: node.input,
        classification,
      }),
    )
  }
  if (steps.length > goal.maxSteps) return steps.slice(0, goal.maxSteps)
  return steps
}

// Built-in offline planner used when no LLM resolver is injected. Always runs
// locally (no outbound model): it parses the goal description for browser /
// destructive / read keywords into concrete AutonomousSteps the engine can
// execute directly via the governor or capability registry.
export function planStepsLocally(goal: AutonomousGoal): AutonomousStep[] {
  const text = goal.description.toLowerCase()
  const steps: AutonomousStep[] = []
  const add = (
    action: string,
    classification: ActionClassification,
    extra: Record<string, unknown> = {},
  ) => {
    if (steps.length >= goal.maxSteps) return
    steps.push(
      assembleStep(steps.length, goal, goal.description, action, { ...extra, classification }),
    )
  }

  const urlMatch = goal.description.match(/https?:\/\/[^\s]+|(?:\b[a-z0-9-]+\.)+[a-z]{2,}\b/i)
  const url = urlMatch ? (urlMatch[0] as string) : undefined
  if (url) add('navigate', 'navigate', { url })
  if (/\bscreenshot\b/.test(text)) add('screenshot', 'read')
  if (/\b(delete|remove|permanent|drop|truncate|wipe)\b/.test(text))
    add('destructive', 'destructive')
  if (/\b(summar|summarize)\b/.test(text)) add('summarize', 'read')
  if (/\b(search|find)\b/.test(text) && !url) add('search', 'read', { query: goal.description })
  if (steps.length === 0) add('task', 'read')
  return steps
}
