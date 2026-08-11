/**
 * Protocol Replay Engine
 * ======================
 * Replays recorded HTTP traffic against API endpoints in two modes:
 *
 * - **mock**       — Compares stored response shape against a baseline shape
 *                    without making any network calls.
 * - **authenticated** — Makes a live HTTP request using the stored envelope's
 *                    headers (minus redacted ones) and diffs the live response
 *                    against the baseline.
 */

import type { CompatibilityReport } from './schema-inference.js';
import {
  inferShape,
  computeHash,
  diffShapes,
  assessCompatibility,
} from './schema-inference.js';
import type { TrafficEnvelope, TrafficStore } from './traffic-recorder.js';

// ─── Public Types ───────────────────────────────────────────────────────

/** Replay execution mode. */
export type ReplayMode = 'mock' | 'authenticated';

/** Result of a single replay execution. */
export interface ReplayResult {
  /** ID of the source envelope that was replayed. */
  envelopeId: string;
  /** The mode used for this replay. */
  mode: ReplayMode;
  /** ISO-8601 timestamp of when the replay was executed. */
  timestamp: string;
  /** `true` when the replay completed without errors. */
  success: boolean;
  /** End-to-end latency of the replay in milliseconds. */
  latencyMs: number;
  /** HTTP status code (stored for mock, live for authenticated). */
  responseStatus: number;
  /** Compatibility report comparing response shape against the baseline. */
  compatibility: CompatibilityReport;
  /** Human-readable error message when `success` is `false`. */
  error?: string;
}

// ─── Internal Constants ─────────────────────────────────────────────────

/** Request timeout in milliseconds for authenticated replays. */
const REPLAY_TIMEOUT_MS = 15_000;

/** Store key prefix for baseline shape snapshots. */
const BASELINE_PREFIX = 'obs:baseline:';

// ─── Internal Helpers ───────────────────────────────────────────────────

/**
 * Build a baseline key from provider ID + endpoint.
 */
function baselineKey(providerId: string, endpoint: string): string {
  return `${BASELINE_PREFIX}${providerId}:${endpoint}`;
}

/**
 * Remove headers whose values are redacted placeholders so they don't
 * leak into live requests.
 */
function cleanHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const redactedMarkers = ['[REDACTED]', '[REDACTED BEARER TOKEN IN BODY]'];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (redactedMarkers.some((m) => v.includes(m))) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Safely parse a JSON string, returning `null` on failure.
 */
function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Generate a baseline compatibility report.
 *
 * If no baseline exists yet, the current shape **becomes** the baseline
 * and the report indicates full compatibility.
 */
async function compareAgainstBaseline(
  store: TrafficStore,
  providerId: string,
  endpoint: string,
  responseShape: unknown,
): Promise<{ report: CompatibilityReport; baselineHash: string }> {
  const key = baselineKey(providerId, endpoint);
  const currentHash = computeHash(responseShape);

  const stored = await store.get(key);

  if (stored && typeof stored === 'object' && 'hash' in (stored as object)) {
    const baseline = stored as { hash: string; shape: unknown };
    const diffs = diffShapes(baseline.shape, responseShape);
    const report = assessCompatibility(diffs);
    return { report, baselineHash: baseline.hash };
  }

  // No baseline yet — store current shape as the new baseline
  await store.put(key, { hash: currentHash, shape: responseShape });
  return {
    report: { isCompatible: true, severity: 'none', diffs: [] },
    baselineHash: currentHash,
  };
}

// ─── createReplayEngine ─────────────────────────────────────────────────

/**
 * Dependencies injected into the replay engine.
 */
export interface ReplayEngineDeps {
  /** Key-value store used to retrieve envelopes and baselines. */
  store: TrafficStore;
}

/**
 * Returned by `createReplayEngine`.
 */
export interface ReplayEngine {
  /**
   * Replay a previously recorded envelope.
   *
   * @param envelopeId - UUID of the stored envelope.
   * @param mode       - `'mock'` for offline diff, `'authenticated'` for live request.
   * @returns A {@link ReplayResult} with timing, compatibility, and status.
   */
  replay(envelopeId: string, mode: ReplayMode): Promise<ReplayResult>;
}

/**
 * Factory that creates a {@link ReplayEngine}.
 *
 * @param deps - Injected dependencies (store).
 * @returns A `ReplayEngine` instance.
 */
export function createReplayEngine(deps: ReplayEngineDeps): ReplayEngine {
  const { store } = deps;

  return {
    async replay(
      envelopeId: string,
      mode: ReplayMode,
    ): Promise<ReplayResult> {
      const startTime = Date.now();
      const timestamp = new Date().toISOString();

      // ── Load stored envelope ──
      const rawEnvelope = await store.get(`obs:env:${envelopeId}`);
      if (
        !rawEnvelope ||
        typeof rawEnvelope !== 'object' ||
        !('id' in rawEnvelope)
      ) {
        return {
          envelopeId,
          mode,
          timestamp,
          success: false,
          latencyMs: Date.now() - startTime,
          responseStatus: 0,
          compatibility: { isCompatible: true, severity: 'none', diffs: [] },
          error: `Envelope not found: ${envelopeId}`,
        };
      }

      const envelope = rawEnvelope as TrafficEnvelope;

      try {
        if (mode === 'mock') {
          return await replayMock(
            store,
            envelope,
          );
        }

        return await replayAuthenticated(store, envelope);
      } catch (err) {
        return {
          envelopeId,
          mode,
          timestamp,
          success: false,
          latencyMs: Date.now() - startTime,
          responseStatus: 0,
          compatibility: { isCompatible: true, severity: 'none', diffs: [] },
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

// ─── Mode Implementations ──────────────────────────────────────────────

/**
 * Mock replay: infer the shape of the stored response body, diff against
 * the persisted baseline, and return the compatibility report.
 */
async function replayMock(
  store: TrafficStore,
  envelope: TrafficEnvelope,
): Promise<ReplayResult> {
  const startTime = Date.now();

  const parsedBody = safeParse(envelope.responseBody);
  const shape = parsedBody !== null ? inferShape(parsedBody) : 'string';

  const endpoint = extractPath(envelope.requestUrl);
  const { report } = await compareAgainstBaseline(
    store,
    envelope.providerId,
    endpoint,
    shape,
  );

  return {
    envelopeId: envelope.id,
    mode: 'mock',
    timestamp: new Date().toISOString(),
    success: true,
    latencyMs: Date.now() - startTime,
    responseStatus: envelope.responseStatus,
    compatibility: report,
  };
}

/**
 * Authenticated replay: make a live HTTP request with the stored envelope's
 * headers (minus redacted ones), infer the shape of the live response,
 * and diff against the baseline.
 */
async function replayAuthenticated(
  store: TrafficStore,
  envelope: TrafficEnvelope,
): Promise<ReplayResult> {
  const startTime = Date.now();

  // Clean headers — remove any that were redacted
  const headers = cleanHeaders(envelope.requestHeaders);

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REPLAY_TIMEOUT_MS);

  let responseStatus: number;
  let responseBody: string;

  try {
    const fetchOptions: RequestInit = {
      method: envelope.requestMethod,
      headers,
      signal: controller.signal,
    };

    // Attach body for methods that support it
    if (
      envelope.requestMethod !== 'GET' &&
      envelope.requestMethod !== 'HEAD' &&
      envelope.requestBody
    ) {
      fetchOptions.body = envelope.requestBody;
    }

    const response = await fetch(envelope.requestUrl, fetchOptions);
    responseStatus = response.status;
    responseBody = await response.text();
  } catch (err) {
    clearTimeout(timeoutId);
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? `Replay timed out after ${REPLAY_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : String(err);

    return {
      envelopeId: envelope.id,
      mode: 'authenticated',
      timestamp: new Date().toISOString(),
      success: false,
      latencyMs: Date.now() - startTime,
      responseStatus: 0,
      compatibility: { isCompatible: true, severity: 'none', diffs: [] },
      error: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }

  // Infer shape of the live response and compare
  const parsedBody = safeParse(responseBody);
  const shape = parsedBody !== null ? inferShape(parsedBody) : 'string';

  const endpoint = extractPath(envelope.requestUrl);
  const { report } = await compareAgainstBaseline(
    store,
    envelope.providerId,
    endpoint,
    shape,
  );

  return {
    envelopeId: envelope.id,
    mode: 'authenticated',
    timestamp: new Date().toISOString(),
    success: true,
    latencyMs: Date.now() - startTime,
    responseStatus,
    compatibility: report,
  };
}

/**
 * Extract the path portion of a URL (without origin / query string).
 */
function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
 } catch {
    // Fallback: treat the whole string as the path
    return url;
  }
}
