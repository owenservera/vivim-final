// src/storage/impl/provider-type-store-impl.ts
// Prisma-backed ProviderTypeStore.

import { type ProviderType, rowToProviderType } from 'shared/conceptual-model.js'
import type {
  ProviderTypeInput,
  ProviderTypeRow,
  ProviderTypeStore,
} from '../contracts/provider-type-store.js'
import type { PrismaClient } from '../prisma.js'
import type { CapStoreDb } from '../db.js'

export class ProviderTypeStoreImpl implements ProviderTypeStore {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async create(input: ProviderTypeInput): Promise<ProviderTypeRow> {
    const now = Date.now()
    return this.p.providerType.create({
      data: {
        id: input.id,
        slug: input.slug,
        displayName: input.displayName,
        description: input.description ?? null,
        slotCatalogJson: JSON.stringify(input.slotCatalog),
        regionLayoutJson: JSON.stringify(input.regionLayout),
        interactionGrammarJson: JSON.stringify(input.interactionGrammar),
        basePrimitive: input.basePrimitive ?? 'conversations',
        version: input.version ?? 1,
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  async get(id: string): Promise<ProviderTypeRow | null> {
    return this.p.providerType.findUnique({ where: { id } })
  }

  async getBySlug(slug: string): Promise<ProviderTypeRow | null> {
    return this.p.providerType.findUnique({ where: { slug } })
  }

  async list(): Promise<ProviderTypeRow[]> {
    return this.p.providerType.findMany()
  }

  async update(
    id: string,
    patch: Partial<Omit<ProviderTypeInput, 'id'>>,
  ): Promise<ProviderTypeRow> {
    const data: Record<string, unknown> = { updatedAt: Date.now() }
    if (patch.slug !== undefined) data.slug = patch.slug
    if (patch.displayName !== undefined) data.displayName = patch.displayName
    if (patch.description !== undefined) data.description = patch.description
    if (patch.slotCatalog !== undefined) data.slotCatalogJson = JSON.stringify(patch.slotCatalog)
    if (patch.regionLayout !== undefined) data.regionLayoutJson = JSON.stringify(patch.regionLayout)
    if (patch.interactionGrammar !== undefined)
      data.interactionGrammarJson = JSON.stringify(patch.interactionGrammar)
    if (patch.basePrimitive !== undefined) data.basePrimitive = patch.basePrimitive
    if (patch.version !== undefined) data.version = patch.version
    return this.p.providerType.update({ where: { id }, data })
  }

  async delete(id: string): Promise<void> {
    await this.p.providerType.delete({ where: { id } })
  }

  async listDomains(): Promise<ProviderType[]> {
    const rows = await this.list()
    return rows.map(rowToProviderType)
  }
}
