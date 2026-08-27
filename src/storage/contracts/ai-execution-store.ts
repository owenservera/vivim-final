// src/storage/contracts/ai-execution-store.ts
// Contract for persisting AI Gateway executions + events.
// Implements the same shape as IExecutionManager but with persistence.
// The in-memory IExecutionManager wraps this as a caching layer.

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

export interface AIExecutionRow {
  id: ExecutionId
  requestId: RequestId
  sessionId?: SessionId
  state: ExecutionState
  priority: RequestPriority
  providerId?: ProviderId
  modelId?: ModelId
  attempt: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  errorCode?: string
  errorMessage?: string
  errorRetryable?: boolean
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface AIExecutionEventRow {
  id: string
  executionId: ExecutionId
  sequence: number
  timestamp: string
  type: string
  payloadJson: string
}

export interface AIExecutionStore {
  createExecution(execution: AIExecution): Promise<void>
  updateExecution(executionId: ExecutionId, patch: Partial<AIExecution>): Promise<void>
  getExecution(executionId: ExecutionId): Promise<AIExecutionRow | undefined>
  getByRequest(requestId: RequestId): Promise<AIExecutionRow | undefined>
  listExecutions(filter?: {
    state?: ExecutionState
    providerId?: ProviderId
    sessionId?: SessionId
    priority?: RequestPriority
    limit?: number
  }): Promise<AIExecutionRow[]>

  appendEvent(executionId: ExecutionId, event: ExecutionEvent): Promise<void>
  listEvents(executionId: ExecutionId): Promise<AIExecutionEventRow[]>

  setProviderState(
    providerId: ProviderId,
    state: string,
    patch?: { integrityHash?: string; signature?: string; certifiedAt?: string },
  ): Promise<void>
  getProviderState(providerId: ProviderId): Promise<string | undefined>
  listProviderInstances(filter?: { state?: string; kind?: string }): Promise<
    Array<{
      id: string
      name: string
      kind: string
      trust: string
      state: string
    }>
  >
}
