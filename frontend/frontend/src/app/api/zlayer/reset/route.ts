/** POST /api/zlayer/reset */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string };
  const bag = getEngineBag();
  const config = await bag.zLayerEngine.reset(body.workspaceId);
  return NextResponse.json({ ok: true, config });
}
