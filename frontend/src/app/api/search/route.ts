import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap'
import { seedCanvasModel } from '@/lib/seed-canvas-model'
/** POST /api/search — Universal Search */
import { NextResponse } from 'next/server'
import { z } from 'zod'

const SCHEMA = z.object({
  text: z.string(),
  kinds: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
  limit: z.number().optional(),
})

export async function POST(req: Request) {
  const body = (await req.json()) as unknown
  const parsed = SCHEMA.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 })
  const bag = getEngineBag()
  if (!isSeeded()) {
    await seedCanvasModel(bag)
    markSeeded()
  }
  // Re-index on first search (cheap; idempotent).
  if (bag.searchIndex.size() === 0) await bag.searchEngine.reindex()
  const res = await bag.searchEngine.search({
    text: parsed.data.text,
    kinds: parsed.data.kinds as never,
    workspaceId: parsed.data.workspaceId,
    limit: parsed.data.limit,
  })
  return NextResponse.json(res)
}
