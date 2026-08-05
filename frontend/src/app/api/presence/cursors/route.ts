import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** GET /api/presence/cursors?workspaceId=... */
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId') ?? 'ws:global'
  const bag = getEngineBag()
  const cursors = await bag.presenceEngine.listCursors(workspaceId)
  return NextResponse.json({ ok: true, cursors })
}
