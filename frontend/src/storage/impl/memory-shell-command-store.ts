/**
 * storage/impl/memory-shell-command-store.ts
 * --------------------------------------------------------------------
 * In-memory CommandRegistry. The thin CLI client uses this to resolve
 * multi-word commands (`admin db status`) into a CommandSpec. The
 * canvas `cap:canvas:shell-command` capability dispatches through the
 * SAME registry (FRONTEND=BACKEND two-way, invariant 5).
 *
 * Resolution: longest-prefix-match on command path. `admin db status`
 * matches a spec with path ['admin', 'db', 'status'] before
 * ['admin', 'db'] before ['admin'].
 */

import type {
  CommandSpec,
  ShellCommandContext,
  ShellCommandResult,
} from '../../shared/shell-command';
import type { ShellCommandStore } from '../contracts/shell-command-store';

export class MemoryShellCommandStore implements ShellCommandStore {
  private specs = new Map<string, CommandSpec>(); // key: path.join(' ')

  register(spec: CommandSpec): void {
    const key = spec.path.join(' ');
    this.specs.set(key, spec);
  }

  resolve(command: string): { spec: CommandSpec; args: string[] } | null {
    const parts = command.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;

    // Longest-prefix-match: try the full path, then progressively shorter.
    for (let len = parts.length; len >= 1; len--) {
      const prefix = parts.slice(0, len).join(' ');
      const spec = this.specs.get(prefix);
      if (spec) {
        return { spec, args: parts.slice(len) };
      }
    }
    return null;
  }

  list(): CommandSpec[] {
    return [...this.specs.values()].sort((a, b) =>
      a.path.join(' ').localeCompare(b.path.join(' ')),
    );
  }

  async execute(
    spec: CommandSpec,
    args: string[],
    ctx: ShellCommandContext,
  ): Promise<ShellCommandResult> {
    const startedAt = Date.now();
    try {
      const result = await spec.handler(args, ctx);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        traceId: ctx.traceId,
        ok: false,
        exitCode: 1,
        stdout: '',
        stderr: message,
        durationMs: Date.now() - startedAt,
        capabilityId: spec.capabilityId,
      };
    }
  }
}
