import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** GET /api/zlayer/get?workspaceId=... */
import { NextResponse } from 'next/server'
export async function GET(req: Request) {
  const url = new URL(req.url)
  const ws = url.searchParams.get('workspaceId') ?? 'ws:global'
  const bag = getEngineBag()
  const config = await bag.zLayerEngine.get(ws)
  return NextResponse.json({ ok: true, config })
}
