/**
 * app/api/workspace/list/route.ts
 * --------------------------------------------------------------------
 * GET /api/workspace/list?parentId=...&kind=...
 * Returns the workspace visual taxonomy (parent + children).
 */

import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parentId = url.searchParams.get('parentId') ?? undefined
  const kind = url.searchParams.get('kind') ?? undefined

  const bag = getEngineBag()
  const workspaces = await bag.workspaceEngine.list({
    parentId,
    kind,
  })
  return NextResponse.json({ ok: true, workspaces })
}
