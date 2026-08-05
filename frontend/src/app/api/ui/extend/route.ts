import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** POST /api/ui/extend — extend a base component spec */
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = (await req.json()) as {
    baseId: string
    id: string
    label?: string
    properties?: Record<string, unknown>
    features?: string[]
    actions?: unknown[]
    tags?: string[]
  }
  const bag = getEngineBag()
  const spec = bag.uiEngine.extendSpec(body.baseId, {
    id: body.id,
    label: body.label,
    properties: body.properties as never,
    features: body.features,
    actions: body.actions as never,
    tags: body.tags,
  })
  if (!spec)
    return NextResponse.json({ ok: false, error: 'Base component not found' }, { status: 404 })
  return NextResponse.json({ ok: true, spec })
}
