/**
 * shared/unified-io.ts
 * --------------------------------------------------------------------
 * E4 — One I/O layer formalized.
 *
 * The UnifiedIO contract is the SINGLE transport for all client↔server
 * communication. Every fetch, SSE subscription, postMessage bridge,
 * and (future) WebSocket goes through it. Enforces:
 *   - traceId propagation on every request
 *   - Error normalization (IOError)
 *   - Retry/backoff for transient failures
 *   - Request deduplication (GET only)
 *   - Zod validation at boundaries
 *
 * One Entry Point invariant (5): no component calls fetch() directly.
 */

import type { z } from 'zod'

export type IOMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface IORequestInit {
  method?: IOMethod
  body?: unknown
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean | undefined>
  /** Zod schema for validating the response. */
  responseSchema?: z.ZodType<unknown>
  /** Abort signal. */
  signal?: AbortSignal
  /** Retry count (default 2). */
  retries?: number
  /** Whether to deduplicate GET requests (default true). */
  dedupe?: boolean
  /** Trace id (auto-generated if omitted). */
  traceId?: string
  /** Timeout in ms (default 30_000). */
  timeoutMs?: number
}

export interface IOResponse<T> {
  ok: boolean
  status: number
  data: T
  traceId: string
  durationMs: number
  /** Original response headers. */
  headers: Record<string, string>
}

export class IOError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly traceId: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'IOError'
  }
}

export interface IOEvent {
  type:
    | 'request:start'
    | 'request:success'
    | 'request:error'
    | 'sse:open'
    | 'sse:event'
    | 'sse:close'
    | 'sse:error'
  traceId: string
  method?: IOMethod
  url?: string
  status?: number
  durationMs?: number
  error?: string
  data?: unknown
  timestamp: number
}

export type IOEventListener = (event: IOEvent) => void

export interface SSESubscription {
  url: string
  traceId: string
  close: () => void
}

/**
 * The UnifiedIO contract. The browser impl lives in
 * `components/canvas/UnifiedIOProvider.tsx`; tests can swap a mock impl.
 */
export interface UnifiedIO {
  /** Single entry point for all HTTP requests. */
  request<T>(url: string, init?: IORequestInit): Promise<IOResponse<T>>

  /** Convenience: GET. */
  get<T>(url: string, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>>

  /** Convenience: POST. */
  post<T>(
    url: string,
    body?: unknown,
    init?: Omit<IORequestInit, 'method' | 'body'>,
  ): Promise<IOResponse<T>>

  /** Convenience: PATCH. */
  patch<T>(
    url: string,
    body?: unknown,
    init?: Omit<IORequestInit, 'method' | 'body'>,
  ): Promise<IOResponse<T>>

  /** Convenience: PUT. */
  put<T>(
    url: string,
    body?: unknown,
    init?: Omit<IORequestInit, 'method' | 'body'>,
  ): Promise<IOResponse<T>>

  /** Convenience: DELETE. */
  delete<T>(url: string, init?: Omit<IORequestInit, 'method' | 'body'>): Promise<IOResponse<T>>

  /** Subscribe to a Server-Sent Events stream. */
  subscribeSSE(
    url: string,
    onEvent: (data: unknown) => void,
    onError?: (err: Error) => void,
  ): SSESubscription

  /** PostMessage bridge to a sandboxed iframe. */
  postToSandbox(instanceId: string, message: unknown): void

  /** Listen for IO events (audit/debug). */
  on(event: IOEventListener): () => void

  /** Generate a fresh traceId. */
  newTraceId(): string

  /** Set or clear the auth token (injected as Authorization header). */
  setAuthToken(token: string | null): void
}
