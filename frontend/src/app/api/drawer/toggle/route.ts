import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/drawer/toggle */
import { NextResponse } from 'next/server'
export async function POST(req: Request) {
  const body = (await req.json()) as { workspaceId: string; edge: string }
  const bag = getEngineBag()
  const config = await bag.drawerEngine.toggle(body.workspaceId, body.edge as never)
  return NextResponse.json({ ok: true, config })
}
