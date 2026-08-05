/** GET /api/drawer/get?workspaceId=... */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ws = url.searchParams.get('workspaceId') ?? 'ws:global';
  const bag = getEngineBag();
  const config = await bag.drawerEngine.get(ws);
  return NextResponse.json({ ok: true, config });
}
