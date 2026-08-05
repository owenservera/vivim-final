// src/server/middleware/types.ts
// Typed middleware pipeline types.
//
// Provides the core abstractions for the composable middleware pipeline:
// - MiddlewareContext: the mutable request context that flows through the chain
// - Middleware: the signature every middleware must implement
// - MiddlewareDescriptor: metadata for registration and ordering
// - PipelineConfig: declarative configuration for wiring up the pipeline

/** Server context passed through middleware */
export interface MiddlewareContext {
  /** The original Request object */
  request: Request
  /** The URL object for the request */
  url: URL
  /** Request path without query string */
  pathname: string
  /** HTTP method */
  method: string
  /** Trace ID for request correlation */
  traceId: string
  /** Timestamp when request was received */
  receivedAt: number
  /** Mutable state bag for middleware to share data */
  state: Map<string, unknown>
  /** Authenticated user info (set by auth middleware) */
  auth?: { userId?: string; roles?: string[] }
  /** Whether the request has been handled (short-circuit) */
  handled: boolean
  /** Response to send (if handled) */
  response?: Response
  /** Error encountered during processing */
  error?: Error
}

/** Middleware function — receives context, can modify it or short-circuit */
export type Middleware = (ctx: MiddlewareContext, next: () => Promise<void>) => Promise<void>

/** Middleware priority (lower = runs first) */
export type MiddlewarePriority = number

/** Middleware descriptor */
export interface MiddlewareDescriptor {
  /** Unique name for this middleware */
  name: string
  /** Factory function to create the middleware */
  factory: () => Middleware
  /** Priority — lower numbers run first */
  priority: MiddlewarePriority
  /** Tags for filtering */
  tags?: string[]
  /** Whether this middleware is enabled by default */
  enabled?: boolean
}

/** Pipeline configuration */
export interface PipelineConfig {
  /** Global middleware that runs on ALL requests */
  global: MiddlewareDescriptor[]
  /** Path-specific middleware (matched by glob pattern) */
  pathSpecific?: Array<{
    pattern: string
    middleware: MiddlewareDescriptor[]
  }>
}
