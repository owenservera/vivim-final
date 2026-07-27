// src/storage/impl/onboarding/protocol-fingerprint-store-impl.ts
import type {
  ProtocolFingerprintCreateInput,
  ProtocolFingerprintRow,
  ProtocolFingerprintStoreContract,
} from '../../contracts/onboarding/protocol-fingerprint-store.js'
import type { CapStoreDb } from '../../db.js'

export class ProtocolFingerprintStoreImpl implements ProtocolFingerprintStoreContract {
  private db: any

  constructor(db: CapStoreDb) {
    this.db = db as unknown as any
  }

  private get p(): any {
    return (this.db as { prisma: any }).prisma
  }

  async create(row: ProtocolFingerprintCreateInput): Promise<string> {
    const created = (await this.p.protocolFingerprint.create({
      data: {
        id: row.id,
        sessionId: row.sessionId,
        transportClass: row.transportClass,
        endpointPattern: row.endpointPattern,
        sampleHeadersJson: row.sampleHeadersJson,
        cadenceMs: row.cadenceMs,
        confidence: row.confidence,
      },
    })) as Record<string, unknown>
    return created.id as string
  }

  async getById(id: string): Promise<ProtocolFingerprintRow | null> {
    const row = (await this.p.protocolFingerprint.findUnique({ where: { id } })) as Record<
      string,
      unknown
    > | null
    return row ? this.rowToContract(row) : null
  }

  async listBySession(sessionId: string): Promise<ProtocolFingerprintRow[]> {
    const rows = (await this.p.protocolFingerprint.findMany({
      where: { sessionId },
    })) as Array<Record<string, unknown>>
    return rows.map(this.rowToContract)
  }

  private rowToContract(row: Record<string, unknown>): ProtocolFingerprintRow {
    return {
      id: row.id as string,
      sessionId: row.sessionId as string,
      transportClass: row.transportClass as string,
      endpointPattern: (row.endpointPattern as string | null) ?? null,
      sampleHeadersJson: (row.sampleHeadersJson as string | null) ?? null,
      cadenceMs: (row.cadenceMs as number | null) ?? null,
      confidence: row.confidence as number,
    }
  }
}
