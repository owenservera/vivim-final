import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/notification/mark_read */
import { NextResponse } from 'next/server'
import { z } from 'zod'

const SCHEMA = z.object({ id: z.string() })

export async function POST(req: Request) {
  const body = (await req.json()) as unknown
  const parsed = SCHEMA.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 })
  const bag = getEngineBag()
  await bag.notificationEngine.markRead(parsed.data.id)
  return NextResponse.json({ ok: true })
}
