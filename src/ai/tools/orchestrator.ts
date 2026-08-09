/**
 * VIVIM AI Gateway — Tool Orchestration
 * @module ai/tools/orchestrator
 *
 * Core invariant (from the PRD, and non-negotiable): model output is
 * untrusted data until authorized. A model proposing a tool call is a
 * request, not a command. This file makes each stage of
 * intent → authorize → approve → execute → audit its own seam, so a
 * prompt-injected tool call has to get past four independently testable
 * gates, not one big "toolExecutor.run()".
 */

import type { ToolCallContent, ToolDefinition, WorkspaceId } from '../core/types.js'

export type AuthorizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string; readonly requiresApproval?: boolean }

export interface AuthorizationContext {
  readonly workspaceId?: WorkspaceId
  readonly userId?: string
  /** True when this call originated from an autonomous agent loop rather than a direct, in-the-moment user turn — tighter defaults apply. */
  readonly agentInitiated: boolean
}

/** Stage 1 — permission-level check against the tool's declared ToolPermission[] and the active ExecutionPolicy. */
export interface IToolAuthorizer {
  authorize(
    tool: ToolDefinition,
    call: ToolCallContent,
    context: AuthorizationContext,
  ): Promise<AuthorizationDecision>
}

export type ApprovalMode = 'automatic' | 'conditional' | 'always-ask' | 'always-deny'

/** Stage 2 — only reached when Stage 1 returns requiresApproval. Owns the actual human-in-the-loop UI round trip. */
export interface IApprovalManager {
  requestApproval(
    tool: ToolDefinition,
    call: ToolCallContent,
    context: AuthorizationContext,
  ): Promise<boolean>
  getMode(toolName: string, context: AuthorizationContext): Promise<ApprovalMode>
}

/** Stage 3 — the only component allowed to actually perform the side effect, and only after Stages 1–2 pass. */
export interface IToolExecutor {
  execute(tool: ToolDefinition, call: ToolCallContent, signal?: AbortSignal): Promise<unknown>
}

/** Stage 4 — append-only, queried by the user-facing "what exactly did VIVIM do?" view. Never mutated after write. */
export interface IToolAuditLog {
  record(entry: {
    readonly tool: string
    readonly call: ToolCallContent
    readonly context: AuthorizationContext
    readonly decision: AuthorizationDecision
    readonly approved?: boolean
    readonly result?: unknown
    readonly error?: string
    readonly at: string
  }): Promise<void>

  query(filter: { readonly tool?: string; readonly since?: string }): Promise<readonly unknown[]>
}

/**
 * Composition root the Gateway actually calls. Wires the four stages in
 * order and guarantees the invariant above holds regardless of which
 * concrete authorizer/approval/executor implementations are plugged in.
 */
export interface IToolOrchestrator {
  readonly authorizer: IToolAuthorizer
  readonly approvals: IApprovalManager
  readonly executor: IToolExecutor
  readonly auditLog: IToolAuditLog

  /** Runs all four stages. Never calls executor.execute() itself if authorize() or approval fails — no bypass path. */
  handle(
    tool: ToolDefinition,
    call: ToolCallContent,
    context: AuthorizationContext,
    signal?: AbortSignal,
  ): Promise<unknown>
}
