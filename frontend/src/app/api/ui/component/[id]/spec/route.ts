/** GET /api/ui/component/[id]/spec — read current component spec with resolved properties */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bag = getEngineBag();
  const spec = bag.uiEngine.getSpec(id);
  if (!spec) return NextResponse.json({ ok: false, error: 'Component not found' }, { status: 404 });
  const resolved = bag.uiEngine.getResolvedProperties(id);
  return NextResponse.json({ ok: true, spec, resolvedProperties: resolved });
}
