/**
 * tests/cli/shell-command.test.ts
 * --------------------------------------------------------------------
 * Phase 2 — CLI two-way bridge tests.
 *
 * Validates that `cap:canvas:shell-command` dispatches through the
 * SAME CommandRegistry the thin CLI client uses. The canvas becomes a
 * first-class CLI surface (FRONTEND=BACKEND two-way, invariant 5).
 *
 * Covers:
 *   - Multi-word command resolution (longest-prefix-match)
 *   - Stub handlers return ShellCommandResult
 *   - Unknown commands return exitCode=127
 *   - The shell-command-engine emits traceId + chunks
 *   - Help command lists all registered commands
 *   - The 17 default commands all resolve
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { MemoryShellCommandStore } from '../../src/storage/impl/memory-shell-command-store';
import { ShellCommandEngine } from '../../src/engines/shell-command-engine';
import { CapabilityEventBus } from '../../src/engines/capability-event-bus';
import { StructuredLogger } from '../../src/engines/structured-logger';
import { registerDefaultCommands } from '../../src/cli/commands/shell';
import type { ShellCommandOutputChunk } from '../../src/shared/shell-command';

let store: MemoryShellCommandStore;
let engine: ShellCommandEngine;
let eventBus: CapabilityEventBus;

beforeAll(() => {
  eventBus = CapabilityEventBus.getInstance();
  eventBus.removeAllListeners();
  eventBus.clearRecent();
  const logger = new StructuredLogger('warn');
  store = new MemoryShellCommandStore();
  registerDefaultCommands(store);
  engine = new ShellCommandEngine({ commandStore: store, eventBus, logger });
});

describe('CLI two-way bridge — CommandRegistry', () => {
  test('longest-prefix-match: "admin db status" matches the 3-word spec', () => {
    const r = store.resolve('admin db status');
    expect(r).not.toBeNull();
    expect(r!.spec.path).toEqual(['admin', 'db', 'status']);
    expect(r!.args).toEqual([]);
  });

  test('longest-prefix-match: "admin db migrate" matches the 3-word spec', () => {
    const r = store.resolve('admin db migrate');
    expect(r).not.toBeNull();
    expect(r!.spec.path).toEqual(['admin', 'db', 'migrate']);
  });

  test('args are passed through: "open document /path/to/file.pdf"', () => {
    const r = store.resolve('open document /path/to/file.pdf');
    expect(r).not.toBeNull();
    expect(r!.spec.path).toEqual(['open', 'document']);
    expect(r!.args).toEqual(['/path/to/file.pdf']);
  });

  test('unknown command returns null', () => {
    const r = store.resolve('nonexistent command xyz');
    expect(r).toBeNull();
  });

  test('17 default commands registered', () => {
    const all = store.list();
    expect(all.length).toBeGreaterThanOrEqual(17);
  });
});

describe('CLI two-way bridge — ShellCommandEngine', () => {
  test('execute("admin db status") returns ok + exitCode=0', async () => {
    const result = await engine.execute({ command: 'admin db status', workspaceId: 'ws:global' });
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('vivim-final db status');
    expect(result.stdout).toContain('automation:         100 rows');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.capabilityId).toBe('cap:admin:db_status');
  });

  test('execute("admin invariants check") lists all 13 invariants', async () => {
    const result = await engine.execute({ command: 'admin invariants check' });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('Governor Canon');
    expect(result.stdout).toContain('FRONTEND=BACKEND two-way');
    expect(result.stdout).toContain('workspace z-depth');
  });

  test('execute("help") lists all available commands', async () => {
    const result = await engine.execute({ command: 'help' });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('admin db status');
    expect(result.stdout).toContain('list automations');
    expect(result.stdout).toContain('open video');
    expect(result.stdout).toContain('invoke agent');
  });

  test('execute unknown command returns exitCode=127', async () => {
    const result = await engine.execute({ command: 'totally-made-up-command' });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain('command not found');
  });

  test('execute streams chunks via the sink', async () => {
    const chunks: ShellCommandOutputChunk[] = [];
    await engine.execute(
      { command: 'admin db status', workspaceId: 'ws:global' },
      (chunk) => chunks.push(chunk),
    );
    // status + stdout + complete (3+ chunks)
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0]!.kind).toBe('status');
    expect(chunks.find((c) => c.kind === 'stdout')?.text).toContain('vivim-final db status');
    expect(chunks.find((c) => c.kind === 'complete')?.status?.exitCode).toBe(0);
  });

  test('execute emits a shell:command:executed event on the bus', async () => {
    let captured: unknown = null;
    eventBus.on('shell:command:executed', (e: unknown) => {
      captured = e;
    });
    await engine.execute({ command: 'list workspaces' });
    expect(captured).not.toBeNull();
    const evt = captured as { command: string; ok: boolean; exitCode: number; capabilityId: string };
    expect(evt.command).toBe('list workspaces');
    expect(evt.ok).toBe(true);
    expect(evt.exitCode).toBe(0);
    expect(evt.capabilityId).toBe('cap:workspace:list');
  });

  test('listCommands returns all registered commands', async () => {
    const list = await engine.listCommands();
    expect(list.length).toBeGreaterThanOrEqual(17);
    const paths = list.map((c) => c.path.join(' '));
    expect(paths).toContain('admin db status');
    expect(paths).toContain('help');
    expect(paths).toContain('open video');
  });

  test('dispatch(cap:canvas:shell-command) routes through the same path', async () => {
    const result = (await engine.dispatch('cap:canvas:shell-command', {
      command: 'admin db status',
    })) as { ok: boolean; exitCode: number; stdout: string };
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('vivim-final db status');
  });

  test('dispatch(cap:canvas:shell-list) returns the command catalog', async () => {
    const list = (await engine.dispatch('cap:canvas:shell-list', {})) as Array<{
      path: string[];
      description: string;
      capabilityId: string;
    }>;
    expect(list.length).toBeGreaterThanOrEqual(17);
  });

  test('workspace context propagates to handlers', async () => {
    const result = await engine.execute({
      command: 'list conversations',
      workspaceId: 'ws:research',
    });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('ws:research');
  });
});
