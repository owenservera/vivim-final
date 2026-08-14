// src/storage/impl/onboarding/webapp-taxonomy-store-impl.ts
// Prisma-backed implementation of WebAppTaxonomyStoreContract.

import type {
  WebAppTaxonomyCreateInput,
  WebAppTaxonomyRow,
  WebAppTaxonomyStoreContract,
} from '../../contracts/onboarding/webapp-taxonomy-store.js'
import type { CapStoreDb } from '../../db.js'
import type { PrismaClient } from '../../prisma.js'

export class WebAppTaxonomyStoreImpl implements WebAppTaxonomyStoreContract {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async listAll(): Promise<WebAppTaxonomyRow[]> {
    const rows = (await this.p.webAppTaxonomy.findMany({
      orderBy: { createdAt: 'asc' },
    })) as Array<Record<string, unknown>>
    return rows.map(this.rowToContract)
  }

  async getById(id: string): Promise<WebAppTaxonomyRow | null> {
    const row = (await this.p.webAppTaxonomy.findUnique({ where: { id } })) as Record<
      string,
      unknown
    > | null
    return row ? this.rowToContract(row) : null
  }

  async create(row: WebAppTaxonomyCreateInput): Promise<void> {
    await this.p.webAppTaxonomy.create({
      data: {
        id: row.id,
        slug: row.slug,
        origin: row.origin,
        displayName: row.displayName,
        centroidVectorJson: row.centroidVectorJson,
        capabilityTemplateJson: row.capabilityTemplateJson,
        confidence: row.confidence,
        sampleCount: row.sampleCount,
      },
    })
  }

  async incrementSampleCount(id: string): Promise<void> {
    await this.p.webAppTaxonomy.update({
      where: { id },
      data: { sampleCount: { increment: 1 } },
    })
  }

  private rowToContract(row: Record<string, unknown>): WebAppTaxonomyRow {
    return {
      id: row.id as string,
      slug: row.slug as string,
      origin: row.origin as 'curated' | 'auto_generated',
      displayName: row.displayName as string,
      centroidVectorJson: row.centroidVectorJson as string,
      capabilityTemplateJson: row.capabilityTemplateJson as string,
      confidence: row.confidence as number,
      sampleCount: row.sampleCount as number,
    }
  }
}
