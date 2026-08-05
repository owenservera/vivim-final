import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/drawer/reset */
import { NextResponse } from 'next/server'
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string }
  const bag = getEngineBag()
  const config = await bag.drawerEngine.reset(body.workspaceId)
  return NextResponse.json({ ok: true, config })
}
