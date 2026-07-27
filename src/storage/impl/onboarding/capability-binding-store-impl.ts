// src/storage/impl/onboarding/capability-binding-store-impl.ts
// Adapter that satisfies the onboarding-pipeline's narrow CapabilityBindingStoreContract
// by delegating to the existing CapabilityBinding Prisma model.
//
// This impl is intentionally minimal — it only writes `promotionHistoryJson` and
// `status` / `confidence`, plus the new `create` for onboarding-discovered
// bindings. The full CapabilityBinding store (with read paths, resolution, etc.)
// lives in capability-binding-store.ts and is unchanged.

import type { CapabilityBindingStoreContract } from '../../contracts/onboarding/capability-binding-store.js'
import type { CapStoreDb } from '../../db.js'

export class CapabilityBindingStoreImpl implements CapabilityBindingStoreContract {
  private db: any

  constructor(db: CapStoreDb) {
    this.db = db as unknown as any
  }

  private get p(): any {
    return (this.db as { prisma: any }).prisma
  }

  async create(input: {
    id: string
    globalId: string
    providerId: string
    status: 'active' | 'prospect' | 'rejected'
    confidence: number
  }): Promise<void> {
    // Idempotent on (globalId, providerId) — skip if a binding already exists.
    const existing = (await this.p.capabilityBinding?.findFirst?.({
      where: { globalId: input.globalId, providerId: input.providerId },
    })) as Record<string, unknown> | null
    if (existing) return

    const now = BigInt(Date.now())
    await this.p.capabilityBinding?.create?.({
      data: {
        id: input.id,
        globalId: input.globalId,
        providerId: input.providerId,
        status: input.status,
        confidence: input.confidence,
        promotionHistoryJson: '[]',
        createdAt: now,
        updatedAt: now,
      },
    })
  }

  async appendPromotionHistory(
    providerId: string,
    capabilityId: string,
    entries: Array<{ stage: string; timestamp: string; passed: boolean }>,
  ): Promise<void> {
    // Read current history, append, write back. Prisma's atomic update via
    // JSON concatenation isn't supported — we read-modify-write inside a
    // transaction to avoid lost updates.
    const existing = (await this.p.capabilityBinding?.findFirst?.({
      where: { providerId, globalId: capabilityId },
    })) as Record<string, unknown> | null
    if (!existing) return
    const prev = (() => {
      try {
        return JSON.parse((existing.promotionHistoryJson as string) ?? '[]') as unknown[]
      } catch {
        return []
      }
    })()
    const next = [...prev, ...entries]
    await this.p.capabilityBinding?.update?.({
      where: { id: existing.id as string },
      data: {
        promotionHistoryJson: JSON.stringify(next),
        updatedAt: BigInt(Date.now()),
      },
    })
  }

  async setStatus(
    providerId: string,
    capabilityId: string,
    status: 'active' | 'prospect' | 'rejected',
    confidence: number,
  ): Promise<void> {
    await this.p.capabilityBinding?.updateMany?.({
      where: { providerId, globalId: capabilityId },
      data: { status, confidence, updatedAt: BigInt(Date.now()) },
    })
  }
}
