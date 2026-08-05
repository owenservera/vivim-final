/** POST /api/drawer/remove_panel */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string; edge: string; panelId: string };
  const bag = getEngineBag();
  const config = await bag.drawerEngine.removePanel(body.workspaceId, body.edge as never, body.panelId);
  return NextResponse.json({ ok: true, config });
}
