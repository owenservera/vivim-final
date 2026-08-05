/**
 * app/api/agent/list/route.ts
 * --------------------------------------------------------------------
 * GET /api/agent/list?workspaceId=...
 * Returns agent definitions for a workspace.
 */

import { NextResponse } from 'next/server';
import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap';
import { seedCanvasModel } from '@/lib/seed-canvas-model';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? undefined;
  const bag = getEngineBag();
  if (!isSeeded()) {
    await seedCanvasModel(bag);
    markSeeded();
  }
  const agents = await bag.agentsBuilder.list({ workspaceId });
  return NextResponse.json({ ok: true, agents });
}
