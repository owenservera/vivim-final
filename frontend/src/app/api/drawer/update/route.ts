/** POST /api/drawer/update */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string; edge: string; patch: Record<string, unknown> };
  const bag = getEngineBag();
  const config = await bag.drawerEngine.updateDrawer(body.workspaceId, body.edge as never, body.patch as never);
  return NextResponse.json({ ok: true, config });
}
