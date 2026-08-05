/**
 * app/api/documents/route.ts
 * --------------------------------------------------------------------
 * GET /api/documents — list all open document cards.
 */

import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap'
import { seedCanvasModel } from '@/lib/seed-canvas-model'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId') ?? undefined
  const bag = getEngineBag()
  if (!isSeeded()) {
    await seedCanvasModel(bag)
    markSeeded()
  }
  const documents = await bag.documentStore.list({ workspaceId })
  return NextResponse.json({ ok: true, documents })
}
