// src/storage/impl/parser-execution-log-store-impl.ts
// Prisma-backed ParserExecutionLogStore for parser diagnostic logging.

import { newId } from '../../ids.js'
import type {
  ParserExecutionLogRow,
  ParserExecutionLogStore,
} from '../contracts/parser-execution-log-store.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = any

function toLogRow(r: any): ParserExecutionLogRow {
  return {
    id: r.id,
    providerId: r.providerId,
    parserName: r.parserName,
    parserVersion: r.parserVersion,
    conversationId: r.conversationId,
    messageId: r.messageId,
    confidence: r.confidence,
    blockCount: r.blockCount,
    textBlocks: r.textBlocks,
    toolCallBlocks: r.toolCallBlocks,
    fileBlocks: r.fileBlocks,
    errorBlocks: r.errorBlocks,
    durationMs: r.durationMs,
    rawSizeBytes: r.rawSizeBytes,
    wireFormat: r.wireFormat,
    fallbackUsed: r.fallbackUsed,
    metadataJson: r.metadataJson,
    createdAt: r.createdAt,
  }
}

export class ParserExecutionLogStoreImpl implements ParserExecutionLogStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db.loose
  }

  private get p() {
    return this.db.prisma
  }

  async logExecution(row: Omit<ParserExecutionLogRow, 'id' | 'createdAt'>): Promise<void> {
    const now = Date.now()
    await this.p.parserExecutionLog.create({
      data: {
        id: newId(),
        providerId: row.providerId,
        parserName: row.parserName,
        parserVersion: row.parserVersion,
        conversationId: row.conversationId,
        messageId: row.messageId,
        confidence: row.confidence,
        blockCount: row.blockCount,
        textBlocks: row.textBlocks,
        toolCallBlocks: row.toolCallBlocks,
        fileBlocks: row.fileBlocks,
        errorBlocks: row.errorBlocks,
        durationMs: row.durationMs,
        rawSizeBytes: row.rawSizeBytes,
        wireFormat: row.wireFormat,
        fallbackUsed: row.fallbackUsed,
        metadataJson: row.metadataJson,
        createdAt: now,
      },
    })
  }

  async getRecentByProvider(providerId: string, limit = 20): Promise<ParserExecutionLogRow[]> {
    const rows = await this.p.parserExecutionLog.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toLogRow)
  }

  async getLowConfidenceEntries(threshold = 0.7, limit = 50): Promise<ParserExecutionLogRow[]> {
    const rows = await this.p.parserExecutionLog.findMany({
      where: { confidence: { lt: threshold } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toLogRow)
  }

  async getStatsByProvider(providerId: string): Promise<{
    totalExecutions: number
    avgConfidence: number
    avgDurationMs: number
    fallbackRate: number
  } | null> {
    const rows = await this.p.parserExecutionLog.findMany({
      where: { providerId },
      select: {
        confidence: true,
        durationMs: true,
        fallbackUsed: true,
      },
    })
    if (rows.length === 0) return null
    const total = rows.length
    const avgConf =
      rows.reduce((s: number, r: Record<string, unknown>) => s + (r.confidence as number), 0) /
      total
    const avgDur =
      rows.reduce((s: number, r: Record<string, unknown>) => s + (r.durationMs as number), 0) /
      total
    const fallbacks = rows.filter((r: any) => r.fallbackUsed).length
    return {
      totalExecutions: total,
      avgConfidence: avgConf,
      avgDurationMs: avgDur,
      fallbackRate: fallbacks / total,
    }
  }
}
