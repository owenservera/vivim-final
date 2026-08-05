/**
 * shared/shell-command.ts
 * --------------------------------------------------------------------
 * CLI two-way bridge types. The canvas shell sends a CLI command string
 * to `cap:canvas:shell-command`, which dispatches it through the same
 * UnifiedCapabilityRegistry / CommandRegistry path the thin CLI client
 * uses. Output streams back to the canvas node as a card.
 *
 * Invariant: ONE ENTRY POINT. The CLI surface and the canvas surface
 * use the SAME capability (`cap:canvas:shell-command`) — no second
 * transport (invariant 5).
 */

export interface ShellCommandInput {
  /** Raw command line, e.g. "admin db status" or "list conversations --provider=chatgpt". */
  command: string
  /** Workspace context (so the command knows where it's running). */
  workspaceId?: string
  /** User invoking the command. */
  userId?: string
  /** Abort the previous invocation when true. */
  abort?: boolean
}

export interface ShellCommandOutputChunk {
  traceId: string
  sequence: number
  kind: 'stdout' | 'stderr' | 'status' | 'complete' | 'error'
  text?: string
  status?: {
    exitCode: number | null
    durationMs: number
    capabilityId?: string
  }
  timestamp: number
}

export interface ShellCommandResult {
  traceId: string
  ok: boolean
  exitCode: number
  /** Full stdout (concatenated). */
  stdout: string
  /** Full stderr (concatenated). */
  stderr: string
  durationMs: number
  /** The capability id the command resolved to (for audit). */
  capabilityId?: string
}

/**
 * CommandRegistry entry (mirrors vivim-final's thin CLI client).
 * Each entry is a multi-word command pattern + handler.
 */
export interface CommandSpec {
  /** Command path, e.g. ['admin', 'db', 'status']. */
  path: string[]
  /** Short description. */
  description: string
  /** Capability id to dispatch. */
  capabilityId: string
  /** Argument schema (Zod or plain). */
  argSchema?: Record<string, unknown>
  /** Handler invoked when the command matches. */
  handler: (args: string[], ctx: ShellCommandContext) => Promise<ShellCommandResult>
}

export interface ShellCommandContext {
  workspaceId: string
  userId: string
  traceId: string
}
