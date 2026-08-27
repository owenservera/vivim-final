// src/server/response.ts
// CORS middleware + JSON response helpers + ETag cache (Unit 1.5)
// + canonical error response helper (Work Items 01/03)

import { getLogger } from '../lib/logger.js'
import type { ErrorCode } from './errors.js'
import { AppError } from './errors.js'

/**
 * Response shape conventions:
 * - Simple list endpoints (GET /api/conversations, GET /api/providers):
 *   Return raw arrays: T[]
 * - Paginated list endpoints (GET /api/nodes, GET /api/knowledge/search):
 *   Return wrapped shape: { items: T[], total: number } or { nodes: T[], total: number }
 * - Single resource endpoints (GET /api/capabilities/:id):
 *   Return the resource directly: T
 * - Action endpoints (POST /api/conversations/:id/send):
 *   Return wrapped: { ok: boolean, ... }
 * - Error responses (all):
 *   Return: { error: string, code: ErrorCode, details?: unknown }
 */

// Unit 1.5 — Map-backed cache for safe reads
type CacheEntry = { etag: string; body: unknown; expires: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5_000

// Session 4 (2026-08-07): Background sweep to prevent unbounded cache growth.
// Without this, expired entries linger in the Map forever (the `expires > now`
// check in sendJson skips them, but never deletes them). Under high cardinality
// of cacheKeys (e.g. per-conversation ETags), this is a slow memory leak.
// Sweep every 60s, delete all entries where `expires < now`.
const SWEEP_INTERVAL_MS = 60_000
let sweepStarted = false
function startCacheSweep(): void {
  if (sweepStarted) return
  sweepStarted = true
  setInterval(() => {
    const now = Date.now()
    let deleted = 0
    for (const [key, entry] of cache) {
      if (entry.expires < now) {
        cache.delete(key)
        deleted++
      }
    }
    if (deleted > 0) {
      getLogger('response-cache').debug(`[response-cache] swept ${deleted} expired entries`)
    }
  }, SWEEP_INTERVAL_MS).unref() // .unref() so the timer doesn't keep the process alive
}
// Start the sweep on module load.
startCacheSweep()

/**
 * Standard CORS headers returned on every API response. Allows all origins,
 * standard methods, and the headers the frontend sends (Content-Type,
 * Authorization, X-Source, X-Trace-Id, X-Request-Id).
 *
 * @returns A plain object suitable for spreading into a `Response` headers dict.
 */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, QUERY',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Source, X-Trace-Id, X-Request-Id',
  }
}

/**
 * Serialize a value to a JSON `Response` with CORS headers, an ETag, and
 * BigInt-safe serialization (BigInt values are serialized as strings).
 *
 * @param data    The value to serialize (object, array, string, etc.).
 * @param status  HTTP status code (default 200).
 * @returns A `Response` with `Content-Type: application/json`, an `ETag`
 *          header, and CORS headers.
 */
export function json(data: unknown, status = 200): Response {
  const etag = `"${Date.now()}"`
  // Handle BigInt serialization
  const replacer = (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  return new Response(JSON.stringify(data, replacer), {
    status,
    headers: { 'Content-Type': 'application/json', ETag: etag, ...corsHeaders() },
  })
}

/**
 * Add CORS headers to an existing `Response`. If the response already has
 * CORS headers (e.g. it was created by {@link json}), it is returned as-is.
 * Otherwise a clone is created with CORS headers merged in.
 *
 * @param res  The response to add CORS headers to.
 * @returns A new `Response` with CORS headers.
 */
export function withCORS(res: Response): Response {
  // If it already has CORS headers, return as-is
  if (res.headers.get('Access-Control-Allow-Headers')) {
    return res
  }
  // Clone to avoid mutating the original
  const headers = new Headers(res.headers)
  const cors = corsHeaders()
  for (const [k, v] of Object.entries(cors)) {
    headers.set(k, v)
  }
  return new Response(res.body, {
    status: res.status,
    headers,
    // Preserve other response properties
    statusText: res.statusText,
  })
}

/**
 * Cached JSON response with ETag support. On first call, caches the data with
 * a generated ETag. On subsequent calls with the same `cacheKey`, returns 304
 * Not Modified if the client's `If-None-Match` matches the cached ETag.
 *
 * @param cacheKey  Unique key for the cache entry (e.g. `conversations:list`).
 * @param data      The value to serialize.
 * @param opts      Optional `{ ifNoneMatch, cacheTtlMs }` — the client's
 *                  `If-None-Match` header value and the cache TTL in
 *                  milliseconds (default 5000).
 * @returns A `Response` (200 with body, or 304 if ETag matches).
 */
export function sendJson(
  cacheKey: string,
  data: unknown,
  opts?: { ifNoneMatch?: string; cacheTtlMs?: number },
): Response {
  const now = Date.now()

  // Check cache+ETag
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > now && opts?.ifNoneMatch === cached.etag) {
    return new Response(null, { status: 304, headers: corsHeaders() })
  }

  const etag = `"${Date.now()}"`
  cache.set(cacheKey, { etag, body: data, expires: now + (opts?.cacheTtlMs ?? CACHE_TTL_MS) })

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: etag,
      'Cache-Control': `max-age=${Math.floor((opts?.cacheTtlMs ?? CACHE_TTL_MS) / 1000)}`,
      ...corsHeaders(),
    },
  })
}

/**
 * Invalidate a cache entry created by {@link sendJson}. Call this after any
 * write operation that would invalidate the cached response (e.g. after
 * `POST /api/conversations` busts `conversations:list`).
 *
 * @param cacheKey  The cache key to remove.
 */
export function bustCache(cacheKey: string): void {
  cache.delete(cacheKey)
}

/**
 * Build a canonical error `Response` with the `{ error, code, details }` shape.
 * This is the preferred way to return errors from routers — it ensures every
 * error response has CORS headers, the correct Content-Type, and the
 * machine-readable `code` field that the frontend switches on.
 *
 * @param message   Human-readable error message.
 * @param code      Machine-readable {@link ErrorCode}.
 * @param status    HTTP status code (default 500).
 * @param details   Optional structured details (zod issues, resource IDs, etc.).
 * @returns A JSON `Response` with the canonical error shape.
 */
export function errorResponse(
  message: string,
  code: ErrorCode,
  status = 500,
  details?: unknown,
): Response {
  return json({ error: message, code, details }, status)
}

/**
 * Convert an `AppError` (or any thrown value) into a standardized error `Response`.
 * This is the single place that turns server-side errors into HTTP responses,
 * ensuring every error has a consistent `{ error, code, details }` shape.
 *
 * - If `err` is an `AppError`, its `code`, `status`, and `details` are used.
 * - If `err` is a plain `Error`, it becomes a 500 `InternalError`.
 * - If `err` is a string or other value, it becomes a 500 `InternalError`
 *   with the stringified value as the message.
 *
 * @param err  The caught value from a try/catch block.
 * @returns A canonical error `Response`.
 */
export function appErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return errorResponse(err.message, err.code, err.status, err.details)
  }
  const message = err instanceof Error ? err.message : 'Internal error'
  return errorResponse(message, 'InternalError', 500)
}

/**
 * Dispatch a request to a router that may return `null` (not-handled) and
 * fall back to a secondary router on null. Any thrown error — sync or async —
 * is caught and converted to a canonical error response via {@link appErrorResponse}.
 *
 * Session 4 (2026-08-07): Replaces the bare `.then(r => r ?? fallback)` pattern
 * that was used at 11 dispatch sites in server/index.ts. Those sites returned
 * a promise that would reject on router throw, bypassing the canonical error
 * shape and CORS headers. This helper ensures every dispatch failure produces
 * a `{ error, code, details }` response with CORS + trace-ID.
 *
 * @param router   The primary router (returns `Response | null`).
 * @param fallback The fallback router (called when primary returns null).
 * @returns The response from the primary router, the fallback, or a canonical error.
 */
export async function dispatch(
  router: () => Promise<Response | null> | Response | null,
  fallback: () => Promise<Response> | Response,
): Promise<Response> {
  try {
    const result = await router()
    if (result !== null) return result
    return await fallback()
  } catch (err) {
    return appErrorResponse(err)
  }
}
