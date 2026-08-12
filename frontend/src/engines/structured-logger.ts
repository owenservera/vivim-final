/**
 * engines/structured-logger.ts
 * --------------------------------------------------------------------
 * traceId-keyed structured spans (bundle 04 logger.ts + bundle 02 §C.1).
 * Each routeSync() call opens a span; child spans inherit traceId.
 */

export interface StructuredLog {
  ts: number;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  msg: string;
  engine?: string;
  traceId?: string;
  parentSpanId?: string;
  spanId?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

export type LogSink = (entry: StructuredLog) => void;

const LEVEL_RANK: Record<string, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  engine: string;
  startedAt: number;
  msg: string;
  data?: Record<string, unknown>;
}

let spanCounter = 0;

function nextSpanId(): string {
  spanCounter += 1;
  return `span-${spanCounter.toString(36)}-${Date.now().toString(36)}`;
}

export class StructuredLogger {
  private sinks: LogSink[] = [];
  private minRank: number;

  constructor(minLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' = 'info') {
    this.minRank = LEVEL_RANK[minLevel] ?? 2;
  }

  addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  start(
    traceId: string,
    engine: string,
    msg: string,
    data?: Record<string, unknown>,
    parentSpanId?: string,
  ): Span {
    const span: Span = {
      spanId: nextSpanId(),
      traceId,
      parentSpanId,
      engine,
      startedAt: Date.now(),
      msg,
      data,
    };
    this.write('debug', engine, `start: ${msg}`, { traceId, spanId: span.spanId, ...data }, traceId);
    return span;
  }

  end(span: Span, data?: Record<string, unknown>): void {
    const durationMs = Date.now() - span.startedAt;
    this.write(
      'debug',
      span.engine,
      `end: ${span.msg}`,
      { traceId: span.traceId, spanId: span.spanId, durationMs, ...data },
      span.traceId,
    );
  }

  info(engine: string, msg: string, data?: Record<string, unknown>, traceId?: string): void {
    this.write('info', engine, msg, data, traceId);
  }

  warn(engine: string, msg: string, data?: Record<string, unknown>, traceId?: string): void {
    this.write('warn', engine, msg, data, traceId);
  }

  error(engine: string, msg: string, data?: Record<string, unknown>, traceId?: string): void {
    this.write('error', engine, msg, data, traceId);
  }

  private write(
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    engine: string,
    msg: string,
    data?: Record<string, unknown>,
    traceId?: string,
  ): void {
    if ((LEVEL_RANK[level] ?? 0) < this.minRank) return;
    const entry: StructuredLog = {
      ts: Date.now(),
      level,
      msg,
      engine,
      traceId,
      data,
    };
    for (const sink of this.sinks) {
      try {
        sink(entry);
      } catch {
  // [audit] log the error with context here
        // Sink failure must never break the bus.
      }
    }
  }
}

/** TraceEntry store — append-only, queryable by traceId (bundle 02 §C.1). */
export interface TraceEntry {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  engine: string;
  method: string;
  providerId?: string;
  accountId?: string;
  conversationId?: string;
  workspaceId?: string;
  durationMs: number;
  ok: boolean;
  error?: string;
  createdAt: number;
}

export class TraceStore {
  private entries: TraceEntry[] = [];
  private byTrace = new Map<string, TraceEntry[]>();

  append(entry: TraceEntry): void {
    this.entries.push(entry);
    if (this.entries.length > 5_000) this.entries.shift();
    let bucket = this.byTrace.get(entry.traceId);
    if (!bucket) {
      bucket = [];
      this.byTrace.set(entry.traceId, bucket);
    }
    bucket.push(entry);
  }

  findByTrace(traceId: string): TraceEntry[] {
    return this.byTrace.get(traceId) ?? [];
  }

  recent(limit = 100): TraceEntry[] {
    return this.entries.slice(-limit);
  }

  clear(): void {
    this.entries = [];
    this.byTrace.clear();
  }
}
