// src/storage/impl/hitl-gate-store-impl.ts
// Prisma-backed HitlGateStore for WorkflowEngine human-in-the-loop gates

import type { HitlGateStore } from '../../engines/workflow-engine.js'
import type { CapStoreDb } from '../db.js'

export class HitlGateStoreImpl implements HitlGateStore {
  constructor(private db: CapStoreDb) {}

  async createGate(gate: Record<string, unknown>): Promise<void> {
    await this.db.prisma.hitlGate.create({
      data: {
        id: gate.id as string,
        taskId: gate.taskId as string,
        stepId: gate.stepId as string,
        gateType: gate.gateType as string,
        prompt: gate.prompt as string,
        optionsJson: (gate.optionsJson as string) ?? '[]',
        defaultValue: (gate.defaultValue as string) ?? null,
        status: (gate.status as string) ?? 'pending',
        createdAt: BigInt((gate.createdAt as number) ?? Date.now()),
        expiresAt: gate.expiresAt != null ? BigInt(gate.expiresAt as number) : null,
      },
    })
  }

  async updateGate(id: string, patch: Record<string, unknown>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.status !== undefined) data.status = patch.status
    if (patch.resolvedBy !== undefined) data.resolvedBy = patch.resolvedBy
    if (patch.resolvedAt !== undefined) data.resolvedAt = BigInt(patch.resolvedAt as number)
    if (patch.response !== undefined) data.response = patch.response
    await this.db.prisma.hitlGate.update({ where: { id }, data })
  }

  async getGate(id: string): Promise<Record<string, unknown> | null> {
    const r = await this.db.prisma.hitlGate.findUnique({ where: { id } })
    if (!r) return null
    return {
      ...r,
      createdAt: Number(r.createdAt),
      expiresAt: r.expiresAt != null ? Number(r.expiresAt) : null,
      resolvedAt: r.resolvedAt != null ? Number(r.resolvedAt) : null,
    }
  }

  async resolveGate(id: string, resolution: unknown): Promise<void> {
    const res = resolution as { status?: string; resolvedBy?: string; response?: string }
    const data: Record<string, unknown> = { status: res.status ?? 'resolved' }
    if (res.resolvedBy) data.resolvedBy = res.resolvedBy
    if (res.response) data.response = res.response
    data.resolvedAt = Date.now()
    await this.db.prisma.hitlGate.update({ where: { id }, data })
  }

  async listPending(): Promise<Array<Record<string, unknown>>> {
    const rows = await this.db.prisma.hitlGate.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({
      ...r,
      createdAt: Number(r.createdAt),
      expiresAt: r.expiresAt != null ? Number(r.expiresAt) : null,
      resolvedAt: r.resolvedAt != null ? Number(r.resolvedAt) : null,
    }))
  }

  async getPendingGates(workflowExecutionId?: string): Promise<Array<Record<string, unknown>>> {
    const where: Record<string, unknown> = { status: 'pending' }
    if (workflowExecutionId) where.taskId = workflowExecutionId
    const rows = await this.db.prisma.hitlGate.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({
      ...r,
      createdAt: Number(r.createdAt),
      expiresAt: r.expiresAt != null ? Number(r.expiresAt) : null,
      resolvedAt: r.resolvedAt != null ? Number(r.resolvedAt) : null,
    }))
  }
}
