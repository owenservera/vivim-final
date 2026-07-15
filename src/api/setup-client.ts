// src/api/setup-client.ts
// Backend API client for provider setup.
// Imports types from shared/api-types.ts — the single source of truth.
//
// PRINCIPLE: Every surface calls the same endpoints with the same shapes.
// The X-Source header tracks which surface initiated the request.

import type {
  CompleteRequest,
  CompleteResponse,
  HealthResponse,
  LaunchVisibleRequest,
  LaunchVisibleResponse,
  ProfilesResponse,
  Source,
  VerifyRequest,
  VerifyResponse,
  WorkspaceGetResponse,
  WorkspaceSetRequest,
} from 'shared/api-types.ts'
import { getServerPort } from '../config.js'

export type { Source } from 'shared/api-types.ts'

export interface SetupClientOptions {
  baseUrl?: string
  source: Source
  fetch?: typeof globalThis.fetch
}

// ── Client factory ───────────────────────────────────────────────────────────

export function createSetupClient(opts: SetupClientOptions) {
  const baseUrl = opts.baseUrl ?? `http://localhost:${getServerPort()}`
  const fetchFn = opts.fetch ?? globalThis.fetch
  const source = opts.source

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers)
    headers.set('X-Source', source)
    if (!headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json')
    }

    const resp = await fetchFn(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(15_000),
    })

    const body = await resp.json()
    if (!resp.ok) {
      throw new Error(`API error ${resp.status}: ${JSON.stringify(body)}`)
    }
    return body as T
  }

  return {
    // Health
    health: () => request<HealthResponse>('/health'),

    // Workspace
    getWorkspace: () => request<WorkspaceGetResponse>('/api/setup/workspace'),
    setWorkspace: (path: string) =>
      request<{ ok: boolean; workspacePath: string }>('/api/setup/workspace', {
        method: 'POST',
        body: JSON.stringify({ path } satisfies WorkspaceSetRequest),
      }),

    // Profiles
    getProfiles: () => request<ProfilesResponse>('/api/setup/profiles'),

    // Setup flow
    launchVisible: (req: LaunchVisibleRequest) =>
      request<LaunchVisibleResponse>('/api/setup/launch-visible', {
        method: 'POST',
        body: JSON.stringify(req),
      }),

    verify: (req: VerifyRequest) =>
      request<VerifyResponse>('/api/setup/verify', {
        method: 'POST',
        body: JSON.stringify(req),
      }),

    complete: (req: CompleteRequest) =>
      request<CompleteResponse>('/api/setup/complete', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
  }
}

export type SetupClient = ReturnType<typeof createSetupClient>
