// src/server/plugin-builder-router.ts
// Phase 9 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Plugin SDK v2.
//
// HTTP routes for the Plugin Builder.
//
// Routes:
//   POST /api/plugin-builder/build  — generate + register a plugin from NL
//   GET  /api/plugin-builder/seed   — returns example seed prompts
//
// The Plugin Builder uses the LLM Harness Agent (Phase 7) when available;
// otherwise it falls back to the deterministic template-based generator
// in `pluginBuilder.build()`.
//
// CONTRACT_VERSION: 1

import { z } from 'zod'
import { pluginBuilder } from '../engines/reprogrammability/plugin-builder.js'
import { errorResponse, json } from './response.js'

const BuildInputSchema = z.object({
  description: z.string().min(1).max(2000),
  pluginId: z.string().optional(),
  providerId: z.string().optional(),
})

const SEED_PROMPTS = [
  'when I type /standup, show me a card with my open threads',
  'when I type /summary, summarize the current conversation',
  'when I type /search, show a search bar scoped to my docs',
  'when I type /export, export the current canvas as PNG',
]

export function createPluginBuilderRouter() {
  return async function pluginBuilderRouter(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // ── POST /api/plugin-builder/build ───────────────────────────────────────
    if (path === '/api/plugin-builder/build' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
      }

      const parsed = BuildInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          400,
        )
      }

      const result = await pluginBuilder.build(parsed.data)
      if (!result.ok || !result.plugin || !result.manifest) {
        return json({ ok: false, error: result.error ?? 'Build failed' }, 500)
      }

      return json(
        {
          ok: true,
          manifest: result.manifest,
          plugin: {
            providerId: result.plugin.providerId,
            surfaces: result.plugin.surfaces?.map((s) => ({
              id: s.id,
              kind: s.kind,
              label: s.label,
            })),
            capabilities: result.plugin.capabilities,
          },
        },
        201,
      )
    }

    // ── GET /api/plugin-builder/seed ─────────────────────────────────────────
    if (path === '/api/plugin-builder/seed' && req.method === 'GET') {
      return json({ ok: true, prompts: SEED_PROMPTS })
    }

    return null
  }
}
