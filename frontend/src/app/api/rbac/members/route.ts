import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** GET /api/rbac/members?workspaceId=... */
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId') ?? 'ws:global'
  const bag = getEngineBag()
  const members = await bag.rbacEngine.listMembers(workspaceId)
  return NextResponse.json({ ok: true, members })
}
