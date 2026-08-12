// src/storage/impl/capability-macro-store-impl.ts
// PrismaStoreImpl for CapabilityMacroStore contract — Phase 21.1.2

import type { CapabilityMacroRow, CapabilityMacroStore } from '../../engines/capability-macro.js'
import type { CapStoreDb } from '../db.js'

export class CapabilityMacroStoreImpl implements CapabilityMacroStore {
  constructor(private db: CapStoreDb) {}

  async list(opts?: { providerId?: string; activeOnly?: boolean }): Promise<CapabilityMacroRow[]> {
    const where: Record<string, unknown> = {}
    if (opts?.providerId) where.providerId = opts.providerId
    if (opts?.activeOnly) where.isActive = 1
    const rows = await this.db.prisma.capabilityMacro.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      providerId: r.providerId ?? null,
      dagJson: r.dagJson,
      isActive: r.isActive === 1,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }))
  }

  async get(id: string): Promise<CapabilityMacroRow | null> {
    const row = await this.db.prisma.capabilityMacro.findUnique({ where: { id } })
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      providerId: row.providerId ?? null,
      dagJson: row.dagJson,
      isActive: row.isActive === 1,
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    }
  }

  async create(input: CapabilityMacroRow): Promise<CapabilityMacroRow> {
    await this.db.prisma.capabilityMacro.create({
      data: {
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        providerId: input.providerId ?? null,
        dagJson: input.dagJson,
        isActive: input.isActive ? 1 : 0,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      },
    })
    return input
  }

  async update(id: string, patch: Partial<CapabilityMacroRow>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.description !== undefined) data.description = patch.description ?? null
    if (patch.providerId !== undefined) data.providerId = patch.providerId ?? null
    if (patch.dagJson !== undefined) data.dagJson = patch.dagJson
    if (patch.isActive !== undefined) data.isActive = patch.isActive ? 1 : 0
    if (patch.updatedAt !== undefined) data.updatedAt = patch.updatedAt
    await this.db.prisma.capabilityMacro.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    await this.db.prisma.capabilityMacro.delete({ where: { id } }).catch(() => {})
  // [audit] log the error with context here
  }
}
