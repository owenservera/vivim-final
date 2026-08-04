# 08 — Autonomous Execution: Enhanced Harness, Workflow DAGs, Self-Healing, HITL

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Objective:** 6 (The Autonomous Execution Engine)

---

## Current State Analysis

The system has several autonomous execution components, but most are stubs:

| Component | File | Status |
|-----------|------|--------|
| AgenticLoopEngine | agentic-loop.ts (98 lines) | Loop body is stub ("Stub for v1") |
| WorkflowEngine | workflow-engine.ts (361 lines) | Functional but limited node types |
| ChromeGovernor CDP | chrome-governor.ts:630-658 | Stub (throws "implement in Phase 9") |
| HarnessRuntime | harness-runtime.ts (222 lines) | Context methods return null/empty |
| SelectorHealer | selector-healer.ts (316 lines) | 5 strategies implemented |
| SemanticGrounding | semantic-grounding.ts (512 lines) | Implemented (CSS, ARIA, text, visual) |

**Key blocker:** ChromeGovernor CDP is a stub. No autonomous execution can happen until real CDP transport is wired.

---

## Upgrade Design

### Phase 14 Prerequisites (Must Complete First)

Before autonomous execution can work, Phase 14 must wire:
1. `CDPTransportImpl` — wraps `BunCdpClient` into `CDPTransport` interface
2. ChromeGovernor uses real CDP transport (not `stubCdp`)
3. HarnessRuntime has real DOM/network/screenshot context
4. ChromeGovernor trace and health methods are real

### AutonomousExecutionEngine

The central orchestrator for multi-step autonomous tasks.

```typescript
export class AutonomousExecutionEngine {
  private activeTasks = new Map<string, AutonomousTask>()

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

    await this.store.createTask(task)
    this.activeTasks.set(taskId, task)

    this.eventBus.emit({
      type: 'autonomous:started',
      taskId,
      goal: goal.description,
    } as never)

    try {
      // Phase 1: PLAN — decompose goal into steps
      const plan = await this.planGoal(goal)
      task.steps = plan

      for (const step of plan) {
        step.status = 'pending'
        await this.store.createStep(step)
      }

      task.status = 'executing'
      await this.store.updateTask(taskId, { status: 'executing' })

      // Phase 2: EXECUTE — run each step
      for (const step of task.steps) {
        if (task.status === 'cancelled') break

        // Check if step requires approval
        const decision = await this.policyEngine.evaluate(step.action, step.actionInput)
        step.requiresHumanApproval = decision.requiresApproval

        if (decision.requiresApproval) {
          // Create HITL gate
          const gate = await this.createGate(taskId, step, decision)
          task.status = 'waiting_approval'
          await this.store.updateTask(taskId, { status: 'waiting_approval' })

          this.eventBus.emit({
            type: 'autonomous:gate_created',
            taskId,
            gateId: gate.id,
            prompt: gate.prompt,
          } as never)

          // Wait for resolution (with timeout)
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

        // Execute the step
        step.status = 'running'
        step.startedAt = Date.now()
        await this.store.updateStep(step.id, { status: 'running', startedAt: step.startedAt })

        try {
          const result = await this.executeStep(step, task)
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
          } as never)

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
          } as never)

          // Check if we should continue or abort
          if (step.classification === 'destructive' || step.classification === 'financial') {
            task.status = 'failed'
            task.error = `Critical step failed: ${step.error}`
            break
          }
          // Non-critical failure — continue to next step
        }
      }

      // Phase 3: FINALIZE
      if (task.status !== 'failed' && task.status !== 'cancelled') {
        task.status = 'complete'
        task.result = task.steps.map(s => ({ step: s.description, result: s.result }))
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
        stepsCompleted: task.steps.filter(s => s.status === 'complete').length,
        stepsTotal: task.steps.length,
      } as never)

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

  private async planGoal(goal: AutonomousGoal): Promise<AutonomousStep[]> {
    // Simple rule-based planner (v1)
    // For complex goals, use LLM to decompose

    const steps: AutonomousStep[] = []
    const lowerGoal = goal.description.toLowerCase()

    // Pattern: "navigate to X and do Y"
    const navMatch = lowerGoal.match(/(?:go to|navigate to|open)\s+(.+)/)
    if (navMatch) {
      const url = navMatch[1]
      steps.push(this.createStep(0, `Navigate to ${url}`, 'navigate', {
        url,
        classification: 'navigate',
      }))
    }

    // Pattern: "search for X"
    const searchMatch = lowerGoal.match(/(?:search|find|look for)\s+(.+)/)
    if (searchMatch) {
      const query = searchMatch[1]
      steps.push(this.createStep(steps.length, `Search for ${query}`, 'search', {
        query,
        classification: 'read',
      }))
    }

    // Pattern: "fill in the form"
    if (lowerGoal.includes('fill') || lowerGoal.includes('form')) {
      steps.push(this.createStep(steps.length, 'Fill form fields', 'fill_form', {
        classification: 'write',
      }))
    }

    // Pattern: "click X"
    const clickMatch = lowerGoal.match(/click\s+(?:on\s+)?(?:the\s+)?(.+)/)
    if (clickMatch) {
      const target = clickMatch[1]
      steps.push(this.createStep(steps.length, `Click ${target}`, 'click', {
        target,
        classification: 'write',
      }))
    }

    // Pattern: "screenshot"
    if (lowerGoal.includes('screenshot') || lowerGoal.includes('capture')) {
      steps.push(this.createStep(steps.length, 'Take screenshot', 'screenshot', {
        classification: 'read',
      }))
    }

    // If no patterns matched, create a single LLM-planned step
    if (steps.length === 0) {
      steps.push(this.createStep(0, `Execute goal: ${goal.description}`, 'llm_plan', {
        goal: goal.description,
        classification: 'write', // Conservative default
      }))
    }

    return steps
  }

  private async executeStep(
    step: AutonomousStep,
    task: AutonomousTask,
  ): Promise<unknown> {
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
        // Implementation depends on form structure
        return { filled: true }
      }

      case 'search': {
        const slave = await this.governor.ensureRunning('default')
        // Type into search field and submit
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

      case 'llm_plan': {
        // Use LLM to determine action
        const result = await this.llmPlan(task.goal.description, step.actionInput)
        return result
      }

      case 'capability_call': {
        const result = await this.registry.execute(
          step.actionInput.capabilitySlug,
          step.actionInput.input,
          { metadata: { taskId: task.id } },
        )
        return result
      }

      default:
        throw new EngineError(`Unknown action: ${step.action}`)
    }
  }

  private async waitForPageLoad(slaveId: string, timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const state = await this.governor.cdp.getPageState(slaveId)
      if (state?.readyState === 'complete') return
      await new Promise(r => setTimeout(r, 200))
    }
  }
}
```

### HITL Gate System

```typescript
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
    defaultValue: 'deny', // Conservative default
    status: 'pending',
    resolvedBy: null,
    resolvedAt: null,
    response: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + 300_000, // 5 minute expiry
  }

  await this.store.createHitlGate(gate)
  return gate
}

async resolveGate(
  gateId: string,
  response: string,
  resolvedBy: string,
): Promise<void> {
  const gate = await this.store.getGate(gateId)
  if (!gate) throw new EngineError(`Gate not found: ${gateId}`)
  if (gate.status !== 'pending') throw new EngineError(`Gate already resolved: ${gateId}`)

  const validResponses = ['approve', 'deny', 'skip']
  if (!validResponses.includes(response)) {
    throw new EngineError(`Invalid gate response: ${response}`)
  }

  await this.store.updateHitlGate(gateId, {
    status: response as 'approved' | 'denied' | 'skipped',
    resolvedBy,
    resolvedAt: Date.now(),
    response,
  })

  this.eventBus.emit({
    type: 'autonomous:gate_resolved',
    gateId,
    taskId: gate.taskId,
    response,
    resolvedBy,
  } as never)
}

private async waitForGateResolution(
  gateId: string,
  timeoutMs: number,
): Promise<HitlGate | null> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const gate = await this.store.getGate(gateId)
    if (gate && gate.status !== 'pending') return gate
    await new Promise(r => setTimeout(r, 500))
  }

  // Expired
  await this.store.updateHitlGate(gateId, { status: 'expired' })
  return null
}
```

### Self-Healing Pipeline

When a selector breaks during autonomous execution, the `SelectorHealer` kicks in:

```typescript
// In executeStep(), catch selector errors and attempt healing
private async executeStepWithHealing(
  step: AutonomousStep,
  task: AutonomousTask,
): Promise<unknown> {
  try {
    return await this.executeStep(step, task)
  } catch (err) {
    if (this.isSelectorError(err)) {
      // Attempt healing
      const healed = await this.healSelector(step.actionInput.selector, task)

      if (healed) {
        // Retry with healed selector
        step.actionInput.selector = healed.healed
        return await this.executeStep(step, task)
      }
    }
    throw err
  }
}

private isSelectorError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('selector') || err.message.includes('querySelector')
  }
  return false
}

private async healSelector(
  failedSelector: string,
  task: AutonomousTask,
): Promise<HealResult | null> {
  const slave = await this.governor.ensureRunning('default')
  const grounding = new SemanticGroundingEngine(/* transport */)

  const healer = new SelectorHealer(grounding, this.mcpClient)
  return healer.heal({
    slaveId: slave.slaveId,
    failedSelector: { type: 'css', selector: failedSelector },
    capabilityId: task.goal.description,
    providerId: 'autonomous',
    context: `Autonomous task: ${task.goal.description}`,
  })
}
```

### Full Observability Layer

Every autonomous action is traced:

```typescript
// Trace entry for each step
await traceLog.record({
  slaveId,
  conversationId: task.conversationId,
  method: `autonomous:${step.action}`,
  paramsJson: JSON.stringify(step.actionInput),
  resultJson: step.result ? JSON.stringify(step.result) : null,
  durationMs: step.completedAt - step.startedAt,
  ok: step.status === 'complete',
  error: step.error,
})

// Replay capability: re-execute from specific step
async replay(taskId: string, fromStep?: string): Promise<AutonomousTask> {
  const prev = await this.store.getTask(taskId)
  if (!prev) throw new EngineError(`Task not found: ${taskId}`)

  // Create new task with same goal
  const newTask = await this.execute(prev.goal)

  // If fromStep specified, skip steps before it
  if (fromStep) {
    const skipIdx = prev.steps.findIndex(s => s.id === fromStep)
    if (skipIdx > 0) {
      // Pre-populate results from previous run
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
```

---

## Visual Workflow DAG Engine

The `WorkflowEngine` gains visual DAG support:

```typescript
// Visual node with position for DAG editor
export interface VisualWorkflowNode extends WorkflowNode {
  position: { x: number; y: number }
  inputPorts: Array<{ id: string; name: string; type: string }>
  outputPorts: Array<{ id: string; name: string; type: string }>
}

// Visual edge with routing
export interface VisualWorkflowEdge extends WorkflowEdge {
  sourcePort: string
  targetPort: string
  routingPath?: Array<{ x: number; y: number }>
}

// Compile visual DAG → executable DAG
const compiled = compiler.compile({
  ...definition,
  nodes: definition.nodes.map(n => ({
    ...n,
    position: { x: n.positionX ?? 0, y: n.positionY ?? 0 },
  })),
})
```

---

## Server API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/autonomous/execute` | Start autonomous task |
| GET | `/api/autonomous/status/:id` | Get task status |
| GET | `/api/autonomous/tasks` | List tasks |
| POST | `/api/autonomous/:id/cancel` | Cancel task |
| POST | `/api/autonomous/:id/replay` | Replay task |
| GET | `/api/autonomous/gates` | List pending gates |
| POST | `/api/autonomous/gates/:id/resolve` | Resolve gate |
| GET | `/api/autonomous/:id/trace` | Get task trace |

---

## CLI Commands

```bash
vivim autonomous run "Find the cheapest flight to Paris"
vivim autonomous status <taskId>
vivim autonomous cancel <taskId>
vivim autonomous approve <gateId>
vivim autonomous replay <taskId> --from-step <stepId>
```
