// src/server/middleware/built-in/rate-limiter.ts
// Simple in-memory rate limiter middleware.
//
// Tracks request counts per key within a sliding window. When the limit
// is exceeded, short-circuits with a 429 RateLimited response.

import { getLogger } from '@/lib/logger.js'
import type { Middleware } from '../types.js'

export interface RateLimitOptions {
  /** Max requests per window */
  maxRequests: number
  /** Window duration in ms */
  windowMs: number
  /** Key extractor (default: IP-based) */
  keyExtractor?: (ctx: import('../types.js').MiddlewareContext) => string
}

interface RateLimitEntry {
  count: number
  windowStart: number
}

const log = getLogger('rate-limiter')

export function createRateLimiterMiddleware(opts: RateLimitOptions): Middleware {
  const { maxRequests, windowMs, keyExtractor } = opts
  const store = new Map<string, RateLimitEntry>()

  // Periodic cleanup of stale entries (every 60s)
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now - entry.windowStart > windowMs * 2) {
        store.delete(key)
      }
    }
  }, 60_000)

  // Prevent timer from keeping process alive in tests
  if (cleanupTimer.unref) {
    cleanupTimer.unref()
  }

  const defaultKeyExtractor = (ctx: import('../types.js').MiddlewareContext): string => {
    // Try X-Forwarded-For first, then fall back to a generic key
    const forwarded = ctx.request.headers.get('X-Forwarded-For')
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() ?? ctx.traceId.slice(0, 16)
    }
    // Fallback: use trace-id (not ideal but works in local dev)
    return ctx.traceId.slice(0, 16)
  }

  const extractKey = keyExtractor ?? defaultKeyExtractor

  return async (ctx, next) => {
    const key = extractKey(ctx)
    const now = Date.now()

    let entry = store.get(key)

    // Reset window if expired
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now }
      store.set(key, entry)
    }

    entry.count++

    const remaining = maxRequests - entry.count
    const resetAt = entry.windowStart + windowMs

    // Set rate limit info on state for downstream use
    ctx.state.set('rateLimit', { remaining, resetAt, limit: maxRequests })

    if (remaining < 0) {
      log.warn({ traceId: ctx.traceId, key, limit: maxRequests }, 'rate limit exceeded')
      ctx.handled = true
      ctx.response = new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          code: 'RateLimited' as const,
          details: { retryAfterMs: resetAt - now },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((resetAt - now) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(resetAt),
          },
        },
      )
      return
    }

    await next()

    // Inject rate limit headers into the response
    if (ctx.handled && ctx.response) {
      const headers = new Headers(ctx.response.headers)
      headers.set('X-RateLimit-Remaining', String(remaining))
      headers.set('X-RateLimit-Reset', String(resetAt))
      ctx.response = new Response(ctx.response.body, {
        status: ctx.response.status,
        statusText: ctx.response.statusText,
        headers,
      })
    }
  }
}
