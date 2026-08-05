import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** GET /api/ui/list — list all UI component specs */
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') ?? undefined
  const category = url.searchParams.get('category') ?? undefined
  const enabledOnly = url.searchParams.get('enabledOnly') === 'true'
  const bag = getEngineBag()
  const specs = bag.uiEngine.listSpecs({ kind, category, enabledOnly })
  return NextResponse.json({ ok: true, count: specs.length, specs })
}
