/**
 * sdk/canvas/unified-io-client.ts
 * --------------------------------------------------------------------
 * E5 — SDK client wrapping the UnifiedIO contract. Plugin authors use
 * this for ALL HTTP/SSE/postMessage communication. Enforces traceId
 * propagation, error normalization, retry, and dedup.
 *
 * This is the canonical IO client. The browser provider
 * (components/canvas/UnifiedIOProvider.tsx) is the React binding; this
 * module is framework-agnostic and usable from any context.
 */

import type {
  UnifiedIO,
  IORequestInit,
  IOResponse,
  IOMethod,
  IOEvent,
  IOEventListener,
  SSESubscription,
} from '../../shared/unified-io';
import { IOError } from '../../shared/unified-io';

export function createUnifiedIO(opts: { fetchImpl?: typeof fetch; ulidImpl?: () => string } = {}): UnifiedIO {
  const f = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!f) throw new Error('No fetch implementation available');
  const ulid = opts.ulidImpl ?? (() => `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const listeners = new Set<IOEventListener>();
  const inFlight = new Map<string, Promise<IOResponse<unknown>>>();

  const emit = (event: IOEvent) => {
    for (const l of listeners) {
      try {
        l(event);
      } catch {
        // ignore
      }
    }
  };

  const buildUrl = (url: string, query?: Record<string, string | number | boolean | undefined>) => {
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
  };

  return {
    async request<T>(url: string, init?: IORequestInit): Promise<IOResponse<T>> {
      const method: IOMethod = init?.method ?? 'GET';
      const traceId = init?.traceId ?? ulid();
      const startedAt = Date.now();
      const fullUrl = buildUrl(url, init?.query);
      const timeoutMs = init?.timeoutMs ?? 30_000;
      const retries = init?.retries ?? 2;
      const dedupe = init?.dedupe ?? method === 'GET';
      const dedupeKey = `${method}|${fullUrl}`;
      if (dedupe && inFlight.has(dedupeKey)) {
        return (await inFlight.get(dedupeKey)!) as IOResponse<T>;
      }

      const doFetch = async (attempt: number): Promise<IOResponse<T>> => {
        emit({ type: 'request:start', traceId, method, url: fullUrl, timestamp: Date.now() });
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        if (init?.signal) {
          init.signal.addEventListener('abort', () => controller.abort());
        }
        try {
          const headers: Record<string, string> = { 'X-Trace-Id': traceId, ...(init?.headers ?? {}) };
          let body: BodyInit | undefined;
          if (init?.body !== undefined) {
            headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
            body = JSON.stringify(init.body);
          }
          const res = await f(fullUrl, { method, headers, body, signal: controller.signal });
          clearTimeout(timeoutHandle);
          const text = await res.text();
          let data: unknown;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = text;
          }
          if (!res.ok) {
            const errMsg = (data as { error?: string })?.error ?? `HTTP ${res.status}`;
            throw new IOError(errMsg, res.status, traceId);
          }
          const responseHeaders: Record<string, string> = {};
          res.headers.forEach((v, k) => {
            responseHeaders[k] = v;
          });
          const result: IOResponse<T> = {
            ok: true,
            status: res.status,
            data: data as T,
            traceId,
            durationMs: Date.now() - startedAt,
            headers: responseHeaders,
          };
          emit({ type: 'request:success', traceId, method, url: fullUrl, status: res.status, durationMs: result.durationMs, timestamp: Date.now() });
          return result;
        } catch (err) {
          clearTimeout(timeoutHandle);
          const isAbort = err instanceof Error && err.name === 'AbortError';
          if (attempt < retries && !isAbort) {
            await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)));
            return doFetch(attempt + 1);
          }
          const ioError = err instanceof IOError ? err : new IOError(isAbort ? 'Request timed out' : String(err), 0, traceId, err);
          emit({ type: 'request:error', traceId, method, url: fullUrl, error: ioError.message, timestamp: Date.now() });
          throw ioError;
        }
      };

      const promise = doFetch(0).finally(() => inFlight.delete(dedupeKey));
      if (dedupe) inFlight.set(dedupeKey, promise as Promise<IOResponse<unknown>>);
      return promise;
    },

    async get<T>(url: string, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>> {
      return this.request<T>(url, { ...init, method: 'GET' });
    },
    async post<T>(url: string, body?: unknown, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>> {
      return this.request<T>(url, { ...init, method: 'POST', body });
    },
    async patch<T>(url: string, body?: unknown, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>> {
      return this.request<T>(url, { ...init, method: 'PATCH', body });
    },

    subscribeSSE(url: string, onEvent: (data: unknown) => void, onError?: (err: Error) => void): SSESubscription {
      const traceId = ulid();
      const Es = (typeof EventSource !== 'undefined' ? EventSource : undefined) as typeof EventSource | undefined;
      if (!Es) {
        onError?.(new Error('EventSource not available'));
        return { url, traceId, close: () => {} };
      }
      const es = new Es(url);
      emit({ type: 'sse:open', traceId, url, timestamp: Date.now() });
      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as unknown;
          emit({ type: 'sse:event', traceId, url, data, timestamp: Date.now() });
          onEvent(data);
        } catch {
          // ignore
        }
      };
      es.onerror = () => {
        const err = new Error('SSE connection error');
        emit({ type: 'sse:error', traceId, url, error: err.message, timestamp: Date.now() });
        onError?.(err);
      };
      return {
        url,
        traceId,
        close: () => {
          es.close();
          emit({ type: 'sse:close', traceId, url, timestamp: Date.now() });
        },
      };
    },

    postToSandbox(_instanceId: string, _message: unknown): void {
      // No-op in the framework-agnostic client. The React provider
      // overrides this with the real MessagePort bridge.
    },

    on(listener: IOEventListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    newTraceId(): string {
      return ulid();
    },

    setAuthToken(_token: string | null): void {
      // No-op in the framework-agnostic client.
      // The React provider (UnifiedIOProvider) handles token persistence.
    },
  };
}
