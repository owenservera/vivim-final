/** GET /api/audit/export — NDJSON download */
import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bag = getEngineBag();
  const body = await bag.auditEngine.export({
    engine: url.searchParams.get('engine') ?? undefined,
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Content-Disposition': `attachment; filename="audit-${Date.now()}.ndjson"`,
    },
  });
}
