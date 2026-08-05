/** GET /api/template/list */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function GET() {
  const bag = getEngineBag();
  return NextResponse.json({ ok: true, templates: bag.templateEngine.listTemplates() });
}
