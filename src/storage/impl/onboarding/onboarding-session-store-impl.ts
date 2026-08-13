// src/storage/impl/onboarding/onboarding-session-store-impl.ts
// Prisma-backed implementation of OnboardingSessionStoreContract.
// Audit 🚀-6 / 🚀-11 — supports idempotency (`findBySlaveOriginShape`) and
// resumable orchestrator (`updateStageOutput`).

import type {
  OnboardingSessionCreateInput,
  OnboardingSessionRow,
  OnboardingSessionStoreContract,
} from '../../contracts/onboarding/onboarding-session-store.js'
import type { PrismaClient } from '../../../prisma.js'
import type { CapStoreDb } from '../../db.js'

export class OnboardingSessionStoreImpl implements OnboardingSessionStoreContract {
  private db: PrismaClient

  constructor(db: CapStoreDb) {
    this.db = db.prisma
  }

  private get p() {
    return this.db
  }

  async create(input: OnboardingSessionCreateInput): Promise<void> {
    await this.p.providerOnboardingSession?.create?.({
      data: {
        id: input.id,
        slaveId: input.slaveId,
        targetOrigin: input.targetOrigin,
        status: input.status,
        wfvShapeSignature: input.wfvShapeSignature ?? null,
      },
    })
  }

  async getById(id: string): Promise<OnboardingSessionRow | null> {
    const row = (await this.p.providerOnboardingSession?.findUnique?.({ where: { id } })) as Record<
      string,
      unknown
    > | null
    return row ? this.rowToContract(row) : null
  }

  async findBySlaveOriginShape(
    slaveId: string,
    targetOrigin: string,
    wfvShapeSignature: string,
  ): Promise<OnboardingSessionRow | null> {
    const row = (await this.p.providerOnboardingSession?.findUnique?.({
      where: {
        slaveId_targetOrigin_wfvShapeSignature: { slaveId, targetOrigin, wfvShapeSignature },
      },
    })) as Record<string, unknown> | null
    return row ? this.rowToContract(row) : null
  }

  async updateStatus(id: string, status: string, extra?: Record<string, unknown>): Promise<void> {
    await this.p.providerOnboardingSession?.update?.({
      where: { id },
      data: { status, ...extra },
    })
  }

  async updateStageOutput(
    id: string,
    fields: Partial<
      Pick<
        OnboardingSessionRow,
        | 'wfvJson'
        | 'taxonomyId'
        | 'discoveredEntitiesJson'
        | 'parserCandidatesJson'
        | 'protocolFingerprintJson'
        | 'providerId'
      >
    >,
  ): Promise<void> {
    await this.p.providerOnboardingSession?.update?.({
      where: { id },
      data: fields,
    })
  }

  async fail(id: string, reason: string): Promise<void> {
    await this.p.providerOnboardingSession?.update?.({
      where: { id },
      data: {
        status: 'failed',
        errorJson: JSON.stringify({ reason, failedAt: new Date().toISOString() }),
      },
    })
  }

  async complete(id: string, providerId: string): Promise<void> {
    await this.p.providerOnboardingSession?.update?.({
      where: { id },
      data: {
        status: 'registered',
        providerId,
        completedAt: new Date(),
      },
    })
  }

  private rowToContract(row: Record<string, unknown>): OnboardingSessionRow {
    return {
      id: row.id as string,
      providerId: (row.providerId as string | null) ?? null,
      slaveId: row.slaveId as string,
      targetOrigin: row.targetOrigin as string,
      status: row.status as string,
      wfvJson: (row.wfvJson as string | null) ?? null,
      wfvShapeSignature: (row.wfvShapeSignature as string | null) ?? null,
      taxonomyId: (row.taxonomyId as string | null) ?? null,
      discoveredEntitiesJson: (row.discoveredEntitiesJson as string | null) ?? null,
      parserCandidatesJson: (row.parserCandidatesJson as string | null) ?? null,
      protocolFingerprintJson: (row.protocolFingerprintJson as string | null) ?? null,
      errorJson: (row.errorJson as string | null) ?? null,
      startedAt: row.startedAt as Date,
      completedAt: (row.completedAt as Date | null) ?? null,
    }
  }
}
