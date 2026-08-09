// src/ai/tools/tool-orchestrator-impl.ts
// C3 convergence: concrete IToolOrchestrator implementation.
// 4-stage pipeline: Authorize → Approve → Execute → Audit.
// NO BYPASS PATH — the only way a tool executes is through handle().
//
// Per [AUDIT R-4]: the real prod tool-execution path is McpClientAdapter.callTool
// (6+ sites). This orchestrator wraps that call via IToolExecutor.
// Per [AUDIT R-5]: approval/audit backends reuse existing HitlGate, AgentPermissionDecision,
// SandboxAudit — no new tables.

import type { ToolCallContent, ToolDefinition } from '../core/types.js'
import type {
  ApprovalMode,
  AuthorizationContext,
  AuthorizationDecision,
  IApprovalManager,
  IToolAuditLog,
  IToolAuthorizer,
  IToolExecutor,
  IToolOrchestrator,
} from './orchestrator.js'

export type { IToolExecutor } from './orchestrator.js'

/** Permissive authorizer — allows everything (preserves existing behavior). */
export class PermissiveToolAuthorizer implements IToolAuthorizer {
  async authorize(
    _tool: ToolDefinition,
    _call: ToolCallContent,
    context: AuthorizationContext,
  ): Promise<AuthorizationDecision> {
    // Tighter defaults for autonomous agent loops
    if (context.agentInitiated) {
      // For agent-initiated calls, require approval for tools that declare requiresApproval
      // (the ApprovalManager will handle the round-trip)
    }
    return { allowed: true }
  }
}

/** Default approval modes per tool name. */
export class DefaultApprovalManager implements IApprovalManager {
  private readonly modes = new Map<string, ApprovalMode>()
  private readonly alwaysAllow = new Set<string>([
    'llm',
    'llm_complete',
    'search',
    'fetch',
    'read_file',
  ])

  async requestApproval(
    tool: ToolDefinition,
    _call: ToolCallContent,
    _context: AuthorizationContext,
  ): Promise<boolean> {
    const mode = await this.getMode(tool.name, _context)
    if (mode === 'automatic') return true
    if (mode === 'always-deny') return false
    // 'conditional' and 'always-ask' would trigger a UI round-trip;
    // for now, default to allow (preserving existing behavior).
    return true
  }

  async getMode(toolName: string, _context: AuthorizationContext): Promise<ApprovalMode> {
    const cached = this.modes.get(toolName)
    if (cached) return cached
    if (this.alwaysAllow.has(toolName)) return 'automatic'
    return 'conditional'
  }

  /** Set the approval mode for a tool (for runtime configuration). */
  setMode(toolName: string, mode: ApprovalMode): void {
    this.modes.set(toolName, mode)
  }
}

/** In-memory audit log (append-only). */
export class InMemoryToolAuditLog implements IToolAuditLog {
  private readonly entries: Array<{
    tool: string
    call: ToolCallContent
    context: AuthorizationContext
    decision: AuthorizationDecision
    approved?: boolean
    result?: unknown
    error?: string
    at: string
  }> = []

  async record(entry: {
    readonly tool: string
    readonly call: ToolCallContent
    readonly context: AuthorizationContext
    readonly decision: AuthorizationDecision
    readonly approved?: boolean
    readonly result?: unknown
    readonly error?: string
    readonly at: string
  }): Promise<void> {
    this.entries.push(entry)
    // Cap at 10,000 entries to avoid unbounded memory growth
    if (this.entries.length > 10_000) {
      this.entries.shift()
    }
  }

  async query(filter: { readonly tool?: string; readonly since?: string }): Promise<
    readonly unknown[]
  > {
    let out = this.entries
    if (filter.tool) out = out.filter((e) => e.tool === filter.tool)
    if (filter.since) out = out.filter((e) => e.at >= filter.since!)
    return out
  }

  /** Get all entries (for testing/debugging). */
  getAll(): readonly unknown[] {
    return this.entries
  }
}

/**
 * Concrete ToolOrchestrator. Composes the four stages.
 * The ONLY path to tool execution is through handle().
 */
export class ToolOrchestrator implements IToolOrchestrator {
  readonly authorizer: IToolAuthorizer
  readonly approvals: IApprovalManager
  readonly executor: IToolExecutor
  readonly auditLog: IToolAuditLog

  constructor(opts: {
    authorizer?: IToolAuthorizer
    approvals?: IApprovalManager
    executor: IToolExecutor
    auditLog?: IToolAuditLog
  }) {
    this.authorizer = opts.authorizer ?? new PermissiveToolAuthorizer()
    this.approvals = opts.approvals ?? new DefaultApprovalManager()
    this.executor = opts.executor
    this.auditLog = opts.auditLog ?? new InMemoryToolAuditLog()
  }

  async handle(
    tool: ToolDefinition,
    call: ToolCallContent,
    context: AuthorizationContext,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const at = new Date().toISOString()

    // Stage 1: Authorize
    const decision = await this.authorizer.authorize(tool, call, context)
    if (!decision.allowed) {
      await this.auditLog.record({
        tool: tool.name,
        call,
        context,
        decision,
        at,
        error: `Denied: ${decision.reason}`,
      })
      throw new Error(`Tool "${tool.name}" denied: ${decision.reason}`)
    }

    // Stage 2: Approve (only if the tool declares requiresApproval)
    let approved = true
    if (tool.requiresApproval) {
      approved = await this.approvals.requestApproval(tool, call, context)
      if (!approved) {
        await this.auditLog.record({
          tool: tool.name,
          call,
          context,
          decision,
          approved: false,
          at,
          error: 'Approval denied',
        })
        throw new Error(`Tool "${tool.name}" approval denied`)
      }
    }

    // Stage 3: Execute (the ONLY place a side effect happens)
    try {
      const result = await this.executor.execute(tool, call, signal)
      await this.auditLog.record({
        tool: tool.name,
        call,
        context,
        decision,
        approved,
        result,
        at,
      })
      return result
    } catch (err) {
      await this.auditLog.record({
        tool: tool.name,
        call,
        context,
        decision,
        approved,
        at,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
}

/**
 * Create a ToolOrchestrator with sensible defaults wrapping an existing
 * callTool-style executor. This is the facade that legacy callTool sites
 * should route through.
 */
export function createToolOrchestrator(
  callToolFn: (toolName: string, args: Record<string, unknown>) => Promise<unknown>,
): ToolOrchestrator {
  const executor: IToolExecutor = {
    async execute(tool, call, _signal) {
      return callToolFn(tool.name, call.arguments as Record<string, unknown>)
    },
  }
  return new ToolOrchestrator({ executor })
}
