// src/server/middleware/index.ts
// Barrel export + default pipeline factory.
//
// Re-exports all middleware types, the pipeline class, and built-in middleware
// factories. Provides createDefaultPipeline() for a production-ready pipeline
// with tracing, logging, CORS, and error handling pre-wired.

export { createCorsMiddleware } from './built-in/cors.js'
export { createErrorHandlerMiddleware } from './built-in/error-handler.js'
export type { RateLimitOptions } from './built-in/rate-limiter.js'
export { createRateLimiterMiddleware } from './built-in/rate-limiter.js'
export { createRequestLoggerMiddleware } from './built-in/request-logger.js'
export { createTracePropagationMiddleware } from './built-in/trace-propagation.js'
export { MiddlewarePipeline } from './pipeline.js'
export * from './types.js'

import { createCorsMiddleware } from './built-in/cors.js'
import { createErrorHandlerMiddleware } from './built-in/error-handler.js'
import { createRequestLoggerMiddleware } from './built-in/request-logger.js'
import { createTracePropagationMiddleware } from './built-in/trace-propagation.js'
import { MiddlewarePipeline } from './pipeline.js'

/**
 * Create a default production pipeline with standard middleware:
 * 1. Trace propagation (priority 0)
 * 2. CORS (priority 10)
 * 3. Request logger (priority 50)
 * 4. Error handler (priority 1000) — wraps everything
 */
export function createDefaultPipeline(): MiddlewarePipeline {
  const pipeline = new MiddlewarePipeline()

  pipeline.use({
    name: 'trace-propagation',
    factory: createTracePropagationMiddleware,
    priority: 0,
    tags: ['core', 'tracing'],
  })

  pipeline.use({
    name: 'cors',
    factory: () => createCorsMiddleware(),
    priority: 10,
    tags: ['core', 'cors'],
  })

  pipeline.use({
    name: 'request-logger',
    factory: () => createRequestLoggerMiddleware({ excludePaths: ['/health', '/api/version'] }),
    priority: 50,
    tags: ['core', 'logging'],
  })

  pipeline.use({
    name: 'error-handler',
    factory: createErrorHandlerMiddleware,
    priority: 1000,
    tags: ['core', 'errors'],
  })

  return pipeline
}
