/**
 * app/api/canvas/shell/route.ts (Phase 2 §NEW DIRECTIVE)
 * --------------------------------------------------------------------
 * POST /api/canvas/shell — FRONTEND=BACKEND two-way bridge.
 *
 * Body: { command, workspaceId?, userId? }
 * Returns: ShellCommandResult + streams ShellCommandOutputChunk events
 * via the SSE forwarder (/api/canvas/events).
 *
 * Dispatches through the SAME ShellCommandStore (CommandRegistry) the
 * thin CLI client uses. The canvas becomes a first-class CLI surface.
 *
 * Invariant 5 (One Entry Point): every CLI command is a UnifiedCapability
 * dispatched via cap:canvas:shell-command. No second transport.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

const REQUEST_SCHEMA = z.object({
  command: z.string().min(1),
  workspaceId: z.string().optional(),
  userId: z.string().optional(),
});

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const parsed = REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const bag = getEngineBag();

  // The ShellCommandEngine emits chunks via the event bus → SSE forwarder
  // → /api/canvas/events → canvas shell card. The synchronous return is
  // the final ShellCommandResult.
  const result = await bag.shellCommandEngine.execute({
    command: parsed.data.command,
    workspaceId: parsed.data.workspaceId,
    userId: parsed.data.userId,
  });

  return NextResponse.json(result);
}

/** GET /api/canvas/shell — list all registered commands (autocomplete). */
export async function GET() {
  const bag = getEngineBag();
  const commands = await bag.shellCommandEngine.listCommands();
  return NextResponse.json({ ok: true, commands });
}
