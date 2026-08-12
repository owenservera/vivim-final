/**
 * storage/impl/prisma-onboarding-store.ts
 * --------------------------------------------------------------------
 * Prisma-backed implementation of OnboardingStore.
 * Persists tour state to the `user_onboarding` table so it survives
 * server restarts. BigInt ↔ Number conversion handled in deserialize().
 */

import type { OnboardingState } from '../../shared/onboarding'
import type { OnboardingStore } from '../contracts/onboarding-store'

interface UserOnboardingRow {
  id: string
  userId: string
  completedSteps: string
  dismissed: boolean
  lastShownAt: bigint | null
  lastCompletedAt: bigint | null
  tourTimings: string | null
  createdAt: bigint
  updatedAt: bigint
}

/**
 * Minimal Prisma-like interface to avoid importing the full client.
 * The real PrismaClient satisfies this shape.
 */
interface PrismaDelegate {
  findUnique(args: { where: { userId: string } }): Promise<UserOnboardingRow | null>
  upsert(args: {
    where: { userId: string }
    create: Record<string, unknown>
    update: Record<string, unknown>
  }): Promise<UserOnboardingRow>
}

export interface PrismaLike {
  userOnboarding: PrismaDelegate
  [key: string]: unknown
}

export class PrismaOnboardingStore implements OnboardingStore {
  constructor(private prisma: PrismaLike) {}

  async get(userId: string): Promise<OnboardingState | null> {
    const row = await this.prisma.userOnboarding.findUnique({ where: { userId } })
    return row ? this.deserialize(row) : null
  }

  async completeStep(userId: string, stepId: string): Promise<OnboardingState> {
    const existing = await this.prisma.userOnboarding.findUnique({ where: { userId } })
    const completedSteps: string[] = existing ? JSON.parse(existing.completedSteps) : []
    if (!completedSteps.includes(stepId)) {
      completedSteps.push(stepId)
    }
    const now = Date.now()
    const row = await this.prisma.userOnboarding.upsert({
      where: { userId },
      create: {
        userId,
        completedSteps: JSON.stringify(completedSteps),
        dismissed: false,
        lastShownAt: BigInt(now),
        lastCompletedAt: BigInt(now),
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      update: {
        completedSteps: JSON.stringify(completedSteps),
        lastShownAt: BigInt(now),
        lastCompletedAt: BigInt(now),
        updatedAt: BigInt(now),
      },
    })
    return this.deserialize(row)
  }

  async completeTour(
    userId: string,
    meta: { totalDurationMs: number; stepTimings: Record<string, number> },
  ): Promise<OnboardingState> {
    const now = Date.now()
    const existing = await this.prisma.userOnboarding.findUnique({ where: { userId } })
    const completedSteps: string[] = existing ? JSON.parse(existing.completedSteps) : []
    for (const stepId of Object.keys(meta.stepTimings)) {
      if (!completedSteps.includes(stepId)) completedSteps.push(stepId)
    }
    const row = await this.prisma.userOnboarding.upsert({
      where: { userId },
      create: {
        userId,
        completedSteps: JSON.stringify(completedSteps),
        dismissed: false,
        lastShownAt: BigInt(now),
        lastCompletedAt: BigInt(now),
        tourTimings: JSON.stringify(meta.stepTimings),
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      update: {
        completedSteps: JSON.stringify(completedSteps),
        lastShownAt: BigInt(now),
        lastCompletedAt: BigInt(now),
        tourTimings: JSON.stringify(meta.stepTimings),
        updatedAt: BigInt(now),
      },
    })
    return this.deserialize(row)
  }

  async dismiss(userId: string): Promise<OnboardingState> {
    const now = Date.now()
    const row = await this.prisma.userOnboarding.upsert({
      where: { userId },
      create: {
        userId,
        completedSteps: '[]',
        dismissed: true,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      update: {
        dismissed: true,
        updatedAt: BigInt(now),
      },
    })
    return this.deserialize(row)
  }

  async reset(userId: string): Promise<OnboardingState> {
    const now = Date.now()
    const row = await this.prisma.userOnboarding.upsert({
      where: { userId },
      create: {
        userId,
        completedSteps: '[]',
        dismissed: false,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      update: {
        completedSteps: '[]',
        dismissed: false,
        lastShownAt: null,
        lastCompletedAt: null,
        tourTimings: null,
        updatedAt: BigInt(now),
      },
    })
    return this.deserialize(row)
  }

  private deserialize(row: UserOnboardingRow): OnboardingState {
    return {
      userId: row.userId,
      completedSteps: JSON.parse(row.completedSteps) as string[],
      dismissed: row.dismissed,
      lastShownAt: row.lastShownAt !== null ? Number(row.lastShownAt) : undefined,
      lastCompletedAt: row.lastCompletedAt !== null ? Number(row.lastCompletedAt) : undefined,
      tourTimings: row.tourTimings
        ? (JSON.parse(row.tourTimings) as Record<string, number>)
        : undefined,
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    }
  }
}
