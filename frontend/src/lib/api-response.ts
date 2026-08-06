// frontend/src/lib/api-response.ts
// P3-7: Standardized response helpers for Next.js API routes.
// Usage: import { apiSuccess, apiError } from '@/lib/api-response'

/**
 * Standard success response shape for in-process routes.
 */
export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status })
}

/**
 * Standard error response shape for in-process routes.
 */
export function apiError(message: string, status = 500, details?: unknown) {
  return Response.json({ ok: false, error: message, details }, { status })
}
