/**
 * app/api/media/open/route.ts
 * --------------------------------------------------------------------
 * POST /api/media/open — open a media card (video / audio / image).
 * Body: { title, kind, sourceUrl, mimeType, durationSec?, workspaceId? }
 */

import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap'
import { seedCanvasModel } from '@/lib/seed-canvas-model'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const REQUEST_SCHEMA = z.object({
  title: z.string(),
  kind: z.enum(['video', 'audio', 'image', 'stream']),
  sourceUrl: z.string(),
  mimeType: z.string(),
  durationSec: z.number().optional(),
  workspaceId: z.string().optional(),
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
  const card = await bag.mediaEngine.open({
    title: parsed.data.title,
    kind: parsed.data.kind,
    sourceUrl: parsed.data.sourceUrl,
    mimeType: parsed.data.mimeType,
    durationSec: parsed.data.durationSec,
    workspaceId: parsed.data.workspaceId,
  })
  return NextResponse.json({ ok: true, media: card })
}
