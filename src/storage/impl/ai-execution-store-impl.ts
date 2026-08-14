// src/storage/impl/ai-execution-store-impl.ts
// Prisma-backed implementation of AIExecutionStore.
// All writes are additive — never touches ProviderDefinition/ProviderModel tables.

import type { PrismaClient } from '@prisma/client'
import type {
  ModelId,
  ProviderId,
  RequestId,
  RequestPriority,
  SessionId,
} from '../../ai/core/types.js'
import type {
  AIExecution,
  ExecutionEvent,
  ExecutionId,
  ExecutionState,
} from '../../ai/execution/types.js'
import type {
  AIExecutionEventRow,
  AIExecutionRow,
  AIExecutionStore,
} from '../contracts/ai-execution-store.js'

export class AIExecutionStoreImpl implements AIExecutionStore {
  constructor(private readonly prisma: PrismaClient) {}

  async createExecution(execution: AIExecution): Promise<void> {
    await this.prisma.aIExecution.create({
      data: {
        id: execution.id,
        requestId: execution.requestId,
        sessionId: execution.sessionId ?? null,
        state: execution.state,
        priority: execution.priority,
        providerId: execution.providerId ?? null,
        modelId: execution.modelId ?? null,
        attempt: execution.attempt,
        createdAt: execution.createdAt,
        startedAt: execution.startedAt ?? null,
        completedAt: execution.completedAt ?? null,
      },
    })
  }

  async updateExecution(executionId: ExecutionId, patch: Partial<AIExecution>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.state !== undefined) data.state = patch.state
    if (patch.providerId !== undefined) data.providerId = patch.providerId
    if (patch.modelId !== undefined) data.modelId = patch.modelId
    if (patch.attempt !== undefined) data.attempt = patch.attempt
    if (patch.startedAt !== undefined) data.startedAt = patch.startedAt
    if (patch.completedAt !== undefined) data.completedAt = patch.completedAt
    if (patch.error !== undefined) {
      data.errorCode = patch.error.code
      data.errorMessage = patch.error.message
      data.errorRetryable = patch.error.retryable
    }
    if (patch.usage !== undefined) {
      data.inputTokens = patch.usage.inputTokens
      data.outputTokens = patch.usage.outputTokens
      data.totalTokens = patch.usage.totalTokens
    }
    if (Object.keys(data).length === 0) return
    await this.prisma.aIExecution.update({
      where: { id: executionId },
      data,
    })
  }

  async getExecution(executionId: ExecutionId): Promise<AIExecutionRow | undefined> {
    const row = await this.prisma.aIExecution.findUnique({ where: { id: executionId } })
    return row ? this.toRow(row) : undefined
  }

  async getByRequest(requestId: RequestId): Promise<AIExecutionRow | undefined> {
    const row = await this.prisma.aIExecution.findFirst({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
    })
    return row ? this.toRow(row) : undefined
  }

  async listExecutions(filter?: {
    state?: ExecutionState
    providerId?: ProviderId
    sessionId?: SessionId
    priority?: RequestPriority
    limit?: number
  }): Promise<AIExecutionRow[]> {
    const where: Record<string, unknown> = {}
    if (filter?.state) where.state = filter.state
    if (filter?.providerId) where.providerId = filter.providerId
    if (filter?.sessionId) where.sessionId = filter.sessionId
    if (filter?.priority) where.priority = filter.priority
    const rows = await this.prisma.aIExecution.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter?.limit ?? 100,
    })
    return rows.map((r) => this.toRow(r))
  }

  async appendEvent(executionId: ExecutionId, event: ExecutionEvent): Promise<void> {
    const seq = event.type === 'execution.ai-event' ? event.event.sequence : Date.now()
    await this.prisma.aIExecutionEvent.create({
      data: {
        id: crypto.randomUUID(),
        executionId,
        sequence: seq,
        timestamp: new Date().toISOString(),
        type: event.type,
        payloadJson: JSON.stringify(event),
      },
    })
  }

  async listEvents(executionId: ExecutionId): Promise<AIExecutionEventRow[]> {
    const rows = await this.prisma.aIExecutionEvent.findMany({
      where: { executionId },
      orderBy: { sequence: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      executionId: r.executionId as ExecutionId,
      sequence: r.sequence,
      timestamp: r.timestamp,
      type: r.type,
      payloadJson: r.payloadJson,
    }))
  }

  async setProviderState(
    providerId: ProviderId,
    state: string,
    patch?: { integrityHash?: string; signature?: string; certifiedAt?: string },
  ): Promise<void> {
    const now = new Date().toISOString()
    await this.prisma.aIProviderInstance.upsert({
      where: { id: providerId },
      create: {
        id: providerId,
        pluginId: `plugin:${providerId}`,
        name: providerId,
        version: '1.0.0',
        protocolVersion: '1.1',
        kind: 'local',
        trust: 'official',
        state,
        installedAt: now,
        updatedAt: now,
        integrityHash: patch?.integrityHash,
        signature: patch?.signature,
        certifiedAt: patch?.certifiedAt,
      },
      update: {
        state,
        updatedAt: now,
        ...(patch?.integrityHash !== undefined ? { integrityHash: patch.integrityHash } : {}),
        ...(patch?.signature !== undefined ? { signature: patch.signature } : {}),
        ...(patch?.certifiedAt !== undefined ? { certifiedAt: patch.certifiedAt } : {}),
      },
    })
  }

  async getProviderState(providerId: ProviderId): Promise<string | undefined> {
    const row = await this.prisma.aIProviderInstance.findUnique({
      where: { id: providerId },
      select: { state: true },
    })
    return row?.state
  }

  async listProviderInstances(filter?: { state?: string; kind?: string }): Promise<
    Array<{
      id: string
      name: string
      kind: string
      trust: string
      state: string
    }>
  > {
    const where: Record<string, unknown> = {}
    if (filter?.state) where.state = filter.state
    if (filter?.kind) where.kind = filter.kind
    const rows = await this.prisma.aIProviderInstance.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      trust: r.trust,
      state: r.state,
    }))
  }

  private toRow(r: any): AIExecutionRow {
    return {
      id: r.id as ExecutionId,
      requestId: r.requestId as RequestId,
      sessionId: r.sessionId as SessionId | undefined,
      state: r.state as ExecutionState,
      priority: r.priority as RequestPriority,
      providerId: r.providerId as ProviderId | undefined,
      modelId: r.modelId as ModelId,
      attempt: r.attempt,
      createdAt: r.createdAt,
      startedAt: r.startedAt ?? undefined,
      completedAt: r.completedAt ?? undefined,
      errorCode: r.errorCode ?? undefined,
      errorMessage: r.errorMessage ?? undefined,
      errorRetryable: r.errorRetryable ?? undefined,
      inputTokens: r.inputTokens ?? undefined,
      outputTokens: r.outputTokens ?? undefined,
      totalTokens: r.totalTokens ?? undefined,
    }
  }
}
