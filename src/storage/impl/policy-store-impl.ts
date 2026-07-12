// src/storage/impl/policy-store-impl.ts
// Prisma-backed PolicyStore for ExecutionPolicyEngine

import { PrismaClient } from '@prisma/client'
import type { PolicyStore } from '../../engines/execution-policy.js'

const prisma = new PrismaClient()

export class PolicyStoreImpl implements PolicyStore {
  async createRule(rule: Record<string, unknown>): Promise<void> {
    await prisma.policyRule.create({
      data: {
        id: rule.id as string,
        name: rule.name as string,
        condition: rule.condition as string,
        classification: rule.classification as string,
        requiresApproval: (rule.requiresApproval as boolean) ? 1 : 0,
        cooldownMs: (rule.cooldownMs as number) ?? 0,
        maxOccurrences: (rule.maxOccurrences as number) ?? 1000000,
        windowMs: (rule.windowMs as number) ?? 60000,
        isActive: (rule.isActive as boolean) !== false ? 1 : 0,
      },
    })
  }

  async updateRule(id: string, patch: Record<string, unknown>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.condition !== undefined) data.condition = patch.condition
    if (patch.classification !== undefined) data.classification = patch.classification
    if (patch.requiresApproval !== undefined) data.requiresApproval = patch.requiresApproval ? 1 : 0
    if (patch.cooldownMs !== undefined) data.cooldownMs = patch.cooldownMs
    if (patch.maxOccurrences !== undefined) data.maxOccurrences = patch.maxOccurrences
    if (patch.windowMs !== undefined) data.windowMs = patch.windowMs
    if (patch.isActive !== undefined) data.isActive = patch.isActive ? 1 : 0
    await prisma.policyRule.update({ where: { id }, data })
  }

  async getRule(id: string): Promise<Record<string, unknown> | null> {
    const row = await prisma.policyRule.findUnique({ where: { id } })
    return row as unknown as Record<string, unknown> | null
  }

  async listRules(): Promise<Array<Record<string, unknown>>> {
    const rows = await prisma.policyRule.findMany()
    return rows.map((r) => ({
      ...r,
      requiresApproval: r.requiresApproval === 1,
      isActive: r.isActive === 1,
    })) as unknown as Array<Record<string, unknown>>
  }

  async getRecentOccurrences(action: string, windowMs: number): Promise<number> {
    // Count recent task steps with this action within the window
    const cutoff = Date.now() - windowMs
    const count = await prisma.autonomousStep.count({
      where: {
        action,
        startedAt: { gte: cutoff },
      },
    })
    return count
  }
}
