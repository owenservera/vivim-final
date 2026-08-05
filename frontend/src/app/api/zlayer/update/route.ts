import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/zlayer/update */
import { NextResponse } from 'next/server'
export async function POST(req: Request) {
  const body = (await req.json()) as {
    workspaceId: string
    layerId: string
    patch: Record<string, unknown>
  }
  const bag = getEngineBag()
  const config = await bag.zLayerEngine.updateLayer(
    body.workspaceId,
    body.layerId as never,
    body.patch as never,
  )
  return NextResponse.json({ ok: true, config })
}
