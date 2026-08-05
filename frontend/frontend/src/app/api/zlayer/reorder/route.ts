/** POST /api/zlayer/reorder */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string; order: string[] };
  const bag = getEngineBag();
  const config = await bag.zLayerEngine.reorder(body.workspaceId, body.order as never);
  return NextResponse.json({ ok: true, config });
}
