/** POST /api/ui/set_property — live property mutation on a component */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function POST(req: Request) {
  const body = (await req.json()) as { id: string; path: string; value: unknown };
  const bag = getEngineBag();
  const spec = bag.uiEngine.setProperty(body.id, body.path, body.value);
  if (!spec) return NextResponse.json({ ok: false, error: 'Component not found' }, { status: 404 });
  return NextResponse.json({ ok: true, spec });
}
