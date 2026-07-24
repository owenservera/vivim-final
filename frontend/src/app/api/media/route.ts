/**
 * app/api/media/route.ts
 * --------------------------------------------------------------------
 * GET /api/media — list all open media cards.
 */

import { NextResponse } from 'next/server';
import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap';
import { seedCanvasModel } from '@/lib/seed-canvas-model';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? undefined;
  const kind = url.searchParams.get('kind') ?? undefined;
  const bag = getEngineBag();
  if (!isSeeded()) {
    await seedCanvasModel(bag);
    markSeeded();
  }
  const media = await bag.mediaStore.list({ workspaceId, kind });
  return NextResponse.json({ ok: true, media });
}
