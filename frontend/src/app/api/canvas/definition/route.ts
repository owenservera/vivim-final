/**
 * app/api/canvas/definition/route.ts (G5.2)
 * --------------------------------------------------------------------
 * POST /api/canvas/definition — publish a CanvasDefinition.
 * Wraps CanvasRegistry.define() (no build step; invariant 7).
 *
 * P8 enforced at publish time: Zod schema rejects inline <script>
 * tags AND any sandbox.allowInlineScript !== false.
 */

import { NextResponse } from 'next/server';
import { getEngineBag, isSeeded, markSeeded } from '@/lib/canvas-engine-bootstrap';
import { seedCanvasModel } from '@/lib/seed-canvas-model';
import { defineComponent, CANVAS_DEFINITION_INPUT_SCHEMA } from '@/sdk/canvas';

export async function POST(req: Request) {
  const body = (await req.json()) as unknown;

  // Validate via SDK schema (Zod at boundary).
  const parsed = CANVAS_DEFINITION_INPUT_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  // Build the CanvasDefinition (P8 enforcement happens here too).
  let def;
  try {
    def = defineComponent(parsed.data);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const bag = getEngineBag();
  if (!isSeeded()) {
    await seedCanvasModel(bag);
    markSeeded();
  }

  const published = await bag.canvasRegistry.define({
    slug: def.slug,
    name: def.name,
    description: def.description,
    category: def.category,
    html: def.html,
    css: def.css,
    scriptUrl: def.scriptUrl,
    bindings: def.bindings,
    layout: def.layout,
    sandbox: def.sandbox,
    author: def.author,
    status: def.status,
    tags: def.tags,
  });

  return NextResponse.json({ ok: true, definition: published });
}

export async function GET() {
  const bag = getEngineBag();
  const list = await bag.canvasRegistry.list({ status: 'published' });
  return NextResponse.json({ ok: true, definitions: list });
}
