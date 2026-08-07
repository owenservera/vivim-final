// src/server/middleware/built-in/request-logger.ts
// Request/response logging middleware.
//
// Logs incoming requests and outgoing responses with timing information.
// Uses the structured getLogger() so output is pino-formatted.

import { getLogger } from '@/lib/logger.js'
import type { Middleware } from '../types.js'

export function createRequestLoggerMiddleware(opts?: {
  /** Paths to exclude from logging (exact match) */
  excludePaths?: string[]
  /** Whether to log request bodies (default: false) */
  logBody?: boolean
}): Middleware {
  const logger = getLogger('request-logger')
  const exclude = new Set<string>(opts?.excludePaths ?? ['/health'])
  const _logBody = opts?.logBody ?? false

  return async (ctx, next) => {
    // Skip excluded paths
    if (exclude.has(ctx.pathname)) {
      await next()
      return
    }

    const startMs = Date.now()

    logger.info(
      { traceId: ctx.traceId, method: ctx.method, pathname: ctx.pathname },
      'incoming request',
    )

    await next()

    const elapsedMs = Date.now() - startMs
    const status = ctx.response?.status ?? 0
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

    logger[level](
      { traceId: ctx.traceId, method: ctx.method, pathname: ctx.pathname, status, elapsedMs },
      'request completed',
    )
  }
}
