// src/storage/impl/situation-store-impl.ts
// Prisma-backed SituationStore implementation.
// User preferences are stored in-memory (lightweight, no dedicated table in schema).

import type { PrismaClient } from '@prisma/client'
import type {
  SituationLogInput,
  SituationStore,
  UserPreferenceInput,
} from '../contracts/situation-store.js'

export class SituationStoreImpl implements SituationStore {
  private preferences = new Map<string, Array<{ key: string; value: string }>>()

  constructor(private prisma: PrismaClient) {}

  async createLog(log: SituationLogInput): Promise<void> {
    await this.prisma.situationLog.create({
      data: {
        id: log.id,
        conversationId: log.conversationId,
        detectedType: log.detectedType,
        confidence: log.confidence,
        signalsJson: log.signalsJson,
        timestamp: log.timestamp,
      },
    })
  }

  async getRecentForConversation(
    conversationId: string,
    limit = 10,
  ): Promise<Array<{ detectedType: string; confidence: number; timestamp: number }>> {
    return this.prisma.situationLog.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        detectedType: true,
        confidence: true,
        timestamp: true,
      },
    })
  }

  async createUserPreference(input: UserPreferenceInput): Promise<void> {
    const existing = this.preferences.get(input.userId) ?? []
    // Replace existing key or add new
    const filtered = existing.filter((p) => p.key !== input.key)
    filtered.push({ key: input.key, value: input.value })
    this.preferences.set(input.userId, filtered)
  }

  async getUserPreferences(userId: string): Promise<Array<{ key: string; value: string }>> {
    return this.preferences.get(userId) ?? []
  }
}
