/**
 * @module observability/traffic-recorder
 *
 * TypeScript port of the Rust TrafficRecorder.
 * Records HTTP traffic with automatic secret redaction via regex patterns.
 * Supports API keys, bearer tokens, authorization headers, and custom patterns.
 *
 * @example
 * ```ts
 * const recorder = new TrafficRecorder();
 * recorder.recordRequest({ url: 'https://api.example.com/data', method: 'GET', headers: { authorization: 'Bearer sk-1234' } });
 * const entries = recorder.getEntries();
 * // → entries[0].headers.authorization is '[REDACTED]'
 * ```
 */

// ── Types ────────────────────────────────────────────────────────

export interface TrafficEntry {
  timestamp: string;
  direction: 'request' | 'response';
  url: string;
  method?: string;
  status?: number;
  headers: Record<string, string>;
  body?: string;
  redactedFields: string[];
}

export interface RedactionPattern {
  name: string;
  pattern: RegExp;
  /** Fields to which this pattern applies (e.g. 'headers', 'body', 'url'). */
  fields: string[];
}

// ── Default Redaction Patterns ─────────────────────────────────────

const DEFAULT_PATTERNS: RedactionPattern[] = [
  {
    name: 'bearer-token',
    pattern: /Bearer\s+[\w\-._~+/]+=*/gi,
    fields: ['headers.authorization', 'headers.proxy-authorization', 'body'],
  },
  {
    name: 'api-key-query',
    pattern: /(?:api[_-]?key|apikey|token|secret|password)=[^&\s"]+/gi,
    fields: ['url', 'body'],
  },
  {
    name: 'aws-auth',
    pattern: /AWS4-HMAC-SHA256\s+[\w\-/+=]+/gi,
    fields: ['headers.authorization', 'headers.x-amz-content-sha256'],
  },
  {
    name: 'basic-auth',
    pattern: /Basic\s+[A-Za-z0-9+/=]+/gi,
    fields: ['headers.authorization'],
  },
  {
    name: 'sk-prefix-key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    fields: ['url', 'headers', 'body'],
  },
  {
    name: 'generic-secret',
    pattern: /(?:secret|token|password)\s*[:=]\s*['"]?[^'"&\s,}]{8,}/gi,
    fields: ['body', 'url'],
  },
];

// ── Traffic Recorder ─────────────────────────────────────────────────

/**
 * Records HTTP traffic entries with automatic secret redaction.
 *
 * Each recorded entry is cloned and sanitized before storage.
 * Custom redaction patterns can be added via {@link addPattern}.
 */
export class TrafficRecorder {
  private entries: TrafficEntry[] = [];
  private patterns: RedactionPattern[];
  private _maxEntries: number;

  constructor(opts?: { maxEntries?: number; extraPatterns?: RedactionPattern[] }) {
    this._maxEntries = opts?.maxEntries ?? 10_000;
    this.patterns = [...DEFAULT_PATTERNS];
    if (opts?.extraPatterns) {
      this.patterns.push(...opts.extraPatterns);
    }
  }

  /**
   * Record a traffic entry after redacting secrets.
   */
  recordRequest(entry: Omit<TrafficEntry, 'timestamp' | 'redactedFields' | 'direction'>): TrafficEntry {
    const timestamp = new Date().toISOString();
    const { headers, body, url, ...rest } = entry;
    const clonedHeaders = { ...headers };
    const clonedBody = body ? String(body) : undefined;
    const clonedUrl = url;

    const redactedFields: string[] = [];

    const applyPatterns = (value: string, fieldPath: string): string => {
      let result = value;
      for (const p of this.patterns) {
        if (p.fields.some((f) => fieldPath.startsWith(f) || f === 'headers' || f === 'body' || f === 'url')) {
          if (p.pattern.test(result)) {
            redactedFields.push(p.name);
            result = result.replace(p.pattern, '[REDACTED:$&]');
          }
        }
      }
      return result;
    };

    // Redact URL
    const redactedUrl = applyPatterns(clonedUrl, 'url');

    // Redact headers
    const redactedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(clonedHeaders)) {
      redactedHeaders[key] = applyPatterns(value, `headers.${key.toLowerCase()}`);
    }

    // Redact body
    const redactedBody = clonedBody ? applyPatterns(clonedBody, 'body') : undefined;

    const record: TrafficEntry = {
      timestamp,
      direction: 'request',
      url: redactedUrl,
      headers: redactedHeaders,
      body: redactedBody,
      redactedFields: [...new Set(redactedFields)],
      ...rest,
    };

    this.entries.push(record);
    if (this.entries.length > this._maxEntries) {
      this.entries.shift();
    }

    return record;
  }

  /**
   * Record a response entry.
   */
  recordResponse(entry: Omit<TrafficEntry, 'timestamp' | 'redactedFields' | 'direction'>): TrafficEntry {
    const record: TrafficEntry = {
      timestamp: new Date().toISOString(),
      direction: 'response',
      headers: { ...entry.headers },
      url: entry.url,
      body: entry.body,
      redactedFields: [],
      ...entry,
    };
    this.entries.push(record);
    if (this.entries.length > this._maxEntries) {
      this.entries.shift();
    }
    return record;
  }

  /** Get all recorded entries. */
  getEntries(): TrafficEntry[] {
    return this.entries.slice();
  }

  /** Get entries filtered by URL pattern. */
  getByUrl(urlPattern: RegExp): TrafficEntry[] {
    return this.entries.filter((e) => urlPattern.test(e.url));
  }

  /** Clear all entries. */
  clear(): void {
    this.entries.length = 0;
  }

  /** Add a custom redaction pattern. */
  addPattern(pattern: RedactionPattern): void {
    this.patterns.push(pattern);
  }

  /** Get current redaction patterns (for diagnostics). */
  getPatterns(): RedactionPattern[] {
    return this.patterns.slice();
  }
}
