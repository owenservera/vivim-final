// src/server/middleware/built-in/cors.ts
// CORS handling middleware.
//
// Handles preflight OPTIONS requests and adds CORS headers to responses.
// When no origins are specified, allows all ("*"). When a list is given,
// validates the Origin header against it and mirrors it back.

import { corsHeaders } from '../../response.js'
import type { Middleware } from '../types.js'

/** CORS-safe response headers */
const CORS_RESPONSE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Type, ETag, X-Trace-Id, X-Request-Id',
}

export function createCorsMiddleware(allowedOrigins?: string[]): Middleware {
  return async (ctx, next) => {
    const origin = ctx.request.headers.get('Origin') ?? ''

    // Handle preflight OPTIONS
    if (ctx.method === 'OPTIONS') {
      const headers = new Headers(corsHeaders())

      if (allowedOrigins && allowedOrigins.length > 0) {
        if (allowedOrigins.includes(origin)) {
          headers.set('Access-Control-Allow-Origin', origin)
          headers.set('Vary', 'Origin')
        }
      }
      // Add max-age for caching preflight (24h)
      headers.set('Access-Control-Max-Age', '86400')

      ctx.handled = true
      ctx.response = new Response(null, { status: 204, headers })
      return
    }

    // For non-OPTIONS: run the chain, then inject CORS headers into the response
    await next()

    if (ctx.handled && ctx.response) {
      const resHeaders = new Headers(ctx.response.headers)
      for (const [k, v] of Object.entries(CORS_RESPONSE_HEADERS)) {
        resHeaders.set(k, v)
      }
      if (allowedOrigins && allowedOrigins.length > 0) {
        if (allowedOrigins.includes(origin)) {
          resHeaders.set('Access-Control-Allow-Origin', origin)
          resHeaders.set('Vary', 'Origin')
        } else {
          resHeaders.delete('Access-Control-Allow-Origin')
        }
      }
      ctx.response = new Response(ctx.response.body, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers: resHeaders,
      })
    }
  }
}
