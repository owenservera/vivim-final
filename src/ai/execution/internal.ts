/**
 * VIVIM AI Gateway — Execution Manager Internal Interface
 * @module ai/execution/internal
 *
 * The frozen IExecutionManager interface (in manager.ts) is the public contract.
 * The gateway needs a few internal methods to drive the state machine and
 * forward events. This interface extends IExecutionManager with those internal
 * methods, so the gateway can use them without polluting the public contract.
 *
 * The InMemoryExecutionManager (and any future persistent impl) implements
 * BOTH interfaces. The factory passes the same instance typed as
 * IExecutionManagerInternal to the gateway.
 */

import type { AIError, AIEvent, ModelId, ProviderId } from '../core/types.js'
import type { IExecutionManager } from './manager.js'
import type { AIExecution, ExecutionId } from './types.js'

export interface IExecutionManagerInternal extends IExecutionManager {
  /** Transition execution state with validation. */
  transition(executionId: ExecutionId, to: AIExecution['state']): Promise<void>
  /** Record provider selection for an execution. */
  recordProviderSelection(
    executionId: ExecutionId,
    providerId: ProviderId,
    modelId: ModelId,
    attempt: number,
  ): Promise<void>
  /** Record a forwarded AIEvent for an execution. */
  recordAIEvent(executionId: ExecutionId, event: AIEvent): void
  /** Mark an execution completed. */
  recordCompleted(executionId: ExecutionId): Promise<void>
  /** Mark an execution failed. */
  recordFailed(executionId: ExecutionId, error: AIError, willRetry: boolean): Promise<void>
}
