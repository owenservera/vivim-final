/**
 * app/api/automation/list/route.ts
 * --------------------------------------------------------------------
 * GET /api/automation/list?workspaceId=...
 * Returns automation definitions for a workspace.
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
  const automations = await bag.automationBuilder.list({ workspaceId })
  return NextResponse.json({ ok: true, automations })
}
