// src/engines/scheduler/browser-scheduler.ts
// BrowserScheduler — resource-class-aware task scheduler.
// Phase 5: Replaces single-mailbox execution with dependency-aware scheduling.

import { ValidationError } from '../../errors.js'
import { getLogger } from '../../observability/logger.js'
import { getMetrics } from '../../observability/metrics.js'
import { SchedulerPolicy } from './policy.js'
import type { QueueName } from './queues.js'
import { QUEUE_CONFIGS } from './queues.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  queue: QueueName
  priority: number
  timeoutMs: number
  signal: AbortSignal
  run: () => Promise<unknown>
}

export interface TaskResult {
  taskId: string
  success: boolean
  result?: unknown
  error?: string
  durationMs: number
}

export interface SchedulerSnapshot {
  totalInFlight: number
  queues: Record<QueueName, { depth: number; inFlight: number }>
}

// ── Errors ──────────────────────────────────────────────────────────────────

export class SchedulerBackpressureError extends Error {
  constructor(timeoutMs: number) {
    super(`Scheduler backpressure timeout after ${timeoutMs}ms`)
    this.name = 'SchedulerBackpressureError'
  }
}

export class TaskTimeoutError extends Error {
  constructor(taskId: string, timeoutMs: number) {
    super(`Task ${taskId} timed out after ${timeoutMs}ms`)
    this.name = 'TaskTimeoutError'
  }
}

// ── Browser Scheduler ───────────────────────────────────────────────────────

export class BrowserScheduler {
  private queues = new Map<QueueName, Array<Task>>()
  private inFlight = new Map<QueueName, number>()
  private oldestWait = new Map<QueueName, number>()
  private policy: SchedulerPolicy
  private logger: ReturnType<typeof getLogger>
  private metrics = getMetrics()
  private taskIdCounter = 0

  constructor(
    private slaveId: string,
    policyConfig?: Partial<import('./policy.js').PolicyConfig>,
  ) {
    this.policy = new SchedulerPolicy(policyConfig)
    this.logger = getLogger(`Scheduler:${slaveId}`)

    // Initialize queues
    for (const name of Object.keys(QUEUE_CONFIGS) as QueueName[]) {
      this.queues.set(name, [])
      this.inFlight.set(name, 0)
      this.oldestWait.set(name, 0)
    }
  }

  /**
   * Enqueue a task for execution.
   */
  async enqueue(task: Task): Promise<TaskResult> {
    const config = QUEUE_CONFIGS[task.queue]
    if (!config) throw new ValidationError(`Unknown queue: ${task.queue}`)

    // Check backpressure
    const totalInFlight = this.getTotalInFlight()
    if (this.policy.isBackpressured(totalInFlight)) {
      await this.waitForSlot(task.signal)
    }

    // Add to queue
    const queue = this.queues.get(task.queue)!
    queue.push(task)
    queue.sort((a, b) => b.priority - a.priority)

    // Update oldest wait time
    if (queue.length > 0 && !this.oldestWait.has(task.queue)) {
      this.oldestWait.set(task.queue, Date.now())
    }

    this.metrics.setGauge(
      'chrome_scheduler_queue_depth',
      {
        slaveId: this.slaveId,
        queue: task.queue,
      },
      queue.length,
    )

    // Wait for execution
    return this.executeWhenReady(task)
  }

  /**
   * Cancel a task by ID.
   */
  cancel(taskId: string): void {
    for (const [name, queue] of this.queues) {
      const index = queue.findIndex((t) => t.id === taskId)
      if (index >= 0) {
        queue.splice(index, 1)
        this.logger.info('Task cancelled', { taskId, queue: name })
        break
      }
    }
  }

  /**
   * Get scheduler snapshot.
   */
  snapshot(): SchedulerSnapshot {
    const queues: Record<string, { depth: number; inFlight: number }> = {}
    for (const [name, queue] of this.queues) {
      queues[name] = {
        depth: queue.length,
        inFlight: this.inFlight.get(name) ?? 0,
      }
    }
    return {
      totalInFlight: this.getTotalInFlight(),
      queues: queues as Record<QueueName, { depth: number; inFlight: number }>,
    }
  }

  /**
   * Get total in-flight tasks.
   */
  private getTotalInFlight(): number {
    let total = 0
    for (const count of this.inFlight.values()) {
      total += count
    }
    return total
  }

  /**
   * Wait for a slot to become available (backpressure).
   */
  private async waitForSlot(signal: AbortSignal): Promise<void> {
    const timeoutMs = this.policy.getBackpressureTimeout()
    const start = Date.now()

    while (this.policy.isBackpressured(this.getTotalInFlight())) {
      if (signal.aborted) throw new ValidationError('Task aborted')
      if (Date.now() - start > timeoutMs) {
        throw new SchedulerBackpressureError(timeoutMs)
      }
      await new Promise((r) => setTimeout(r, 10))
    }
  }

  /**
   * Execute a task when its queue has capacity.
   */
  private async executeWhenReady(task: Task): Promise<TaskResult> {
    const config = QUEUE_CONFIGS[task.queue]
    const start = Date.now()

    // Wait for queue capacity
    while ((this.inFlight.get(task.queue) ?? 0) >= config.concurrency) {
      if (task.signal.aborted) {
        return { taskId: task.id, success: false, error: 'Aborted', durationMs: Date.now() - start }
      }
      await new Promise((r) => setTimeout(r, 5))
    }

    // Remove from queue
    const queue = this.queues.get(task.queue)!
    const index = queue.findIndex((t) => t.id === task.id)
    if (index >= 0) queue.splice(index, 1)

    // Update oldest wait
    if (queue.length === 0) {
      this.oldestWait.delete(task.queue)
    }

    // Increment in-flight
    this.inFlight.set(task.queue, (this.inFlight.get(task.queue) ?? 0) + 1)

    try {
      // Execute with timeout
      const result = await Promise.race([
        task.run(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new TaskTimeoutError(task.id, task.timeoutMs)), task.timeoutMs),
        ),
      ])

      const durationMs = Date.now() - start
      this.logger.debug('Task completed', { taskId: task.id, queue: task.queue, durationMs })
      this.metrics.observeHistogram(
        'chrome_slave_cdp_roundtrip_ms',
        { slaveId: this.slaveId },
        durationMs,
      )

      return { taskId: task.id, success: true, result, durationMs }
    } catch (err) {
      const durationMs = Date.now() - start
      this.logger.error('Task failed', {
        taskId: task.id,
        queue: task.queue,
        error: err instanceof Error ? err.message : String(err),
      })
      return {
        taskId: task.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      }
    } finally {
      // Decrement in-flight
      this.inFlight.set(task.queue, Math.max(0, (this.inFlight.get(task.queue) ?? 1) - 1))
    }
  }
}
