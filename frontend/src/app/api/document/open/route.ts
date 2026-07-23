/**
 * app/api/document/open/route.ts
 * --------------------------------------------------------------------
 * POST /api/document/open — open a document card.
 * Body: { title, mimeType, sourceUrl?, inlineContent?, language?, workspaceId? }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap';
import { seedCanvasModel } from '@/lib/seed-canvas-model';

const REQUEST_SCHEMA = z.object({
  title: z.string(),
  mimeType: z.string(),
  sourceUrl: z.string().optional(),
  inlineContent: z.string().optional(),
  language: z.string().optional(),
  workspaceId: z.string().optional(),
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
  const card = await bag.documentEngine.open({
    title: parsed.data.title,
    mimeType: parsed.data.mimeType,
    sourceUrl: parsed.data.sourceUrl,
    inlineContent: parsed.data.inlineContent,
    language: parsed.data.language,
    workspaceId: parsed.data.workspaceId,
  });
  return NextResponse.json({ ok: true, document: card });
}
