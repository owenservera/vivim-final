// src/engines/lifecycle-engine.ts
// LifecycleEngine — manages TTL-based data expiration and cleanup

import { getLogger } from '../lib/logger.js'
import type { CapStoreDb } from '../storage/db.js'

const log = getLogger('lifecycle-engine')

export interface LifecycleEngineConfig {
  sweepIntervalMs: number
  batchSize: number
}

export class LifecycleEngine {
  private intervalId?: ReturnType<typeof setInterval>
  private isRunning = false

  constructor(
    private db: CapStoreDb,
    private config: LifecycleEngineConfig = {
      sweepIntervalMs: 60_000, // 1 minute
      batchSize: 1000,
    },
  ) {}

  start(): void {
    if (this.isRunning) {
      log.warn('LifecycleEngine already running')
      return
    }

    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.sweepExpired().catch((err) => {
        log.error({ err }, 'TTL sweep failed')
      })
    }, this.config.sweepIntervalMs)

    log.info('LifecycleEngine started')
  }

  stop(): void {
    if (!this.isRunning) return

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    this.isRunning = false
    log.info('LifecycleEngine stopped')
  }

  async sweepExpired(): Promise<{ messagesDeleted: number; nodesDeleted: number }> {
    const now = Date.now()
    const messagesDeleted = await this.sweepExpiredMessages(now)
    const nodesDeleted = await this.sweepExpiredNodes(now)

    if (messagesDeleted > 0 || nodesDeleted > 0) {
      log.info({ messagesDeleted, nodesDeleted }, 'TTL sweep completed')
    }

    return { messagesDeleted, nodesDeleted }
  }

  private async sweepExpiredMessages(now: number): Promise<number> {
    let totalDeleted = 0
    let hasMore = true

    while (hasMore) {
      const result = await this.db.prisma.$executeRaw`
        DELETE FROM conversation_message
        WHERE expires_at IS NOT NULL
          AND expires_at < ${now}
        LIMIT ${this.config.batchSize}
      `
      totalDeleted += result
      hasMore = result === this.config.batchSize
    }

    return totalDeleted
  }

  private async sweepExpiredNodes(now: number): Promise<number> {
    let totalDeleted = 0
    let hasMore = true

    while (hasMore) {
      const result = await this.db.prisma.$executeRaw`
        DELETE FROM node
        WHERE expires_at IS NOT NULL
          AND expires_at < ${now}
        LIMIT ${this.config.batchSize}
      `
      totalDeleted += result
      hasMore = result === this.config.batchSize
    }

    return totalDeleted
  }

  async setTTLForMessage(messageId: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000
    await this.db.prisma.conversationMessage.update({
      where: { id: messageId },
      data: {
        expiresAt: BigInt(expiresAt),
        ttlSeconds,
      },
    })
  }

  async setTTLForNode(nodeId: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000
    await this.db.prisma.node.update({
      where: { id: nodeId },
      data: {
        expiresAt: BigInt(expiresAt),
        ttlSeconds,
      },
    })
  }

  async clearTTLForMessage(messageId: string): Promise<void> {
    await this.db.prisma.conversationMessage.update({
      where: { id: messageId },
      data: {
        expiresAt: null,
        ttlSeconds: null,
      },
    })
  }

  async clearTTLForNode(nodeId: string): Promise<void> {
    await this.db.prisma.node.update({
      where: { id: nodeId },
      data: {
        expiresAt: null,
        ttlSeconds: null,
      },
    })
  }
}
