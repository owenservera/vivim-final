/**
 * app/api/agent/invoke/route.ts
 * --------------------------------------------------------------------
 * POST /api/agent/invoke — invoke an agent by id.
 */

import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap'
import { seedCanvasModel } from '@/lib/seed-canvas-model'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const REQUEST_SCHEMA = z.object({
  agentId: z.string(),
})

export async function POST(req: Request) {
  const body = (await req.json()) as unknown
  const parsed = REQUEST_SCHEMA.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 })
  }
  const bag = getEngineBag()
  if (!isSeeded()) {
    await seedCanvasModel(bag)
    markSeeded()
  }
  const run = await bag.agentsBuilder.invoke(parsed.data.agentId)
  return NextResponse.json({ ok: true, run })
}
