// src/storage/impl/primitive-store-impl.ts
// Prisma-backed PrimitiveStore.

import { type Primitive, rowToPrimitive } from 'shared/conceptual-model.js'
import type { PrimitiveInput, PrimitiveRow, PrimitiveStore } from '../contracts/primitive-store.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = Record<string, unknown>

export class PrimitiveStoreImpl implements PrimitiveStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db.loose 
  }

  private get p() {
    return this.db.prisma
  }

  async create(input: PrimitiveInput): Promise<PrimitiveRow> {
    const now = Date.now()
    return this.p.primitive.create({
      data: {
        id: input.id,
        scope: input.scope,
        familyId: input.familyId ?? null,
        providerId: input.providerId ?? null,
        label: input.label,
        description: input.description ?? null,
        defaultRegionJson: JSON.stringify(input.defaultRegion),
        version: input.version ?? 1,
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  async get(id: string): Promise<PrimitiveRow | null> {
    return this.p.primitive.findUnique({ where: { id } })
  }

  async listByFamily(familyId: string): Promise<PrimitiveRow[]> {
    // Family globals (scope='family', familyId) + cross-type globals.
    return this.p.primitive.findMany({
      where: { OR: [{ scope: 'family', familyId }, { scope: 'cross-type' }] },
    })
  }

  async listByProvider(providerId: string): Promise<PrimitiveRow[]> {
    return this.p.primitive.findMany({ where: { providerId } })
  }

  async listByScope(scope: string): Promise<PrimitiveRow[]> {
    return this.p.primitive.findMany({ where: { scope } })
  }

  async update(id: string, patch: Partial<Omit<PrimitiveInput, 'id'>>): Promise<PrimitiveRow> {
    const data: Record<string, unknown> = { updatedAt: Date.now() }
    if (patch.scope !== undefined) data.scope = patch.scope
    if (patch.familyId !== undefined) data.familyId = patch.familyId
    if (patch.providerId !== undefined) data.providerId = patch.providerId
    if (patch.label !== undefined) data.label = patch.label
    if (patch.description !== undefined) data.description = patch.description
    if (patch.defaultRegion !== undefined)
      data.defaultRegionJson = JSON.stringify(patch.defaultRegion)
    if (patch.version !== undefined) data.version = patch.version
    return this.p.primitive.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    await this.p.primitive.delete({ where: { id } })
  }

  async listDomains(): Promise<Primitive[]> {
    const rows = await this.p.primitive.findMany()
    return rows.map(rowToPrimitive)
  }
}
