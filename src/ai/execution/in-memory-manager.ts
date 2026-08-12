/**
 * VIVIM AI Gateway — In-Memory Execution Manager
 * @module ai/execution/in-memory-manager
 *
 * Owns AIExecution lifecycle. Validates transitions per EXECUTION_TRANSITIONS.
 * TTL-based sweep (default 1h) for stale 'running' executions.
 */

import { AI_ERRORS } from '../core/errors.js'
import type { AIRequest, ProviderId, RequestId } from '../core/types.js'
import type { IExecutionManager } from './manager.js'
import { EXECUTION_TRANSITIONS, canTransition } from './types.js'
import type {
  AIExecution,
  ExecutionFilter,
  ExecutionHandle,
  ExecutionId,
  ExecutionSnapshot,
} from './types.js'
import { executionId } from './types.js'

const STALE_TTL_MS = 60 * 60 * 1000 // 1 hour

export class InMemoryExecutionManager implements IExecutionManager {
  private readonly executions = new Map<ExecutionId, AIExecution>()
  private readonly byRequest = new Map<RequestId, ExecutionId>()
  private readonly eventsByExecution = new Map<
    ExecutionId,
    {
      listeners: Array<(event: import('./types.js').ExecutionEvent) => void>
      received: number
      lastSequence: number
    }
  >()

  async create(request: AIRequest): Promise<ExecutionHandle> {
    const id = executionId(crypto.randomUUID())
    const now = new Date().toISOString()

    const execution: AIExecution = {
      id,
      requestId: request.requestId,
      sessionId: request.sessionId,
      state: 'created',
      priority: request.task?.priority ?? 'foreground',
      attempt: 0,
      createdAt: now,
    }

    this.executions.set(id, execution)
    this.byRequest.set(request.requestId, id)
    this.eventsByExecution.set(id, { listeners: [], received: 0, lastSequence: 0 })

    // Emit created event
    this.emitEvent(id, { type: 'execution.created', execution })

    // Auto-transition created → queued
    await this.transition(id, 'queued')

    const self = this

    return {
      executionId: id,
      requestId: request.requestId,
      events: {
        [Symbol.asyncIterator]() {
          const queue: Array<{ event: import('./types.js').ExecutionEvent; consumed: boolean }> = []
          let waiting: ((event: import('./types.js').ExecutionEvent | null) => void) | null = null
          let done = false

          const listener = (event: import('./types.js').ExecutionEvent): void => {
            if (done) return
            if (waiting) {
              const resolve = waiting
              waiting = null
              resolve(event)
            } else {
              queue.push({ event, consumed: false })
            }
          }

          const slot = self.eventsByExecution.get(id)
          if (slot) slot.listeners.push(listener)

          // Flush any already-received events first
          // (none yet at create time, but kept for symmetry)

          return {
            async next(): Promise<IteratorResult<import('./types.js').ExecutionEvent>> {
              if (done) return { value: undefined, done: true }
              if (queue.length > 0) {
                return { value: queue.shift()?.event, done: false }
              }
              return new Promise((resolve) => {
                waiting = (event) => {
                  if (event === null) {
                    resolve({ value: undefined, done: true })
                  } else {
                    resolve({ value: event, done: false })
                  }
                }
              })
            },
            async return(): Promise<IteratorResult<import('./types.js').ExecutionEvent>> {
              done = true
              const slot = self.eventsByExecution.get(id)
              if (slot) {
                slot.listeners = slot.listeners.filter((l) => l !== listener)
              }
              if (waiting) {
                waiting(null)
                waiting = null
              }
              return { value: undefined, done: true }
            },
          }
        },
      },
      async cancel(reason?: string): Promise<void> {
        await self.cancel(id, reason)
      },
    }
  }

  async get(executionId: ExecutionId): Promise<AIExecution | undefined> {
    return this.executions.get(executionId)
  }

  async getByRequest(requestId: RequestId): Promise<AIExecution | undefined> {
    const id = this.byRequest.get(requestId)
    if (!id) return undefined
    return this.executions.get(id)
  }

  async list(filter?: ExecutionFilter): Promise<readonly AIExecution[]> {
    let out = Array.from(this.executions.values())
    if (filter) {
      if (filter.state) out = out.filter((e) => e.state === filter.state)
      if (filter.providerId) out = out.filter((e) => e.providerId === filter.providerId)
      if (filter.sessionId) out = out.filter((e) => e.sessionId === filter.sessionId)
      if (filter.priority) out = out.filter((e) => e.priority === filter.priority)
    }
    return out
  }

  async cancel(executionId: ExecutionId, reason?: string): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) return
    if (
      execution.state === 'completed' ||
      execution.state === 'failed' ||
      execution.state === 'cancelled'
    ) {
      return // Already terminal
    }
    await this.transition(executionId, 'cancelled')
    this.emitEvent(executionId, {
      type: 'execution.cancelled',
      executionId,
      reason,
    })
  }

  async snapshot(executionId: ExecutionId): Promise<ExecutionSnapshot | undefined> {
    const execution = this.executions.get(executionId)
    const slot = this.eventsByExecution.get(executionId)
    if (!execution || !slot) return undefined
    return {
      execution,
      eventsReceived: slot.received,
      lastSequence: slot.lastSequence,
    }
  }

  async drainProvider(providerId: string): Promise<void> {
    const pid = providerId as ProviderId
    for (const [id, execution] of this.executions) {
      if (execution.providerId === pid && !this.isTerminal(execution.state)) {
        await this.transition(id, 'draining')
      }
    }
  }

  // --- Internal helpers ---

  /** Transition execution state with validation. */
  async transition(executionId: ExecutionId, to: AIExecution['state']): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) {
      throw AI_ERRORS.invalidRequest(`Execution ${executionId} not found`)
    }
    const from = execution.state
    if (from === to) return
    if (!canTransition(from, to)) {
      throw new Error(`Illegal execution transition: ${from} → ${to} (execution ${executionId})`)
    }
    const updated: AIExecution = {
      ...execution,
      state: to,
      startedAt:
        to === 'executing' && !execution.startedAt ? new Date().toISOString() : execution.startedAt,
      completedAt:
        to === 'completed' || to === 'failed' || to === 'cancelled'
          ? new Date().toISOString()
          : execution.completedAt,
    }
    this.executions.set(executionId, updated)
    this.emitEvent(executionId, {
      type: 'execution.state-changed',
      executionId,
      from,
      to,
      at: new Date().toISOString(),
    })
  }

  /** Record provider selection for an execution. */
  async recordProviderSelection(
    executionId: ExecutionId,
    providerId: ProviderId,
    modelId: import('../core/types.js').ModelId,
    attempt: number,
  ): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) return
    const updated: AIExecution = {
      ...execution,
      providerId,
      modelId,
      attempt,
    }
    this.executions.set(executionId, updated)
    this.emitEvent(executionId, {
      type: 'execution.provider-selected',
      executionId,
      providerId,
      modelId,
      attempt,
    })
  }

  /** Record a forwarded AIEvent for an execution. */
  recordAIEvent(executionId: ExecutionId, event: import('../core/types.js').AIEvent): void {
    const slot = this.eventsByExecution.get(executionId)
    if (!slot) return
    slot.received++
    slot.lastSequence = Math.max(slot.lastSequence, event.sequence)
    this.emitEvent(executionId, {
      type: 'execution.ai-event',
      executionId,
      event,
    })
  }

  /** Mark an execution completed. */
  async recordCompleted(executionId: ExecutionId): Promise<void> {
    await this.transition(executionId, 'completed')
    this.emitEvent(executionId, { type: 'execution.completed', executionId })
  }

  /** Mark an execution failed. */
  async recordFailed(
    executionId: ExecutionId,
    error: import('../core/types.js').AIError,
    willRetry: boolean,
  ): Promise<void> {
    const execution = this.executions.get(executionId)
    if (!execution) return
    // If already terminal, just update the error field (don't try to transition)
    if (this.isTerminal(execution.state)) {
      this.executions.set(executionId, { ...execution, error })
      this.emitEvent(executionId, { type: 'execution.failed', executionId, error, willRetry })
      return
    }
    this.executions.set(executionId, { ...execution, error })
    await this.transition(executionId, 'failed')
    this.emitEvent(executionId, {
      type: 'execution.failed',
      executionId,
      error,
      willRetry,
    })
  }

  private isTerminal(state: AIExecution['state']): boolean {
    return EXECUTION_TRANSITIONS[state].length === 0
  }

  private emitEvent(executionId: ExecutionId, event: import('./types.js').ExecutionEvent): void {
    const slot = this.eventsByExecution.get(executionId)
    if (!slot) return
    for (const listener of slot.listeners) {
      try {
        listener(event)
      } catch {
  // [audit] log the error with context here
        // Listener errors are ignored — the bus must not crash
      }
    }
  }

  /** Sweep stale executions (call periodically). */
  sweepStale(): void {
    const now = Date.now()
    for (const [id, execution] of this.executions) {
      if (this.isTerminal(execution.state)) {
        const completedAt = execution.completedAt ? Date.parse(execution.completedAt) : 0
        if (completedAt && now - completedAt > STALE_TTL_MS) {
          this.executions.delete(id)
          this.eventsByExecution.delete(id)
          this.byRequest.delete(execution.requestId)
        }
      } else if (execution.state === 'executing' || execution.state === 'queued') {
        const createdAt = Date.parse(execution.createdAt)
        if (createdAt && now - createdAt > STALE_TTL_MS) {
          // Mark as failed (stale)
          void this.recordFailed(id, AI_ERRORS.timeout(STALE_TTL_MS).toJSON(), false)
        }
      }
    }
  }
}
