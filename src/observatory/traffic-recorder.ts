/**
 * Traffic Recorder
 * =================
 * Records HTTP request/response envelopes with automatic secret redaction.
 *
 * This is a TypeScript re-implementation of a Rust traffic-recording
 * component. It has zero framework dependencies and relies on a pluggable
 * key-value store for persistence.
 */

import { randomUUID } from 'node:crypto'

// ─── Public Types ───────────────────────────────────────────────────────

/** A complete HTTP round-trip envelope. */
export interface TrafficEnvelope {
  /** Unique identifier for this recorded exchange. */
  id: string
  /** Identifier of the API provider (e.g. "openai", "anthropic"). */
  providerId: string
  /** Optional account / project identifier. */
  accountId?: string
  /** ISO-8601 timestamp of when the request was initiated. */
  timestamp: string
  /** Full request URL (with query string). */
  requestUrl: string
  /** HTTP method (GET, POST, …). */
  requestMethod: string
  /** Request headers (lower-cased keys). */
  requestHeaders: Record<string, string>
  /** Raw request body as a string (empty string for GET). */
  requestBody: string
  /** HTTP response status code (e.g. 200, 429). */
  responseStatus: number
  /** Response headers (lower-cased keys). */
  responseHeaders: Record<string, string>
  /** Raw response body as a string. */
  responseBody: string
  /** Round-trip latency in milliseconds. */
  timingMs: number
}

/** Minimal key-value store contract required by the traffic recorder. */
export interface TrafficStore {
  put(key: string, value: unknown): Promise<void>
  get(key: string): Promise<unknown | null>
}

/** Returned by `createTrafficRecorder`. */
export interface TrafficRecorder {
  /** Redact and persist a traffic envelope. */
  record(envelope: TrafficEnvelope): Promise<void>
  /** Retrieve a single envelope by ID. Returns `null` if not found. */
  getEnvelope(id: string): Promise<TrafficEnvelope | null>
  /**
   * List envelopes sorted by timestamp descending.
   *
   * @param offset - Number of envelopes to skip (default 0).
   * @param limit  - Maximum envelopes to return (default 50).
   */
  listEnvelopes(offset?: number, limit?: number): Promise<TrafficEnvelope[]>
}

// ─── Internal Constants ─────────────────────────────────────────────────

/** Header names that must be redacted (all lower-case for matching). */
const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'x-goog-api-key',
  'x-csrf-token',
  'sec-ch-ua-authorization',
])

const REDACTED_VALUE = '[REDACTED]'
const STORE_PREFIX = 'obs:env:'
const INDEX_KEY = 'obs:index'

// ─── 1. redactSecrets ───────────────────────────────────────────────────

/**
 * Mutate an envelope **in place**, replacing sensitive header values and
 * body patterns with safe placeholders.
 *
 * Redacted headers:
 * - `authorization`, `cookie`, `x-api-key`, `x-goog-api-key`,
 *   `x-csrf-token`, `sec-ch-ua-authorization`
 *
 * Redacted body patterns:
 * - `at=...` (common in URL-encoded auth tokens) → `at=[REDACTED]`
 * - `Bearer ...` → `[REDACTED BEARER TOKEN IN BODY]`
 *
 * @param envelope - The envelope to sanitise (mutated in place).
 */
export function redactSecrets(envelope: TrafficEnvelope): void {
  // ── Redact headers ──
  redactHeaders(envelope.requestHeaders)
  redactHeaders(envelope.responseHeaders)

  // ── Redact body patterns ──
  envelope.requestBody = redactBodyPatterns(envelope.requestBody)
  envelope.responseBody = redactBodyPatterns(envelope.responseBody)
}

/**
 * Replace sensitive values in a header map (mutates in place).
 */
function redactHeaders(headers: Record<string, string>): void {
  for (const key of Object.keys(headers)) {
    if (REDACTED_HEADERS.has(key.toLowerCase())) {
      headers[key] = REDACTED_VALUE
    }
  }
}

/**
 * Replace known secret patterns in a string body.
 */
function redactBodyPatterns(body: string): string {
  let result = body

  // at=... tokens (URL-encoded or query-string style)
  result = result.replace(/at=[^&\s"]+/g, 'at=[REDACTED]')

  // Bearer tokens in JSON strings or text
  result = result.replace(/Bearer\s+[\w\-._~+/]+=*/g, '[REDACTED BEARER TOKEN IN BODY]')

  return result
}

// ─── 2. createTrafficRecorder ───────────────────────────────────────────

/**
 * Factory that creates a {@link TrafficRecorder} backed by the given store.
 *
 * The recorder maintains an internal index of envelope IDs ordered by
 * timestamp so that `listEnvelopes` can return results in descending
 * chronological order without a full scan.
 *
 * @param store - A key-value store implementing `put` and `get`.
 * @returns A `TrafficRecorder` instance.
 */
export function createTrafficRecorder(store: TrafficStore): TrafficRecorder {
  /**
   * Read and deserialise the envelope ID index from the store.
   * Returns an empty array if the key doesn't exist or is corrupt.
   */
  async function readIndex(): Promise<Array<{ id: string; timestamp: string }>> {
    try {
      const raw = await store.get(INDEX_KEY)
      if (Array.isArray(raw)) {
        return raw as Array<{ id: string; timestamp: string }>
      }
      return []
    } catch {
      return []
    }
  }

  /**
   * Persist the updated envelope ID index.
   */
  async function writeIndex(index: Array<{ id: string; timestamp: string }>): Promise<void> {
    await store.put(INDEX_KEY, index)
  }

  return {
    /**
     * Redact secrets from the envelope and persist it to the store.
     * The envelope's `id` field is assigned a fresh UUID if empty.
     */
    async record(envelope: TrafficEnvelope): Promise<void> {
      // Assign ID if not provided
      if (!envelope.id) {
        envelope.id = randomUUID()
      }

      // Sanitise in place
      redactSecrets(envelope)

      // Persist the envelope itself
      await store.put(STORE_PREFIX + envelope.id, envelope)

      // Update the index (insert sorted by timestamp desc)
      const index = await readIndex()
      index.push({ id: envelope.id, timestamp: envelope.timestamp })
      index.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      await writeIndex(index)
    },

    /**
     * Retrieve a single envelope by its unique ID.
     *
     * @param id - The envelope's UUID.
     * @returns The envelope or `null` if not found.
     */
    async getEnvelope(id: string): Promise<TrafficEnvelope | null> {
      try {
        const raw = await store.get(STORE_PREFIX + id)
        if (raw && typeof raw === 'object' && 'id' in (raw as object)) {
          return raw as TrafficEnvelope
        }
        return null
      } catch {
        return null
      }
    },

    /**
     * List envelopes sorted by timestamp descending.
     *
     * @param offset - Items to skip (default `0`).
     * @param limit  - Maximum items to return (default `50`, max `200`).
     * @returns Array of matching envelopes (may be fewer than `limit`).
     */
    async listEnvelopes(offset = 0, limit = 50): Promise<TrafficEnvelope[]> {
      const cappedLimit = Math.min(Math.max(0, limit), 200)
      const index = await readIndex()
      const slice = index.slice(offset, offset + cappedLimit)

      const envelopes: TrafficEnvelope[] = []
      for (const entry of slice) {
        const env = await store.get(STORE_PREFIX + entry.id)
        if (env && typeof env === 'object' && 'id' in (env as object)) {
          envelopes.push(env as TrafficEnvelope)
        }
      }
      return envelopes
    },
  }
}
