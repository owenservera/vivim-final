import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/zlayer/set_active */
import { NextResponse } from 'next/server'
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string; layerId: string }
  const bag = getEngineBag()
  await bag.zLayerEngine.setActiveLayer(body.workspaceId, body.layerId as never)
  return NextResponse.json({ ok: true })
}
