import { getApiBase } from '../lib/ws-url'

export interface ResolvedCapabilityDto {
  id: string
  slug: string
  name: string
  category: string
  description?: string
  uiSlots?: Record<string, { component?: string; sandbox?: string[] }>
  inputSchema?: { type: string; properties?: Record<string, { type: string }>; required?: string[] }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'X-Source': 'frontend' }
  if (init?.body) headers['Content-Type'] = 'application/json'
  const url = `${getApiBase()}${path}`
  const resp = await fetch(url, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(15000),
  })
  const body = await resp.json()
  if (!resp.ok) throw new Error(`API ${resp.status}: ${JSON.stringify(body)}`)
  return body as T
}

export const capabilityApi = {
  listBySurface: (surface: string) =>
    request<ResolvedCapabilityDto[]>(`/api/capabilities?surface=${surface}`),
  execute: (capabilityId: string, input: Record<string, unknown>) =>
    request<{ ok: boolean; result?: unknown; error?: string }>(
      `/api/capabilities/${encodeURIComponent(capabilityId)}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({ input }),
      },
    ),
}
