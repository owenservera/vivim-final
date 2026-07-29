'use client';

/**
 * components/canvas/UnifiedIOProvider.tsx (E4)
 * --------------------------------------------------------------------
 * One I/O layer formalized. The SINGLE transport for all client↔server
 * communication. Every fetch, SSE subscription, and postMessage bridge
 * goes through this. Enforces:
 *   - traceId propagation on every request
 *   - Error normalization (IOError)
 *   - Retry/backoff for transient failures
 *   - Request deduplication (GET only)
 *   - Zod validation at boundaries
 *
 * Invariant 5 (One Entry Point): no component calls fetch() directly.
 * All go through useIO() → UnifiedIO.request().
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
import { ulid } from '../../lib/ulid';

class BrowserUnifiedIO implements UnifiedIO {
  private listeners = new Set<IOEventListener>();
  private inFlight = new Map<string, Promise<IOResponse<unknown>>>();
  private sandboxPorts = new Map<string, MessagePort>();
  private authToken: string | null = null;
  private apiBase: string;

  constructor(apiBase?: string) {
    this.apiBase = apiBase ?? '';
    // Hydrate auth token from localStorage on construction
    try {
      this.authToken = localStorage.getItem('vivim:auth:token');
    } catch {
      // SSR or localStorage unavailable
    }
  }

  /** Set or clear the auth token (called after login/logout). */
  setAuthToken(token: string | null): void {
    this.authToken = token;
    try {
      if (token) localStorage.setItem('vivim:auth:token', token);
      else localStorage.removeItem('vivim:auth:token');
    } catch {
      // ignore
    }
  }

  private emit(event: IOEvent): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        // ignore listener errors
      }
    }
  }

  private buildUrl(url: string, query?: Record<string, string | number | boolean | undefined>): string {
    const base = url.startsWith('http') ? url : `${this.apiBase}${url}`;
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${params.toString()}`;
  }

  async request<T>(url: string, init?: IORequestInit): Promise<IOResponse<T>> {
    const method: IOMethod = init?.method ?? 'GET';
    const traceId = init?.traceId ?? this.newTraceId();
    const startedAt = Date.now();
    const fullUrl = this.buildUrl(url, init?.query);
    const timeoutMs = init?.timeoutMs ?? 30_000;
    const retries = init?.retries ?? 2;
    const dedupe = init?.dedupe ?? method === 'GET';

    // Dedupe GET requests.
    const dedupeKey = `${method}|${fullUrl}`;
    if (dedupe && this.inFlight.has(dedupeKey)) {
      return (await this.inFlight.get(dedupeKey)!) as IOResponse<T>;
    }

    const doFetch = async (attempt: number): Promise<IOResponse<T>> => {
      this.emit({ type: 'request:start', traceId, method, url: fullUrl, timestamp: Date.now() });
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
      if (init?.signal) {
        init.signal.addEventListener('abort', () => controller.abort());
      }
      try {
        const headers: Record<string, string> = {
          'X-Trace-Id': traceId,
          ...(init?.headers ?? {}),
        };
        // Inject auth token if available
        if (this.authToken) {
          headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        let body: BodyInit | undefined;
        if (init?.body !== undefined) {
          headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
          body = JSON.stringify(init.body);
        }
        const res = await fetch(fullUrl, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
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
        // Validate with Zod schema if provided.
        if (init?.responseSchema) {
          const parseResult = init.responseSchema.safeParse(data);
          if (!parseResult.success) {
            throw new IOError(
              `Response validation failed: ${parseResult.error.message}`,
              res.status,
              traceId,
            );
          }
          data = parseResult.data;
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
        this.emit({
          type: 'request:success',
          traceId,
          method,
          url: fullUrl,
          status: res.status,
          durationMs: result.durationMs,
          timestamp: Date.now(),
        });
        return result;
      } catch (err) {
        clearTimeout(timeoutHandle);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (attempt < retries && !isAbort) {
          // Exponential backoff.
          const backoff = Math.min(1000 * 2 ** attempt, 8000);
          await new Promise((r) => setTimeout(r, backoff));
          return doFetch(attempt + 1);
        }
        const ioError =
          err instanceof IOError
            ? err
            : new IOError(
                isAbort ? 'Request timed out' : String(err),
                0,
                traceId,
                err,
              );
        this.emit({
          type: 'request:error',
          traceId,
          method,
          url: fullUrl,
          error: ioError.message,
          timestamp: Date.now(),
        });
        throw ioError;
      }
    };

    const promise = doFetch(0).finally(() => {
      this.inFlight.delete(dedupeKey);
    });
    if (dedupe) {
      this.inFlight.set(dedupeKey, promise as Promise<IOResponse<unknown>>);
    }
    return promise;
  }

  async get<T>(url: string, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>> {
    return this.request<T>(url, { ...init, method: 'GET' });
  }

  async post<T>(url: string, body?: unknown, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>> {
    return this.request<T>(url, { ...init, method: 'POST', body });
  }

  async patch<T>(url: string, body?: unknown, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>> {
    return this.request<T>(url, { ...init, method: 'PATCH', body });
  }

  async put<T>(url: string, body?: unknown, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>> {
    return this.request<T>(url, { ...init, method: 'PUT', body });
  }

  async delete<T>(url: string, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>> {
    return this.request<T>(url, { ...init, method: 'DELETE' });
  }

  subscribeSSE(url: string, onEvent: (data: unknown) => void, onError?: (err: Error) => void): SSESubscription {
    const traceId = this.newTraceId();
    const es = new EventSource(url);
    this.emit({ type: 'sse:open', traceId, url, timestamp: Date.now() });
    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as unknown;
        this.emit({ type: 'sse:event', traceId, url, data, timestamp: Date.now() });
        onEvent(data);
      } catch {
        // ignore malformed events
      }
    };
    es.onerror = () => {
      const err = new Error('SSE connection error');
      this.emit({ type: 'sse:error', traceId, url, error: err.message, timestamp: Date.now() });
      onError?.(err);
    };
    return {
      url,
      traceId,
      close: () => {
        es.close();
        this.emit({ type: 'sse:close', traceId, url, timestamp: Date.now() });
      },
    };
  }

  postToSandbox(instanceId: string, message: unknown): void {
    const port = this.sandboxPorts.get(instanceId);
    if (port) {
      port.postMessage(message);
    } else {
      this.emit({
        type: 'request:error',
        traceId: this.newTraceId(),
        method: 'POST',
        url: `sandbox:${instanceId}`,
        error: `No sandbox port registered for instance "${instanceId}"`,
        timestamp: Date.now(),
      });
    }
  }

  /** Register a sandbox MessagePort (called by SandboxedNode on bridge:init). */
  registerSandboxPort(instanceId: string, port: MessagePort): void {
    this.sandboxPorts.set(instanceId, port);
  }

  /** Unregister a sandbox port (called on unmount). */
  unregisterSandboxPort(instanceId: string): void {
    this.sandboxPorts.delete(instanceId);
  }

  on(listener: IOEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  newTraceId(): string {
    return ulid();
  }
}

const IOContext = createContext<UnifiedIO | null>(null);

export function UnifiedIOProvider({ children }: { children: ReactNode }) {
  // Create the IO instance once (lazy singleton per provider).
  const [io] = useState(() => new BrowserUnifiedIO(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
  ));
  return <IOContext.Provider value={io}>{children}</IOContext.Provider>;
}

export function useIO(): UnifiedIO {
  const io = useContext(IOContext);
  if (!io) {
    // Fallback: create a temporary instance (for SSR or outside provider).
    return new BrowserUnifiedIO(process.env.NEXT_PUBLIC_API_BASE_URL ?? '');
  }
  return io;
}

/** Hook: subscribe to IO events (for audit/debug panels). */
export function useIOEvents(): IOEvent[] {
  const io = useIO();
  const [events, setEvents] = useState<IOEvent[]>([]);
  useEffect(() => {
    const unsub = io.on((e) => {
      setEvents((prev) => [...prev.slice(-99), e]);
    });
    return unsub;
  }, [io]);
  return events;
}

export { IOError };
export type { UnifiedIO, IORequestInit, IOResponse, IOEvent };
