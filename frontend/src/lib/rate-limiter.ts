// frontend/src/lib/rate-limiter.ts
// Simple in-memory sliding-window rate limiter for API routes.
// For production, swap the Map store for Redis (ioredis/Upstash).

interface WindowEntry {
  timestamps: number[]
}

const store = new Map<string, WindowEntry>()

// Evict stale entries every 60s to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, 60_000)

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetMs: number
}

/**
 * Check and record a request for the given key.
 * @param key       Unique identifier (e.g. IP + route)
 * @param max       Maximum requests allowed in the window
 * @param windowMs  Sliding window duration in milliseconds
 */
export function rateLimit(
  key: string,
  max: number = 60,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now()
  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0]!
    return { ok: false, remaining: 0, resetMs: windowMs - (now - oldest) }
  }

  entry.timestamps.push(now)
  return { ok: true, remaining: max - entry.timestamps.length, resetMs: windowMs }
}

/** Convenience: extract a rate-limit key from a Request (IP + pathname). */
export function rateLimitKey(req: Request, prefix: string = ''): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  const url = new URL(req.url)
  return `${prefix}:${ip}:${url.pathname}`
}
