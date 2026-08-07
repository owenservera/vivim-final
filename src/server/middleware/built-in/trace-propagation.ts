// src/server/middleware/built-in/trace-propagation.ts
// Trace ID propagation — extracts X-Trace-Id from request or generates a new one.
//
// This middleware should run FIRST (priority 0) so all downstream middleware
// and the handler have access to ctx.traceId.

import { getLogger } from '@/lib/logger.js'
import type { Middleware } from '../types.js'

const _log = getLogger('trace-propagation')

/** Generate a short random hex string for trace IDs */
function generateTraceId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createTracePropagationMiddleware(): Middleware {
  return async (ctx, next) => {
    // Extract from header or generate
    const headerId = ctx.request.headers.get('X-Trace-Id')
    ctx.traceId = headerId?.length ? headerId : generateTraceId()

    // Also set on context state for downstream access
    ctx.state.set('traceId', ctx.traceId)

    await next()

    // Ensure the response carries the trace ID
    if (ctx.handled && ctx.response) {
      const headers = new Headers(ctx.response.headers)
      headers.set('X-Trace-Id', ctx.traceId)
      ctx.response = new Response(ctx.response.body, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers,
      })
    }
  }
}

/** Exported for testing */
export { generateTraceId }
