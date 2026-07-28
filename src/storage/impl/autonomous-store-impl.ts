// src/storage/impl/autonomous-store-impl.ts
// Prisma-backed AutonomousExecutionStore

import { PrismaClient } from '@prisma/client'
import type { AutonomousExecutionStore } from '../contracts/autonomous-store.js'

const prisma = new PrismaClient()

const templateStore = new Map<string, Record<string, unknown>>()

export class AutonomousStoreImpl implements AutonomousExecutionStore {
  async createTask(task: Record<string, unknown>): Promise<void> {
    await prisma.autonomousTask.create({
      data: {
        id: task.id as string,
        goalJson: task.goalJson as string,
        status: (task.status as string) ?? 'pending',
        resultJson: (task.resultJson as string) ?? null,
        error: (task.error as string) ?? null,
        startedAt: task.startedAt as number,
        completedAt: (task.completedAt as number) ?? null,
      },
    })
  }

  async updateTask(id: string, patch: Record<string, unknown>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.status !== undefined) data.status = patch.status
    if (patch.resultJson !== undefined) data.resultJson = patch.resultJson
    if (patch.error !== undefined) data.error = patch.error
    if (patch.completedAt !== undefined) data.completedAt = patch.completedAt
    if (patch.pausedStateJson !== undefined) data.pausedStateJson = patch.pausedStateJson
    if (patch.pauseReason !== undefined) data.pauseReason = patch.pauseReason
    await prisma.autonomousTask.update({ where: { id }, data })
  }

  async getTask(id: string): Promise<Record<string, unknown> | null> {
    const row = await prisma.autonomousTask.findUnique({ where: { id } })
    return row as unknown as Record<string, unknown> | null
  }

  async listTasks(opts?: { status?: string; limit?: number }): Promise<
    Array<Record<string, unknown>>
  > {
    const where = opts?.status ? { status: opts.status } : {}
    const rows = await prisma.autonomousTask.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: opts?.limit ?? 50,
    })
    return rows as unknown as Array<Record<string, unknown>>
  }

  async createStep(step: Record<string, unknown>): Promise<void> {
    await prisma.autonomousStep.create({
      data: {
        id: step.id as string,
        taskId: step.taskId as string,
        stepIndex: step.stepIndex as number,
        description: step.description as string,
        action: step.action as string,
        actionInputJson: step.actionInputJson as string,
        classification: step.classification as string,
        status: (step.status as string) ?? 'pending',
        resultJson: (step.resultJson as string) ?? null,
        error: (step.error as string) ?? null,
        startedAt: (step.startedAt as number) ?? null,
        completedAt: (step.completedAt as number) ?? null,
        requiresHumanApproval: (step.requiresHumanApproval as number) ?? 0,
      },
    })
  }

  async updateStep(id: string, patch: Record<string, unknown>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.status !== undefined) data.status = patch.status
    if (patch.resultJson !== undefined) data.resultJson = patch.resultJson
    if (patch.error !== undefined) data.error = patch.error
    if (patch.startedAt !== undefined) data.startedAt = patch.startedAt
    if (patch.completedAt !== undefined) data.completedAt = patch.completedAt
    await prisma.autonomousStep.update({ where: { id }, data })
  }

  async getSteps(taskId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await prisma.autonomousStep.findMany({
      where: { taskId },
      orderBy: { stepIndex: 'asc' },
    })
    return rows as unknown as Array<Record<string, unknown>>
  }

  async getStep(id: string): Promise<Record<string, unknown> | null> {
    const row = await prisma.autonomousStep.findUnique({ where: { id } })
    return row as unknown as Record<string, unknown> | null
  }

  async createHitlGate(gate: Record<string, unknown>): Promise<void> {
    await prisma.hitlGate.create({
      data: {
        id: gate.id as string,
        taskId: gate.taskId as string,
        stepId: gate.stepId as string,
        gateType: gate.gateType as string,
        prompt: gate.prompt as string,
        optionsJson: (gate.optionsJson as string) ?? '[]',
        defaultValue: (gate.defaultValue as string) ?? null,
        status: (gate.status as string) ?? 'pending',
        resolvedBy: (gate.resolvedBy as string) ?? null,
        resolvedAt: (gate.resolvedAt as number) ?? null,
        response: (gate.response as string) ?? null,
        createdAt: gate.createdAt as number,
        expiresAt: (gate.expiresAt as number) ?? null,
      },
    })
  }

  async updateHitlGate(id: string, patch: Record<string, unknown>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.status !== undefined) data.status = patch.status
    if (patch.resolvedBy !== undefined) data.resolvedBy = patch.resolvedBy
    if (patch.resolvedAt !== undefined) data.resolvedAt = patch.resolvedAt
    if (patch.response !== undefined) data.response = patch.response
    await prisma.hitlGate.update({ where: { id }, data })
  }

  async getPendingGates(taskId?: string): Promise<Array<Record<string, unknown>>> {
    const where: Record<string, unknown> = { status: 'pending' }
    if (taskId) where.taskId = taskId
    const rows = await prisma.hitlGate.findMany({ where, orderBy: { createdAt: 'asc' } })
    return rows as unknown as Array<Record<string, unknown>>
  }

  async getGate(id: string): Promise<Record<string, unknown> | null> {
    const row = await prisma.hitlGate.findUnique({ where: { id } })
    return row as unknown as Record<string, unknown> | null
  }

  async getTaskTemplate(id: string): Promise<Record<string, unknown> | null> {
    return templateStore.get(id) ?? null
  }

  async insertTaskTemplate(template: Record<string, unknown>): Promise<string> {
    const id = template.id as string
    templateStore.set(id, { ...template })
    return id
  }

  async updateTaskTemplate(id: string, patch: Record<string, unknown>): Promise<void> {
    const existing = templateStore.get(id)
    if (existing) templateStore.set(id, { ...existing, ...patch })
  }

  async listTaskTemplates(opts?: { isShared?: boolean }): Promise<Array<Record<string, unknown>>> {
    const all = Array.from(templateStore.values())
    if (opts?.isShared !== undefined) return all.filter((t) => t.isShared === opts.isShared)
    return all
  }
}
