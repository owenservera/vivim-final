/**
 * app/api/plugins/install/route.ts (G5.6)
 * --------------------------------------------------------------------
 * POST /api/plugins/install — install a `.vivim-plugin` tarball.
 * Mirrors bundle 04 plugin-router.ts lifecycle:
 *   install → verify → register → seed components → activate
 *
 * Body: multipart form upload with `tarball` field.
 */

import { NextResponse } from 'next/server';
import { getEngineBag } from '@/lib/canvas-engine-bootstrap';

export async function POST(req: Request) {
  const bag = getEngineBag();
  const contentType = req.headers.get('content-type') ?? '';

  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { ok: false, error: 'Expected multipart/form-data with a `tarball` field' },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const file = form.get('tarball');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Missing `tarball` file' }, { status: 400 });
  }

  // For the prototype, we accept the tarball and emit a plugin:registered
  // event. A production impl would extract, verify the manifest, register
  // the plugin via PluginManager, and seed its components via CanvasRegistry.
  const pluginId = `plugin:${file.name}:${Date.now().toString(36)}`;
  bag.eventBus.emit({
    type: 'plugin:registered',
    pluginId,
    slug: file.name,
    sizeBytes: file.size,
  });

  return NextResponse.json({
    ok: true,
    pluginId,
    message: `Plugin '${file.name}' accepted (${file.size} bytes). Components will be seeded on activation.`,
  });
}
