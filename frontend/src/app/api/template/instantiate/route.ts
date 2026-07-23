/** POST /api/template/instantiate */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap';
import { seedCanvasModel } from '@/lib/seed-canvas-model';

const SCHEMA = z.object({ templateId: z.string(), ownerId: z.string().default('user:demo') });

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;
  const parsed = SCHEMA.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  const bag = getEngineBag();
  if (!isSeeded()) { await seedCanvasModel(bag); markSeeded(); }
  const result = await bag.templateEngine.instantiate(parsed.data.templateId, parsed.data.ownerId);
  return NextResponse.json({ ok: true, ...result });
}
