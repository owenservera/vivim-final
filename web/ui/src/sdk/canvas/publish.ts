/**
 * sdk/canvas/publish.ts
 * --------------------------------------------------------------------
 * G1.2 — `publish(def)`: writes a CanvasDefinition row via
 * `POST /api/canvas/definition`. The backend CanvasRegistry.define()
 * emits `plugin:registered` on the bus → mounted nodes re-render.
 *
 * No build step. No restart. Live hot-swap by design (invariant 7).
 */

import type { CanvasDefinition } from '../../shared/canvas-types';

export interface PublishOptions {
  /** Override the API base (defaults to '' = same origin). */
  apiBase?: string;
  /** Fetch override (for testing). */
  fetchImpl?: typeof fetch;
}

export async function publish(
  def: CanvasDefinition,
  opts: PublishOptions = {},
): Promise<{ id: string; slug: string; version: number }> {
  const f = opts.fetchImpl ?? fetch;
  const res = await f(`${opts.apiBase ?? ''}/api/canvas/definition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`publish failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { ok: boolean; definition: { id: string; slug: string; version: number } };
  if (!json.ok) throw new Error('publish returned ok=false');
  return json.definition;
}
