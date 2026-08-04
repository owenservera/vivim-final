// src/lib/safe-json.ts
// Safe JSON.parse with fallback — prevents crashes on malformed DB/file data.

/**
 * Parse JSON safely, returning `fallback` on any error.
 * Handles null/undefined/empty input gracefully.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Parse JSON safely, returning null on any error (no fallback needed).
 */
export function safeJsonOrNull(raw: string | null | undefined): unknown | null {
  if (raw == null || raw === '') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
