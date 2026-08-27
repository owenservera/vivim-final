// src/storage/impl/primitive-store-impl.ts
// Prisma-backed PrimitiveStore.

import { type Primitive, rowToPrimitive } from 'shared/conceptual-model.js'
import type { PrimitiveInput, PrimitiveRow, PrimitiveStore } from '../contracts/primitive-store.js'
import type { CapStoreDb } from '../db.js'
import type { PrismaClient } from '../prisma.js'

export class PrimitiveStoreImpl implements PrimitiveStore {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async create(input: PrimitiveInput): Promise<PrimitiveRow> {
    const now = BigInt(Date.now())
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
    }) as unknown as PrimitiveRow
  }

  async get(id: string): Promise<PrimitiveRow | null> {
    return this.p.primitive.findUnique({ where: { id } }) as unknown as PrimitiveRow | null
  }

  async listByFamily(familyId: string): Promise<PrimitiveRow[]> {
    // Family globals (scope='family', familyId) + cross-type globals.
    return this.p.primitive.findMany({
      where: { OR: [{ scope: 'family', familyId }, { scope: 'cross-type' }] },
    }) as unknown as PrimitiveRow[]
  }

  async listByProvider(providerId: string): Promise<PrimitiveRow[]> {
    return this.p.primitive.findMany({ where: { providerId } }) as unknown as PrimitiveRow[]
  }

  async listByScope(scope: string): Promise<PrimitiveRow[]> {
    return this.p.primitive.findMany({ where: { scope } }) as unknown as PrimitiveRow[]
  }

  async update(id: string, patch: Partial<Omit<PrimitiveInput, 'id'>>): Promise<PrimitiveRow> {
    const data: Record<string, unknown> = { updatedAt: BigInt(Date.now()) }
    if (patch.scope !== undefined) data.scope = patch.scope
    if (patch.familyId !== undefined) data.familyId = patch.familyId
    if (patch.providerId !== undefined) data.providerId = patch.providerId
    if (patch.label !== undefined) data.label = patch.label
    if (patch.description !== undefined) data.description = patch.description
    if (patch.defaultRegion !== undefined)
      data.defaultRegionJson = JSON.stringify(patch.defaultRegion)
    if (patch.version !== undefined) data.version = patch.version
    return this.p.primitive.update({ where: { id }, data }) as unknown as PrimitiveRow
  }

  async delete(id: string): Promise<void> {
    await this.p.primitive.delete({ where: { id } })
  }

  async listDomains(): Promise<Primitive[]> {
    const rows = await this.p.primitive.findMany()
    return rows.map((row) => rowToPrimitive(row as unknown as Parameters<typeof rowToPrimitive>[0]))
  }
}
