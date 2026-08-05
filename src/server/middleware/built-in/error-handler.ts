// src/server/middleware/built-in/error-handler.ts
// Global error catching middleware — converts unhandled errors to proper responses.
//
// This middleware wraps all downstream middleware and the handler in a try/catch.
// It should be registered with the LOWEST priority number so it executes first
// (outermost wrapper) and its post-processing can intercept errors from anything
// inside the chain.

import { getLogger } from '@/lib/logger.js'
import { AppError } from '../../errors.js'
import { errorResponse } from '../../response.js'
import type { Middleware } from '../types.js'

const log = getLogger('error-handler')

export function createErrorHandlerMiddleware(): Middleware {
  return async (ctx, next) => {
    try {
      await next()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      ctx.error = error

      log.error(
        {
          traceId: ctx.traceId,
          method: ctx.method,
          pathname: ctx.pathname,
          error: error.message,
          stack: error.stack,
        },
        'error caught in middleware pipeline',
      )

      // Convert to canonical error response.
      // NOTE: We import AppError directly here (not via response.ts) because
      // response.ts imports it as `type` only, so instanceof fails at runtime.
      let response: Response
      if (error instanceof AppError) {
        response = errorResponse(error.message, error.code, error.status, error.details)
      } else {
        response = errorResponse(error.message, 'InternalError', 500)
      }

      // Ensure trace ID is present on error responses
      const headers = new Headers(response.headers)
      if (ctx.traceId) {
        headers.set('X-Trace-Id', ctx.traceId)
      }
      ctx.handled = true
      ctx.response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }
  }
}
