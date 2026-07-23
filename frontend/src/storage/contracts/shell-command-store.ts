/**
 * storage/contracts/shell-command-store.ts
 * --------------------------------------------------------------------
 * CommandRegistry contract. The thin CLI client uses this to resolve
 * multi-word commands (`admin db status`) into a CommandSpec. The
 * canvas `cap:canvas:shell-command` capability dispatches through the
 * SAME registry (FRONTEND=BACKEND two-way, invariant 5).
 */

import type {
  CommandSpec,
  ShellCommandContext,
  ShellCommandResult,
} from '../../shared/shell-command';

export interface ShellCommandStore {
  /** Register a command (multi-word path). */
  register(spec: CommandSpec): void;
  /** Resolve a raw command line → CommandSpec + args. Returns null if no match. */
  resolve(command: string): { spec: CommandSpec; args: string[] } | null;
  /** List all registered commands. */
  list(): CommandSpec[];
  /** Execute a resolved command. The handler lives on the spec. */
  execute(spec: CommandSpec, args: string[], ctx: ShellCommandContext): Promise<ShellCommandResult>;
}
