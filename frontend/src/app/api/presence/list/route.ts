/** GET /api/presence/list?workspaceId=... */
import { NextResponse } from 'next/server';
import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap';
import { seedCanvasModel } from '@/lib/seed-canvas-model';
import { SIMULATED_USERS } from '@/shared/presence';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? 'ws:global';
  const bag = getEngineBag();
  if (!isSeeded()) { await seedCanvasModel(bag); markSeeded(); }
  // Lazy-start presence simulation on first query.
  if ((await bag.presenceStore.listUsers(workspaceId)).length === 0) {
    bag.presenceEngine.startSimulation(workspaceId);
  }
  const users = await bag.presenceEngine.listUsers(workspaceId);
  // Always include "You" first.
  if (!users.find((u) => u.id === 'user:1')) {
    users.unshift(SIMULATED_USERS[0]!);
  }
  return NextResponse.json({ ok: true, users });
}
