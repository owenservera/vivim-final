/**
 * VIVIM AI Gateway — Execution Model
 * @module ai/execution/types
 *
 * An AIRequest is intent. An AIExecution is what actually happened when
 * VIVIM tried to fulfil that intent — which provider was picked, whether it
 * crashed and was retried on a fallback, how long it queued, what tool calls
 * ran. Collapsing these into one object (as both prior drafts did implicitly)
 * makes concurrency, retries, hot-swap draining, and replay all much harder
 * to reason about, because "the request" and "this attempt at the request"
 * end up sharing one mutable-feeling identity.
 */

import type { AIError, AIEvent, ModelId, ProviderId, RequestId, RequestPriority, SessionId } from '../core/types';

export type ExecutionId = string & { readonly __brand: 'ExecutionId' };
export const executionId = (v: string): ExecutionId => v as ExecutionId;

export type ExecutionState =
  | 'created' | 'queued' | 'routing' | 'starting' | 'executing'
  | 'waiting-tool' | 'draining' | 'completed' | 'failed' | 'cancelled';

/**
 * Legal transitions. Executors and tests should validate against this
 * rather than each hand-rolling their own state machine.
 */
export const EXECUTION_TRANSITIONS: Readonly<Record<ExecutionState, readonly ExecutionState[]>> = {
  created: ['queued', 'cancelled'],
  queued: ['routing', 'cancelled'],
  routing: ['starting', 'failed', 'cancelled'],
  starting: ['executing', 'failed', 'cancelled'],
  executing: ['waiting-tool', 'draining', 'completed', 'failed', 'cancelled'],
  'waiting-tool': ['executing', 'failed', 'cancelled'],
  draining: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: ExecutionState, to: ExecutionState): boolean {
  return EXECUTION_TRANSITIONS[from].includes(to);
}

export interface AIExecution {
  readonly id: ExecutionId;
  readonly requestId: RequestId;
  readonly sessionId?: SessionId;

  readonly state: ExecutionState;
  readonly priority: RequestPriority;

  readonly providerId?: ProviderId;
  readonly modelId?: ModelId;

  /** Incremented on every provider fallback within this same logical execution. */
  readonly attempt: number;

  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;

  readonly error?: AIError;

  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
  };
}

export type ExecutionEvent =
  | { readonly type: 'execution.created'; readonly execution: AIExecution }
  | { readonly type: 'execution.state-changed'; readonly executionId: ExecutionId; readonly from: ExecutionState; readonly to: ExecutionState; readonly at: string }
  | { readonly type: 'execution.provider-selected'; readonly executionId: ExecutionId; readonly providerId: ProviderId; readonly modelId: ModelId; readonly attempt: number }
  | { readonly type: 'execution.ai-event'; readonly executionId: ExecutionId; readonly event: AIEvent }
  | { readonly type: 'execution.completed'; readonly executionId: ExecutionId }
  | { readonly type: 'execution.failed'; readonly executionId: ExecutionId; readonly error: AIError; readonly willRetry: boolean }
  | { readonly type: 'execution.cancelled'; readonly executionId: ExecutionId; readonly reason?: string };

export interface ExecutionSnapshot {
  readonly execution: AIExecution;
  readonly eventsReceived: number;
  readonly lastSequence: number;
}

export interface ExecutionHandle {
  readonly executionId: ExecutionId;
  readonly requestId: RequestId;
  readonly events: AsyncIterable<ExecutionEvent>;
  cancel(reason?: string): Promise<void>;
}

export interface ExecutionFilter {
  readonly state?: ExecutionState;
  readonly providerId?: ProviderId;
  readonly sessionId?: SessionId;
  readonly priority?: RequestPriority;
}
