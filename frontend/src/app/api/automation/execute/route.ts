/**
 * app/api/automation/execute/route.ts
 * --------------------------------------------------------------------
 * POST /api/automation/execute — execute an automation by id.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap';
import { seedCanvasModel } from '@/lib/seed-canvas-model';

const REQUEST_SCHEMA = z.object({
  automationId: z.string(),
});

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const parsed = REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const bag = getEngineBag();
  if (!isSeeded()) {
    await seedCanvasModel(bag);
    markSeeded();
  }
  const execution = await bag.automationBuilder.execute(parsed.data.automationId);
  return NextResponse.json({ ok: true, execution });
}
