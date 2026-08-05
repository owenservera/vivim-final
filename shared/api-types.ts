// shared/api-types.ts
// Canonical API types for all surfaces.
// Imported by: backend (Bun), frontend (Vite), CLI, agent.
//
// RULE: If you change a type here, ALL surfaces pick it up automatically.
//       No duplication. No drift. One source of truth.

// ── Source tracking ───────────────────────────────────────────────────────────

/** Which surface initiated the API request. Tracked in X-Source header. */
export type Source = 'cli' | 'frontend' | 'agent' | 'script'

// ── Setup API ────────────────────────────────────────────────────────────────

export interface WorkspaceGetResponse {
  workspacePath: string | null
  /** Canonical default base (config.profileBaseDir) the UI offers as default. */
  defaultPath: string
}

export interface WorkspaceSetRequest {
  path: string
}

export interface LaunchVisibleRequest {
  providerId: string
  accountSlug: string
  workspace: string
  port?: number
}

export interface LaunchVisibleResponse {
  ok: boolean
  profileDir: string
  debugPort: number
  pid: number
  loginUrl: string
  error?: string
}

export interface VerifyRequest {
  port: number
  providerId?: string
}

export interface VerifyResponse {
  ok: boolean
  alive: boolean
  loggedIn: boolean
  url: string
  port: number
  method: 'url_pattern' | 'dom_check' | 'cookie_check'
  error?: string
}

export interface CompleteRequest {
  providerId: string
  accountSlug: string
  workspace: string
  profileDir: string
  debugPort: number
}

export interface CompleteResponse {
  ok: boolean
  accountId: string
  error?: string
}

export interface ProfileEntry {
  providerId: string
  accountSlug: string
  profileDir: string
  hasCookies: boolean
  dbLinked: boolean
}

export interface ProfilesResponse {
  profiles: ProfileEntry[]
  workspacePath: string | null
}

export interface RestoreResponse {
  ok: boolean
  restored: Array<{ providerId: string; accountId: string; profileDir: string }>
  count: number
}

export interface HealthResponse {
  status: string
  version: string
}

// ── API Endpoints (for documentation/codegen) ────────────────────────────────

export const SETUP_ENDPOINTS = {
  health: { method: 'GET', path: '/health' },
  getWorkspace: { method: 'GET', path: '/api/setup/workspace' },
  setWorkspace: { method: 'POST', path: '/api/setup/workspace' },
  getProfiles: { method: 'GET', path: '/api/setup/profiles' },
  launchVisible: { method: 'POST', path: '/api/setup/launch-visible' },
  verify: { method: 'POST', path: '/api/setup/verify' },
  complete: { method: 'POST', path: '/api/setup/complete' },
  restore: { method: 'POST', path: '/api/setup/restore' },
} as const
