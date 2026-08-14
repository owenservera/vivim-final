// src/engines/execution-kernel.ts
// ExecutionKernel — thin lifecycle manager for all executable operations.
// Wraps capability execution, automation, and memory mutations through a
// single policy → execute → verify → journal path.
//
// Works with the codebase's ActionPlan (version:1, nodes[], goal).
// The kernel owns lifecycle only. It does NOT know how browser automation
// works, how memory is stored, or how a provider LLM works.
//
// Hard constraints:
//  - No second capability registry.
//  - No model-generated arbitrary code execution.
//  - No silent destructive retries.
//  - No secret values in journal events.

import { newId } from '../ids.js'
import type { ActionNode, ActionPlan } from './action-plan.js'

// ── Policy Decision ──────────────────────────────────────────────────────

export type PolicyDecision =
  | { allowed: true; requiresConfirmation: boolean }
  | { allowed: false; reason: string; requiresConfirmation?: boolean }

// ── Execution Event ──────────────────────────────────────────────────────

export interface ExecutionEvent {
  executionId: string
  parentExecutionId?: string
  actionId: string
  phase: 'planned' | 'policy' | 'started' | 'completed' | 'failed' | 'verified' | 'recovered'
  timestamp: number
  data?: Record<string, unknown>
}

// ── Verification Result ──────────────────────────────────────────────────

export interface VerificationResult {
  ok: boolean
  reason?: string
}

// ── Execution Result ─────────────────────────────────────────────────────

export interface ExecutionResult<T = unknown> {
  executionId: string
  ok: boolean
  output?: T
  error?: string
}

// ── Journal Sink ─────────────────────────────────────────────────────────

export interface JournalSink {
  append(event: ExecutionEvent): Promise<void> | void
}

// ── Kernel Dependencies ──────────────────────────────────────────────────

export interface ExecutionKernelDeps {
  policy: {
    evaluate(plan: ActionPlan): Promise<PolicyDecision> | PolicyDecision
  }
  journal: JournalSink
  verify?: {
    verify(node: ActionNode, output: unknown): Promise<VerificationResult> | VerificationResult
  }
}

// ── ExecutionKernel ──────────────────────────────────────────────────────

export class ExecutionKernel {
  constructor(private readonly deps: ExecutionKernelDeps) {}

  /**
   * Execute an ActionPlan through the full lifecycle.
   *
   * For single-node plans: executes the one node.
   * For multi-node plans: executes nodes in topological order (dependency-safe).
   *
   * Lifecycle per node:
   *   planned → policy → started → [executor] → [verify] → completed
   */
  async execute<T>(
    plan: ActionPlan,
    executor: (node: ActionNode, input: Record<string, unknown>) => Promise<T>,
  ): Promise<ExecutionResult<T>> {
    const executionId = newId()

    const emit = (phase: ExecutionEvent['phase'], data?: Record<string, unknown>) =>
      this.deps.journal.append({
        executionId,
        actionId: plan.goal,
        phase,
        timestamp: Date.now(),
        data,
      })

    // Phase: planned
    await emit('planned', {
      goal: plan.goal,
      nodeCount: plan.nodes.length,
      nodeIds: plan.nodes.map((n) => n.id),
    })

    // Phase: policy — evaluate all nodes before executing any
    const decision = await this.deps.policy.evaluate(plan)
    // __confirmed is set by NLCL when the human confirmation gate has already minted/verified a token
    // (or the engine is resuming an already-confirmed intent). Engine-authorized plans bypass policy
    // tier-blocking AND the confirmation-token gate, since the confirmation decision was made upstream
    // by the NLCL layer (ExecutionKernel is the execution primitive, not the confirmation authority).
    const engineAuthorized = plan.metadata?.__confirmed === true
    await emit(
      'policy',
      decision.allowed || engineAuthorized
        ? { allowed: true }
        : { allowed: false, reason: decision.reason },
    )

    if (!decision.allowed && !engineAuthorized) {
      return { executionId, ok: false, error: decision.reason }
    }

    // Confirmation gate — if ANY node requires confirmation but has no token,
    // block execution. (For now, we check plan-level; per-node tokens can be
    // added later via confirmationToken on ActionNode.)
    if (decision.requiresConfirmation && !engineAuthorized) {
      // Check if the plan metadata carries a confirmation token
      const token = plan.metadata?.confirmationToken as string | undefined
      if (!token) {
        return { executionId, ok: false, error: 'Confirmation required' }
      }
    }

    // Execute nodes — for single-node plans this is just one iteration.
    // For multi-node plans, execute in dependency order.
    try {
      await emit('started')

      // Simple case: single node
      if (plan.nodes.length === 1) {
        const node = plan.nodes[0]!
        const output = await executor(node, node.input)

        // Verify (optional)
        if (this.deps.verify && node.verify?.type !== 'none') {
          const verification = await this.deps.verify.verify(node, output)
          if (!verification.ok) {
            await emit('failed', {
              nodeId: node.id,
              phase: 'verification',
              reason: verification.reason,
            })
            return {
              executionId,
              ok: false,
              error: verification.reason ?? 'Verification failed',
            }
          }
          await emit('verified', { nodeId: node.id })
        }

        await emit('completed', { nodeId: node.id })
        return { executionId, ok: true, output }
      }

      // Multi-node: execute in topological order
      const outputs = new Map<string, unknown>()
      const order = topologicalOrder(plan.nodes)

      for (const nodeId of order) {
        const node = plan.nodes.find((n) => n.id === nodeId)
        if (!node) continue

        // Inject outputs from dependency nodes into this node's input
        const input = { ...node.input }
        for (const depId of node.dependsOn) {
          if (outputs.has(depId)) {
            input[`$${depId}`] = outputs.get(depId)
          }
        }

        const output = await executor(node, input)
        outputs.set(nodeId, output)

        // Verify (optional)
        if (this.deps.verify && node.verify?.type !== 'none') {
          const verification = await this.deps.verify.verify(node, output)
          if (!verification.ok) {
            await emit('failed', {
              nodeId: node.id,
              phase: 'verification',
              reason: verification.reason,
            })
            return {
              executionId,
              ok: false,
              error: verification.reason ?? `Verification failed for node ${node.id}`,
            }
          }
          await emit('verified', { nodeId: node.id })
        }

        await emit('completed', { nodeId: node.id })
      }

      // Return the last node's output as the plan result
      const lastNodeId = order[order.length - 1]!
      const lastOutput = outputs.get(lastNodeId) as T | undefined
      return { executionId, ok: true, output: lastOutput }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await emit('failed', { error: message })
      return { executionId, ok: false, error: message }
    }
  }
}

// ── Topological Sort ─────────────────────────────────────────────────────

function topologicalOrder(nodes: readonly ActionNode[]): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, node.dependsOn.length)
    for (const dep of node.dependsOn) {
      if (!adjacency.has(dep)) adjacency.set(dep, [])
      adjacency.get(dep)?.push(node.id)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const next of adjacency.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  return order
}

// ── Memory Journal (testing / shadow mode) ───────────────────────────────

export class MemoryJournal implements JournalSink {
  readonly events: ExecutionEvent[] = []

  append(event: ExecutionEvent): void {
    this.events.push(Object.freeze({ ...event }))
  }
}
