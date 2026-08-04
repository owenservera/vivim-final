/** GET /api/audit/list */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bag = getEngineBag();
  const entries = await bag.auditEngine.list({
    traceId: url.searchParams.get('traceId') ?? undefined,
    engine: url.searchParams.get('engine') ?? undefined,
    capabilityId: url.searchParams.get('capabilityId') ?? undefined,
    ok: url.searchParams.get('ok') === null ? undefined : url.searchParams.get('ok') === 'true',
    limit: Number(url.searchParams.get('limit') ?? 100),
  });
  return NextResponse.json({ ok: true, entries });
}
