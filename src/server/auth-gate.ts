// src/server/auth-gate.ts
// Bearer token validation middleware.
//
// Session 3 (2026-08-07): Standardized to use the canonical `AuthError` code
// (was `AuthRequired` which is not in the `ErrorCode` union) and the `json()`
// helper (was raw `new Response(JSON.stringify(...))` which bypassed CORS
// headers + BigInt serialization). This keeps the auth-gate consistent with
// the rest of the server's error-response shape.

import { config } from '../config.js'
import { json } from './response.js'

export function createAuthMiddleware(): (req: Request) => Response | null {
  const token = config.authToken

  return (req: Request): Response | null => {
    // No AUTH_TOKEN set → dev mode, allow all
    if (!token) return null

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Authentication required', code: 'AuthError' }, 401)
    }

    const supplied = authHeader.slice(7)
    if (supplied !== token) {
      return json({ error: 'Invalid token', code: 'AuthError' }, 401)
    }

    return null
  }
}
