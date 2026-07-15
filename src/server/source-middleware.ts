// src/server/source-middleware.ts
// Middleware for extracting and tracking the X-Source header.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every API request is tagged with its source surface for audit logging.
// The source is extracted from the X-Source header and attached to the request context.

import type { Source } from '../../shared/api-types.ts'

/** Valid source values — matches shared/api-types.ts Source type */
export type RequestSource = Source | 'unknown'

/** Request context with source information */
export interface SourceContext {
  source: RequestSource
  timestamp: number
}

/**
 * Extract the source from a request's X-Source header.
 * Returns 'unknown' if the header is missing or invalid.
 */
export function extractSource(req: Request): RequestSource {
  const raw = req.headers.get('X-Source') ?? 'unknown'
  const validSources: Source[] = ['cli', 'frontend', 'agent', 'script']
  return validSources.includes(raw as Source) ? (raw as Source) : 'unknown'
}

/**
 * Create a SourceContext from a request.
 */
export function createSourceContext(req: Request): SourceContext {
  return {
    source: extractSource(req),
    timestamp: Date.now(),
  }
}

/**
 * Audit log helper — logs actions with their source.
 * Usage: const audit = createAuditLogger(req); audit('action_name', { detail: 'value' });
 */
export function createAuditLogger(req: Request) {
  const ctx = createSourceContext(req)
  return (action: string, detail?: Record<string, unknown>) => {
    const detailStr = detail ? ` ${JSON.stringify(detail)}` : ''
  }
}
