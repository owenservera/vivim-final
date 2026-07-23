/** POST /api/drawer/set_active_panel */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string; edge: string; panelId: string };
  const bag = getEngineBag();
  await bag.drawerEngine.setActivePanel(body.workspaceId, body.edge as never, body.panelId);
  return NextResponse.json({ ok: true });
}
