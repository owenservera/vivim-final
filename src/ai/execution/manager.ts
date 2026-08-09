/**
 * VIVIM AI Gateway — Execution Manager Contract
 * @module ai/execution/manager
 *
 * Owns the lifecycle of AIExecution instances. Sits between the Gateway
 * (public API) and the Router/Adapter layer (actual work). This is where
 * concurrency, queueing-by-priority, fallback-on-provider-crash, and
 * cancellation propagation are implemented — none of that belongs in the
 * Gateway itself, and none of it belongs inside an adapter.
 */

import type { AIRequest, RequestId } from '../core/types.js'
import type {
  AIExecution,
  ExecutionFilter,
  ExecutionHandle,
  ExecutionId,
  ExecutionSnapshot,
} from './types.js'

export interface IExecutionManager {
  /** Creates and schedules an execution. Provider selection has NOT happened yet. */
  create(request: AIRequest): Promise<ExecutionHandle>

  get(executionId: ExecutionId): Promise<AIExecution | undefined>
  getByRequest(requestId: RequestId): Promise<AIExecution | undefined>
  list(filter?: ExecutionFilter): Promise<readonly AIExecution[]>

  /** Must propagate cancellation through the Router → Adapter → provider runtime, not just stop reading events. */
  cancel(executionId: ExecutionId, reason?: string): Promise<void>

  snapshot(executionId: ExecutionId): Promise<ExecutionSnapshot | undefined>

  /**
   * Gracefully transitions every non-terminal execution pinned to this
   * provider into 'draining', letting in-flight work finish (or fail over
   * to another provider per policy) without accepting new work on it.
   * This is the operation a hot provider swap or plugin uninstall calls
   * before the Runtime Supervisor is allowed to stop the process.
   */
  drainProvider(providerId: string): Promise<void>
}
