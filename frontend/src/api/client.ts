// frontend/src/api/client.ts
// API client for capability endpoints.
// P1-7: Migrated to use UnifiedIO for retry, auth, traceId, and Zod validation.
// P3-8: Added responseSchema passthrough for runtime validation.

import type {
  CapabilityDetail,
  CapabilityExecuteResponse,
  CapabilityListResponse,
} from '@/types/shared/api-contract'
import type { z } from 'zod'
import { getApiBase } from '../lib/ws-url'
import type { UnifiedIO } from '../shared/unified-io'
import { CapabilityExecuteResponseSchema, CapabilityListResponseSchema } from './schemas'

/** Optional IO instance — injected by consumers who have useIO() */
let _io: UnifiedIO | null = null

/** Set the IO instance (call once from a React component using useIO()) */
export function setCapabilityApiIO(io: UnifiedIO): void {
  _io = io
}

function getIO(): UnifiedIO | null {
  return _io
}

interface RequestOpts extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Zod schema for runtime response validation (passed to UnifiedIO). */
  responseSchema?: z.ZodType<unknown>
}

async function request<T>(path: string, init?: RequestOpts): Promise<T> {
  const io = getIO()
  if (io) {
    const method = init?.method?.toUpperCase() ?? 'GET'
    const url = path.startsWith('http') ? path : `${getApiBase()}${path}`
    const resp = await io.request<T>(url, {
      method: method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
      body: init?.body
        ? typeof init.body === 'string'
          ? JSON.parse(init.body)
          : init.body
        : undefined,
      headers: init?.headers as Record<string, string> | undefined,
      responseSchema: init?.responseSchema,
    })
    return resp.data
  }
  // Fallback: raw fetch (legacy path, used outside React tree)
  const headers: Record<string, string> = { 'X-Source': 'frontend' }
  if (init?.body) headers['Content-Type'] = 'application/json'
  const url = `${getApiBase()}${path}`
  const resp = await fetch(url, {
    ...init,
    body: init?.body
      ? typeof init.body === 'string'
        ? init.body
        : JSON.stringify(init.body)
      : undefined,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(15000),
  })
  const body = await resp.json()
  if (!resp.ok) throw new Error(`API ${resp.status}: ${JSON.stringify(body)}`)
  if (init?.responseSchema) {
    const parsed = init.responseSchema.safeParse(body)
    if (!parsed.success) throw new Error(`Response validation failed: ${parsed.error.message}`)
  }
  return body as T
}

export const capabilityApi = {
  /**
   * List capabilities, optionally filtered by surface.
   * Backend returns { capabilities: CapabilityDetail[], total: number }.
   */
  listBySurface: (surface?: string) => {
    const qs = surface ? `?surface=${encodeURIComponent(surface)}` : ''
    return request<CapabilityListResponse>(`/api/capabilities${qs}`, {
      responseSchema: CapabilityListResponseSchema,
    })
  },

  /**
   * Get a single capability detail by ID or slug.
   */
  get: (idOrSlug: string) =>
    request<CapabilityDetail>(`/api/capabilities/${encodeURIComponent(idOrSlug)}`),

  /**
   * Execute a capability by ID or slug.
   * Backend returns { ok: true, capabilityId, output, traceId, latencyMs }.
   */
  execute: (capabilityId: string, input: Record<string, unknown>) =>
    request<CapabilityExecuteResponse>(
      `/api/capabilities/${encodeURIComponent(capabilityId)}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({ input }),
        responseSchema: CapabilityExecuteResponseSchema,
      },
    ),
}
