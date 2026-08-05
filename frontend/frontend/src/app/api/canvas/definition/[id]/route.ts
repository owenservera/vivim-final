/**
 * app/api/canvas/definition/[id]/route.ts (G5.3)
 * --------------------------------------------------------------------
 * PATCH /api/canvas/definition/:id — live-config patch (G2).
 * Wraps patchDefinition() — bumps version, emits canvas:def:updated.
 *
 * Mounted nodes re-render from new blob WITHOUT page reload.
 */

import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';
import { patchDefinition, type DefinitionPatch } from '@/canvas/live-config';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json()) as DefinitionPatch;
  const bag = getEngineBag();

  try {
    const updated = await patchDefinition(id, body, {
      canvasDefinitionStore: bag.canvasDefinitionStore,
      eventBus: bag.eventBus,
      logger: bag.logger,
      routeSyncDeps: bag.routeSyncDeps,
    });
    return NextResponse.json({ ok: true, definition: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bag = getEngineBag();
  const def = await bag.canvasRegistry.get(id);
  if (!def) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, definition: def });
}
