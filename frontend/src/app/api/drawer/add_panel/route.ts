/** POST /api/drawer/add_panel */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string; edge: string; panel: Record<string, unknown> };
  const bag = getEngineBag();
  const config = await bag.drawerEngine.addPanel(body.workspaceId, body.edge as never, body.panel as never);
  return NextResponse.json({ ok: true, config });
}
