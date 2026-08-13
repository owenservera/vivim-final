// src/storage/impl/onboarding/discovered-dom-entity-store-impl.ts
import type {
  DiscoveredDomEntityCreateInput,
  DiscoveredDomEntityRow,
  DiscoveredDomEntityStoreContract,
} from '../../contracts/onboarding/discovered-dom-entity-store.js'
import type { PrismaClient } from '../../../prisma.js'
import type { CapStoreDb } from '../../db.js'

export class DiscoveredDomEntityStoreImpl implements DiscoveredDomEntityStoreContract {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async create(row: DiscoveredDomEntityCreateInput): Promise<void> {
    await this.p.discoveredDomEntity.create({
      data: {
        id: row.id,
        sessionId: row.sessionId,
        role: row.role,
        selectorJson: row.selectorJson,
        confidence: row.confidence,
        status: row.status,
      },
    })
  }

  async listBySession(sessionId: string): Promise<DiscoveredDomEntityRow[]> {
    const rows = (await this.p.discoveredDomEntity.findMany({
      where: { sessionId },
      orderBy: { id: 'asc' },
    })) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: row.id as string,
      sessionId: row.sessionId as string,
      role: row.role as string,
      selectorJson: row.selectorJson as string,
      confidence: row.confidence as number,
      testedAt: (row.testedAt as Date | null) ?? null,
      status: row.status as string,
    }))
  }

  async updateStatus(id: string, status: string, confidence: number): Promise<void> {
    await this.p.discoveredDomEntity.update({
      where: { id },
      data: { status, confidence, testedAt: new Date() },
    })
  }
}
