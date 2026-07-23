/**
 * app/api/canvas/node/[id]/execute/route.ts (G5.4)
 * --------------------------------------------------------------------
 * POST /api/canvas/node/:id/execute — wrap a node action as a
 * UnifiedCapability execute. This is the ONE ENTRY POINT (invariant 5):
 * every node interaction goes through `POST /api/capabilities/:id/execute`.
 *
 * Body: { capability, input }
 * Returns: { ok, output }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

const REQUEST_SCHEMA = z.object({
  capability: z.string(),
  input: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json()) as unknown;
  const parsed = REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const bag = getEngineBag();

  // Invariant 5 (One Entry Point): every action is a UnifiedCapability.
  // Here we emit a capability:executed event for traceability. A
  // production system would dispatch to a capability registry.
  bag.eventBus.emit({
    type: 'capability:executed',
    capabilityId: parsed.data.capability,
    nodeId: id,
    input: parsed.data.input,
    traceId: `exec-${Date.now().toString(36)}`,
    ok: true,
    latencyMs: 0,
  });

  // Echo back the input as a stub output — real capability execution
  // would dispatch to a provider plugin or CDP governor.
  return NextResponse.json({
    ok: true,
    nodeId: id,
    capability: parsed.data.capability,
    output: { acknowledged: true, input: parsed.data.input },
  });
}
