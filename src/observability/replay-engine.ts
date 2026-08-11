/**
 * @module observability/replay-engine
 *
 * TypeScript port of the Rust ReplayEngine.
 * Protocol regression testing by replaying recorded traffic and comparing responses.
 * Supports fuzzy matching for timestamps, UUIDs, and other volatile fields.
 *
 * @example
 * ```ts
 * const engine = new ReplayEngine();
 * const result = engine.replay(recording, async (entry) => {
 *   return await fetch(entry.url, { method: entry.method, headers: entry.headers });
 * });
 * console.log(result.summary); // { total: 5, passed: 4, changed: 1, failed: 0 }
 * ```
 */

// ── Types ────────────────────────────────────────────────────────────

export type ReplayStatus = 'pass' | 'fail' | 'changed';

export interface ReplayEntry {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  expected?: {
    status: number;
    body?: string;
  };
}

export interface ReplayResult {
  status: ReplayStatus;
  entry: ReplayEntry;
  actualStatus: number | null;
  actualBody?: string;
  diff?: string;
  durationMs: number;
  error?: string;
}

export interface ReplaySummary {
  total: number;
  passed: number;
  changed: number;
  failed: number;
  results: ReplayResult[];
}

// ── Fuzzy Matching Patterns ───────────────────────────────────────────

/** Fields that are expected to change between replays. */
const VOLATILE_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  { name: 'uuid', pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '<UUID>' },
  { name: 'timestamp-iso', pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, replacement: '<TIMESTAMP>' },
  { name: 'timestamp-epoch', pattern: /(?<=[:"'\s=])\d{13,16}(?=["'\s,}])/g, replacement: '<EPOCH>' },
  { name: 'date-slash', pattern: /\d{2}\/\d{2}\/\d{2,4}/g, replacement: '<DATE>' },
];

/**
 * Normalize a string by replacing volatile fields with stable placeholders.
 */
function normalize(text: string): string {
  let result = text;
  for (const { pattern, replacement } of VOLATILE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Compute a line-level diff between two normalized strings.
 * Returns a summary of added/removed lines.
 */
function computeDiff(expected: string, actual: string): string {
  const normExpected = normalize(expected);
  const normActual = normalize(actual);

  if (normExpected === normActual) return '';

  const expectedLines = normExpected.split('\n');
  const actualLines = normActual.split('\n');
  const parts: string[] = [];

  const maxLen = Math.max(expectedLines.length, actualLines.length);
  let diffCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const exp = expectedLines[i] ?? '';
    const act = actualLines[i] ?? '';
    if (exp !== act) {
      parts.push(`L${i + 1}: - ${exp}`);
      parts.push(`L${i + 1}: + ${act}`);
      diffCount++;
      if (diffCount >= 20) {
        parts.push('... (truncated)');
        break;
      }
    }
  }

  return parts.join('\n');
}

// ── Replay Engine ─────────────────────────────────────────────────────

/**
 * Replays recorded traffic against a live target function and compares responses.
 *
 * The target function receives a `ReplayEntry` and should return an object
 * with `status` (HTTP status code) and optional `body` (response body string).
 */
export class ReplayEngine {
  private fuzzy: boolean;

  constructor(opts?: { fuzzy?: boolean }) {
    this.fuzzy = opts?.fuzzy ?? true;
  }

  /**
   * Replay a recording (list of entries) against a target function.
   *
   * Each entry is sent to the target function. The response is compared
   * to the expected response (if present). Entries without an expected
   * response are recorded but always marked as 'pass' (smoke test).
   */
  async replay(
    recording: ReplayEntry[],
    targetFn: (entry: ReplayEntry) => Promise<{ status: number; body?: string }>,
  ): Promise<ReplaySummary> {
    const results: ReplayResult[] = [];

    for (const entry of recording) {
      const start = performance.now();
      let result: ReplayResult;

      try {
        const response = await targetFn(entry);
        const durationMs = Math.round(performance.now() - start);

        if (!entry.expected) {
          // No expected response — smoke test only
          result = {
            status: 'pass',
            entry,
            actualStatus: response.status,
            actualBody: response.body,
            durationMs,
          };
        } else {
          const statusMatch = response.status === entry.expected.status;
          const bodyMatch =
            entry.expected.body === undefined ||
            this.fuzzy
              ? normalize(response.body ?? '') === normalize(entry.expected.body)
              : (response.body ?? '') === entry.expected.body;

          if (statusMatch && bodyMatch) {
            result = {
              status: 'pass',
              entry,
              actualStatus: response.status,
              actualBody: response.body,
              durationMs,
            };
          } else if (statusMatch && !bodyMatch) {
            const diff = computeDiff(entry.expected.body ?? '', response.body ?? '');
            result = {
              status: 'changed',
              entry,
              actualStatus: response.status,
              actualBody: response.body,
              diff,
              durationMs,
            };
          } else {
            result = {
              status: 'fail',
              entry,
              actualStatus: response.status,
              actualBody: response.body,
              diff: `Status: expected ${entry.expected.status}, got ${response.status}`,
              durationMs,
            };
          }
        }
      } catch (err) {
        result = {
          status: 'fail',
          entry,
          actualStatus: null,
          durationMs: Math.round(performance.now() - start),
          error: err instanceof Error ? err.message : String(err),
        };
      }

      results.push(result);
    }

    const passed = results.filter((r) => r.status === 'pass').length;
    const changed = results.filter((r) => r.status === 'changed').length;
    const failed = results.filter((r) => r.status === 'fail').length;

    return { total: results.length, passed, changed, failed, results };
  }
}
