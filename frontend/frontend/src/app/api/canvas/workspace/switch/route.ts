/**
 * app/api/canvas/workspace/switch/route.ts
 * --------------------------------------------------------------------
 * POST /api/canvas/workspace/switch — switch the active workspace.
 * Emits `workspace:switched` → SSE forwarder → canvas re-resolves.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

const REQUEST_SCHEMA = z.object({
  fromWorkspaceId: z.string().nullable().optional(),
  toWorkspaceId: z.string(),
  userId: z.string().default('user:1'),
});

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const parsed = REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const bag = getEngineBag();
  const ws = await bag.workspaceEngine.switchWorkspace(
    parsed.data.fromWorkspaceId ?? null,
    parsed.data.toWorkspaceId,
    parsed.data.userId,
  );
  return NextResponse.json({ ok: true, workspace: ws });
}
