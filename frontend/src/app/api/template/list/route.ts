import { getEngineBag } from '@/lib/canvas-engine-bootstrap'
/** GET /api/template/list */
import { NextResponse } from 'next/server'

export async function GET() {
  const bag = getEngineBag()
  return NextResponse.json({ ok: true, templates: bag.templateEngine.listTemplates() })
}
