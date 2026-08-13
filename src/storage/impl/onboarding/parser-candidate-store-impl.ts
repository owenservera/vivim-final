// src/storage/impl/onboarding/parser-candidate-store-impl.ts
import type {
  ParserCandidateCreateInput,
  ParserCandidateRow,
  ParserCandidateStoreContract,
} from '../../contracts/onboarding/parser-candidate-store.js'
import type { PrismaClient } from '../../../prisma.js'
import type { CapStoreDb } from '../../db.js'

export class ParserCandidateStoreImpl implements ParserCandidateStoreContract {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async create(row: ParserCandidateCreateInput): Promise<void> {
    await this.p.parserCandidate.create({
      data: {
        id: row.id,
        sessionId: row.sessionId,
        protocolFingerprintId: row.protocolFingerprintId ?? null,
        inducedShapeJson: row.inducedShapeJson,
        confidence: row.confidence,
        sampleCount: row.sampleCount,
        status: row.status,
      },
    })
  }

  async listBySession(sessionId: string): Promise<ParserCandidateRow[]> {
    const rows = (await this.p.parserCandidate.findMany({
      where: { sessionId },
    })) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: row.id as string,
      sessionId: row.sessionId as string,
      protocolFingerprintId: (row.protocolFingerprintId as string | null) ?? null,
      inducedShapeJson: row.inducedShapeJson as string,
      parserProgramId: (row.parserProgramId as string | null) ?? null,
      confidence: row.confidence as number,
      sampleCount: row.sampleCount as number,
      status: row.status as string,
    }))
  }

  async updateStatus(id: string, status: string, confidence: number): Promise<void> {
    await this.p.parserCandidate.update({
      where: { id },
      data: { status, confidence },
    })
  }
}
