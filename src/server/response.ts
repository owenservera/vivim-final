// src/server/response.ts
// CORS middleware + JSON response helpers + ETag cache (Unit 1.5)

// Unit 1.5 — Map-backed cache for safe reads
type CacheEntry = { etag: string; body: unknown; expires: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5_000

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, QUERY',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Source, X-Trace-Id, X-Request-Id',
  }
}

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

// Add CORS headers to any Response (including ones created from Next.js)
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

// Unit 1.5 — Cached response with ETag support
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

// Unit 1.5 — Invalidate cache entry (bust on write)
export function bustCache(cacheKey: string): void {
  cache.delete(cacheKey)
}

export function errorResponse(
  message: string,
  code: string,
  status = 500,
  details?: unknown,
): Response {
  return json({ error: message, code, details }, status)
}
