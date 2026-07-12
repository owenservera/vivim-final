// src/engines/autonomous-execution.ts
// AutonomousExecutionEngine — multi-step autonomous task executor with HITL gates

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type { AutonomousExecutionStore } from '../storage/contracts/autonomous-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { ExecutionPolicyEngine, PolicyDecision } from './execution-policy.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types ───────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'pending'
  | 'planning'
  | 'executing'
  | 'waiting_approval'
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
export type GateType = 'approval' | 'confirmation' | 'selection' | 'input'
export type GateStatus = 'pending' | 'approved' | 'denied' | 'skipped' | 'expired'

export interface AutonomousGoal {
  description: string
  maxSteps: number
  maxDurationMs: number
  requireApprovalAbove: ActionClassification
  allowBrowser: boolean
  costBudgetCents: number
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

      task.status = 'executing'
      await this.store.updateTask(taskId, { status: 'executing' })

      for (const step of task.steps) {
        if ((task.status as string) === 'cancelled') break

        const decision = await this.policyEngine.evaluate(step.action, step.actionInput)
        step.requiresHumanApproval =
          decision.requiresApproval ||
          classificationAtLeast(step.classification, goal.requireApprovalAbove)

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
          const result = await this.executeStepWithHealing(step, task)
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

      if ((task.status as string) !== 'failed' && (task.status as string) !== 'cancelled') {
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

      this.eventBus.emit({
        type: 'autonomous:complete',
        taskId,
        status: task.status,
        stepsCompleted: task.steps.filter((s) => s.status === 'complete').length,
        stepsTotal: task.steps.length,
      })
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

    const validResponses = ['approve', 'deny', 'skip']
    if (!validResponses.includes(response)) {
      throw new EngineError(`Invalid gate response: ${response}`)
    }

    const statusMap: Record<string, GateStatus> = {
      approve: 'approved',
      deny: 'denied',
      skip: 'skipped',
    }
    const gateStatus = statusMap[response] ?? 'denied'

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

  // ── Private: Planning ────────────────────────────────────────────────

  private async planGoal(goal: AutonomousGoal): Promise<AutonomousStep[]> {
    const steps: AutonomousStep[] = []
    const lower = goal.description.toLowerCase()

    const navMatch = lower.match(/(?:go to|navigate to|open)\s+(.+)/)
    if (navMatch) {
      steps.push(
        this.makeStep(steps.length, goal, `Navigate to ${navMatch[1]}`, 'navigate', {
          url: navMatch[1],
        }),
      )
    }

    const searchMatch = lower.match(/(?:search|find|look for)\s+(.+)/)
    if (searchMatch) {
      steps.push(
        this.makeStep(steps.length, goal, `Search for ${searchMatch[1]}`, 'search', {
          query: searchMatch[1],
        }),
      )
    }

    if (lower.includes('fill') || lower.includes('form')) {
      steps.push(this.makeStep(steps.length, goal, 'Fill form fields', 'fill_form', {}))
    }

    const clickMatch = lower.match(/click\s+(?:on\s+)?(?:the\s+)?(.+)/)
    if (clickMatch) {
      steps.push(
        this.makeStep(steps.length, goal, `Click ${clickMatch[1]}`, 'click', {
          target: clickMatch[1],
        }),
      )
    }

    if (lower.includes('screenshot') || lower.includes('capture')) {
      steps.push(this.makeStep(steps.length, goal, 'Take screenshot', 'screenshot', {}))
    }

    if (steps.length === 0) {
      steps.push(
        this.makeStep(0, goal, `Execute goal: ${goal.description}`, 'llm_plan', {
          goal: goal.description,
        }),
      )
    }

    // Enforce maxSteps limit
    if (steps.length > goal.maxSteps) {
      return steps.slice(0, goal.maxSteps)
    }

    return steps
  }

  private makeStep(
    index: number,
    goal: AutonomousGoal,
    description: string,
    action: string,
    input: Record<string, unknown>,
  ): AutonomousStep {
    const classification = (input.classification as ActionClassification) ?? 'read'
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
