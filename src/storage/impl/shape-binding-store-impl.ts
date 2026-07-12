// src/storage/impl/shape-binding-store-impl.ts
// PrismaStoreImpl for ShapeBindingStore contract — Phase 22.4

import type { ShapeBindingRow, ShapeBindingStore } from '../contracts/shape-binding-store.js'
import type { CapStoreDb } from '../db.js'

export class ShapeBindingStoreImpl implements ShapeBindingStore {
  constructor(private db: CapStoreDb) {}

  async save(binding: ShapeBindingRow): Promise<void> {
    await this.db.prisma.providerShapeBinding.upsert({
      where: { id: binding.id },
      create: {
        id: binding.id,
        providerId: binding.providerId,
        archetypeId: binding.archetypeId,
        shapeId: binding.shapeId,
        configJson: binding.configJson,
        isActive: binding.isActive,
        createdAt: binding.createdAt,
      },
      update: {
        providerId: binding.providerId,
        archetypeId: binding.archetypeId,
        shapeId: binding.shapeId,
        configJson: binding.configJson,
        isActive: binding.isActive,
      },
    })
  }

  async findById(id: string): Promise<ShapeBindingRow | null> {
    const row = await this.db.prisma.providerShapeBinding.findUnique({ where: { id } })
    if (!row) return null
    return this.toRow(row)
  }

  async findByProvider(providerId: string): Promise<ShapeBindingRow[]> {
    const rows = await this.db.prisma.providerShapeBinding.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toRow(r))
  }

  async findByShape(shapeId: string): Promise<ShapeBindingRow[]> {
    const rows = await this.db.prisma.providerShapeBinding.findMany({
      where: { shapeId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toRow(r))
  }

  async delete(id: string): Promise<void> {
    await this.db.prisma.providerShapeBinding.delete({ where: { id } }).catch(() => {})
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.db.prisma.providerShapeBinding.update({
      where: { id },
      data: { isActive: active ? 1 : 0 },
    })
  }

  private toRow(row: {
    id: string
    providerId: string
    archetypeId: string
    shapeId: string
    configJson: string | null
    isActive: number
    createdAt: number
  }): ShapeBindingRow {
    return {
      id: row.id,
      providerId: row.providerId,
      archetypeId: row.archetypeId,
      shapeId: row.shapeId,
      configJson: row.configJson,
      isActive: row.isActive,
      createdAt: row.createdAt,
    }
  }
}
