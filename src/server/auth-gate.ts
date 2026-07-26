// src/server/auth-gate.ts
// Bearer token validation middleware

import { config } from '../config.js'

export function createAuthMiddleware(): (req: Request) => Response | null {
  const token = config.authToken

  return (req: Request): Response | null => {
    // No AUTH_TOKEN set → dev mode, allow all
    if (!token) return null

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required', code: 'AuthRequired' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const supplied = authHeader.slice(7)
    if (supplied !== token) {
      return new Response(JSON.stringify({ error: 'Invalid token', code: 'AuthRequired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return null
  }
}
