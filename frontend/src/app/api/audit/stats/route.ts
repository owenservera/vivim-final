import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** GET /api/audit/stats */
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const bag = getEngineBag()
  const stats = await bag.auditEngine.stats({
    engine: url.searchParams.get('engine') ?? undefined,
  })
  return NextResponse.json({ ok: true, stats })
}
