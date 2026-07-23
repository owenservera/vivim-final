/**
 * engines/shell-command-engine.ts
 * --------------------------------------------------------------------
 * The CLI two-way bridge engine. Implements `cap:canvas:shell-command`:
 * the canvas sends a CLI command string; this engine dispatches it
 * through the SAME CommandRegistry the thin CLI client uses.
 *
 * Invariant 5 (One Entry Point): the canvas surface and the CLI
 * surface share ONE transport — UnifiedCapability. The canvas is now
 * a first-class CLI surface, not just a viewer.
 *
 * Output streams back to the canvas node as a card (ShellCommandResult).
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type {
  ShellCommandInput,
  ShellCommandResult,
  ShellCommandContext,
  ShellCommandOutputChunk,
} from '../shared/shell-command';
import type { ShellCommandStore } from '../storage/contracts/shell-command-store';
import { ulid } from '../lib/ulid';

export interface ShellCommandEngineDeps {
  commandStore: ShellCommandStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

/**
 * Optional streaming callback. When provided, the engine emits
 * ShellCommandOutputChunk events as the command runs (one stdout
 * chunk, one stderr chunk, one complete). The SSE forwarder picks
 * these up and streams them to the canvas shell card.
 */
export type StreamSink = (chunk: ShellCommandOutputChunk) => void;

export class ShellCommandEngine {
  constructor(private deps: ShellCommandEngineDeps) {}

  /**
   * Execute a CLI command string. Resolution:
   *   1. Split into path + args.
   *   2. Longest-prefix-match against registered CommandSpecs.
   *   3. Invoke the handler with the remaining args + context.
   *   4. Return a ShellCommandResult + emit chunks via the sink.
   */
  async execute(
    input: ShellCommandInput,
    sink?: StreamSink,
  ): Promise<ShellCommandResult> {
    const traceId = ulid();
    const ctx: ShellCommandContext = {
      workspaceId: input.workspaceId ?? 'ws:global',
      userId: input.userId ?? 'user:1',
      traceId,
    };

    const resolved = this.deps.commandStore.resolve(input.command);
    if (!resolved) {
      const result: ShellCommandResult = {
        traceId,
        ok: false,
        exitCode: 127, // POSIX "command not found"
        stdout: '',
        stderr: `command not found: ${input.command}`,
        durationMs: 0,
      };
      sink?.({
        traceId,
        sequence: 0,
        kind: 'error',
        text: result.stderr,
        timestamp: Date.now(),
      });
      this.deps.eventBus.emit({
        type: 'shell:command:not_found',
        traceId,
        command: input.command,
      });
      return result;
    }

    this.deps.logger.info('shell-command-engine', `dispatching: ${input.command}`, {
      traceId,
      capabilityId: resolved.spec.capabilityId,
    });

    sink?.({
      traceId,
      sequence: 0,
      kind: 'status',
      text: `→ ${input.command}  (capability: ${resolved.spec.capabilityId})`,
      timestamp: Date.now(),
    });

    const start = Date.now();
    const result = await this.deps.commandStore.execute(resolved.spec, resolved.args, ctx);
    result.durationMs = Date.now() - start;
    result.capabilityId = resolved.spec.capabilityId;

    if (result.stdout) {
      sink?.({
        traceId,
        sequence: 1,
        kind: 'stdout',
        text: result.stdout,
        timestamp: Date.now(),
      });
    }
    if (result.stderr) {
      sink?.({
        traceId,
        sequence: 2,
        kind: 'stderr',
        text: result.stderr,
        timestamp: Date.now(),
      });
    }
    sink?.({
      traceId,
      sequence: 3,
      kind: 'complete',
      status: { exitCode: result.exitCode, durationMs: result.durationMs, capabilityId: result.capabilityId },
      timestamp: Date.now(),
    });

    this.deps.eventBus.emit({
      type: 'shell:command:executed',
      traceId,
      command: input.command,
      capabilityId: result.capabilityId,
      ok: result.ok,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    });

    return result;
  }

  /** List all registered CLI commands (for shell autocomplete / help). */
  async listCommands() {
    return this.deps.commandStore.list().map((s) => ({
      path: s.path,
      description: s.description,
      capabilityId: s.capabilityId,
    }));
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:canvas:shell-command':
        return this.execute({
          command: String(input.command ?? ''),
          workspaceId: input.workspaceId ? String(input.workspaceId) : undefined,
          userId: input.userId ? String(input.userId) : undefined,
        });
      case 'cap:canvas:shell-list':
        return this.listCommands();
      default:
        throw new Error(`shell-command-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:canvas:shell-command', 'cap:canvas:shell-list'];
  }
}
