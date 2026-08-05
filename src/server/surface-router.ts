// src/server/surface-router.ts
// Phase 5 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Reprogram-This Modal.
//
// Read-only HTTP routes for the SurfaceRegistry. The ReprogramController
// (frontend) uses GET /api/surface/:id/spec to seed the ReprogramModal's
// JSON editor with the surface's current spec.
//
// Routes:
//   GET /api/surface/:id/spec      — get the current spec of a surface
//   GET /api/surface/:id/summary   — get a small summary (id, kind, label, supportedOps)
//   GET /api/surface?kind=…&slot=… — list surfaces (optionally filtered)
//
// The registry is in-memory (Phase 1); Phase 8 adds Prisma-backed reads.
//
// CONTRACT_VERSION: 1

import type { SurfaceKind } from '../reprogrammability/contract.js'
import { SurfaceNotFoundError, surfaceRegistry } from '../reprogrammability/registry.js'
import { appErrorResponse, errorResponse, json } from './response.js'

export function createSurfaceRouter() {
  return async function surfaceRouter(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // ── GET /api/surface?kind=…&slot=…&capability=… ──────────────────────
    if (path === '/api/surface' && req.method === 'GET') {
      const kind = url.searchParams.get('kind') as SurfaceKind | null
      const slot = url.searchParams.get('slot')
      const capability = url.searchParams.get('capability')
      let surfaces = surfaceRegistry.list()
      if (kind) surfaces = surfaces.filter((s) => s.kind === kind)
      if (slot) surfaces = surfaces.filter((s) => s.slot === slot)
      if (capability) surfaces = surfaces.filter((s) => s.capabilities?.includes(capability))
      return json({
        ok: true,
        count: surfaces.length,
        surfaces: surfaces.map((s) => ({
          id: s.id,
          kind: s.kind,
          label: s.label,
          slot: s.slot,
          capabilities: s.capabilities,
          tags: s.tags,
          supportedOps: s.supportedOps,
        })),
      })
    }

    // ── GET /api/surface/:id/spec ────────────────────────────────────────
    const specMatch = path.match(/^\/api\/surface\/([^/]+)\/spec$/)
    if (specMatch && req.method === 'GET') {
      const surfaceId = decodeURIComponent(specMatch[1]!)
      try {
        const surface = surfaceRegistry.get(surfaceId)
        return json({ ok: true, surfaceId, spec: surface.getSpec() })
      } catch (err) {
        if (err instanceof SurfaceNotFoundError) {
          return errorResponse(err.message, 'NotFound', 404)
        }
        return appErrorResponse(err)
      }
    }

    // ── GET /api/surface/:id/summary ─────────────────────────────────────
    const summaryMatch = path.match(/^\/api\/surface\/([^/]+)\/summary$/)
    if (summaryMatch && req.method === 'GET') {
      const surfaceId = decodeURIComponent(summaryMatch[1]!)
      try {
        const surface = surfaceRegistry.get(surfaceId)
        return json({
          ok: true,
          surface: {
            id: surface.id,
            kind: surface.kind,
            label: surface.label,
            slot: surface.slot,
            capabilities: surface.capabilities,
            tags: surface.tags,
            supportedOps: surface.supportedOps,
          },
        })
      } catch (err) {
        if (err instanceof SurfaceNotFoundError) {
          return errorResponse(err.message, 'NotFound', 404)
        }
        return appErrorResponse(err)
      }
    }

    return null
  }
}
