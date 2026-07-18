// src/storage/impl/workflow-retry-queue-store-impl.ts
// Prisma-backed WorkflowRetryQueueStore

import type { WorkflowRetryQueueStore } from '../../engines/workflow-engine.js'
import type { CapStoreDb } from '../db.js'

export class WorkflowRetryQueueStoreImpl implements WorkflowRetryQueueStore {
  constructor(private db: CapStoreDb) {}

  async enqueue(record: {
    id: string
    nodeExecutionId: string
    attempt: number
    nextRetryAt: number
    maxAttempts: number
    backoffMs: number
    status: string
  }): Promise<void> {
    await this.db.prisma.workflowRetryQueue.create({
      data: {
        id: record.id,
        nodeExecutionId: record.nodeExecutionId,
        attempt: record.attempt,
        nextRetryAt: BigInt(record.nextRetryAt),
        maxAttempts: record.maxAttempts,
        backoffMs: record.backoffMs,
        status: record.status,
      },
    })
  }

  async getPending(now: number): Promise<
    Array<{
      id: string
      nodeExecutionId: string
      attempt: number
      nextRetryAt: number
      maxAttempts: number
      backoffMs: number
      status: string
    }>
  > {
    const rows = await this.db.prisma.workflowRetryQueue.findMany({
      where: { status: 'pending', nextRetryAt: { lte: BigInt(now) } },
      orderBy: { nextRetryAt: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      nodeExecutionId: r.nodeExecutionId,
      attempt: r.attempt,
      nextRetryAt: Number(r.nextRetryAt),
      maxAttempts: r.maxAttempts,
      backoffMs: r.backoffMs,
      status: r.status,
    }))
  }

  async markComplete(id: string): Promise<void> {
    await this.db.prisma.workflowRetryQueue.update({
      where: { id },
      data: { status: 'completed' },
    })
  }

  async markDead(id: string): Promise<void> {
    await this.db.prisma.workflowRetryQueue.update({
      where: { id },
      data: { status: 'dead_letter' },
    })
  }
}
