// src/desktop/frontend-route-mount.ts
// Desktop-sidecar bridge for the frontend App Router API bag.
//
// The installed Tauri app serves ALL its API traffic from the Bun sidecar
// (127.0.0.1:9421). The 80 route handlers under frontend/src/app/api were
// compiled by Next.js's App Router in dev; in the desktop build there is no
// Next.js runtime, so those routes 404. This module re-dispatches the same
// route files against the sidecar's fetch handler via the static table emitted
// by scripts/tauri/gen-frontend-routes.ts.
//
// Precedence: the dispatcher runs FIRST in the sidecar fetch chain (right after
// the auth gate). The WebView served its /api/* entirely from the frontend App
// Router at dev time, so any exact table path wins over the backend prefix
// routers that would otherwise swallow it (e.g. /api/canvas/shell is not a
// backend canvas route, /api/media/open is caught by the backend media :id
// matcher, /api/storage/health is not a backend storage route). Backend keeps
// every path that has no frontend table entry, plus the excluded setup/health
// surface.

import { frontendRoutes, type FrontendRouteEntry, type FrontendHandler } from './generated-frontend-routes.js'

// Keep the compiler honest about the entry shape without importing type for runtime.
export type { FrontendRouteEntry, FrontendHandler }

// /api/agent/canvas/[id] → /^\/api\/agent\/canvas\/([^/]+)\/?$/
function compilePath(path: string): { re: RegExp; keys: string[] } {
  const keys: string[] = []
  const segments = path.split('/')
  const pattern = segments
    .map((seg) => {
      const dyn = seg.match(/^\[([^\]]+)\]$/)
      if (dyn) {
        // dynamic segment — emit a capture group and keep its key
        keys.push(dyn[1])
        return '([^/]+)'
      }
      // static segment — escape every regex metacharacter, nothing more
      return seg.replace(/[.+?^${}()|[\]\\]/g, (ch) => `\\${ch}`)
    })
    .join('/')
  return { re: new RegExp(`^${pattern}/?$`), keys }
}

// precompile once at module load so per-request dispatch is O(path segments)
interface CompiledRoute extends FrontendRouteEntry {
  re: RegExp
  keys: string[]
}
const compiled: CompiledRoute[] = frontendRoutes.map((entry) => {
  const { keys, re } = compilePath(entry.path)
  return { ...entry, keys, re }
})

/**
 * Attempt to fulfill `req` with a ported frontend route handler.
 * Returns the handler's Response when an exact path (static segment optional
 * dynamic `[param]` segments) + verb matches, else null so the caller continues
 * the normal backend routing chain. Never throws.
 */
export async function dispatchFrontendRoute(req: Request, url: URL): Promise<Response | null> {
  try {
    for (const entry of compiled) {
      const match = entry.re.exec(url.pathname)
      if (!match) continue
      const handler: FrontendHandler | undefined = entry.handlers[req.method as 'GET']
      if (!handler) continue
      const params: Record<string, string> = {}
      for (let i = 0; i < entry.keys.length; i++) {
        params[entry.keys[i]] = decodeURIComponent(match[i + 1] ?? '')
      }
      const result = await handler(req, params)
      if (result instanceof Response) return result
      if (result !== undefined && result !== null) {
        return new Response(JSON.stringify(result), {
          headers: { 'content-type': 'application/json' },
        })
      }
      // handler returned nothing → fall through to backend chain
      continue
    }
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
        code: 'FrontendRouteError',
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
  return null
}