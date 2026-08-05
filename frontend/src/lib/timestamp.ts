// frontend/src/lib/timestamp.ts
// Timestamp conversion utilities.
// Backend uses number (Unix epoch ms), frontend prefers ISO 8601 strings.
//
// Work Item 04: Timestamp handling standardization.

/**
 * Convert a backend timestamp (number, Unix epoch ms) to an ISO 8601 string.
 * Returns undefined for null/undefined inputs.
 */
export function toISO(timestamp: number | null | undefined): string | undefined {
  if (timestamp == null) return undefined
  return new Date(timestamp).toISOString()
}

/**
 * Convert an ISO 8601 string or Date to a Unix epoch ms number.
 * Returns undefined for null/undefined inputs.
 */
export function fromISO(timestamp: string | Date | null | undefined): number | undefined {
  if (timestamp == null) return undefined
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp.getTime()
  return Number.isFinite(ms) ? ms : undefined
}

/**
 * Safely parse a potentially numeric or string timestamp to ISO string.
 * Handles both backend number format and frontend string format.
 */
export function normalizeToISO(timestamp: number | string | null | undefined): string | undefined {
  if (timestamp == null) return undefined
  if (typeof timestamp === 'number') return new Date(timestamp).toISOString()
  const ms = new Date(timestamp).getTime()
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined
}
