// devops/runtime-test/discover.ts
// Unit 3.2/3.3 — Backend + Frontend Discovery
//
// AGENT-SAFE: fetch has timeout. Never hangs. Offline mode reads the static catalog
// (no server required) so the agent can PLAN before building.

import { readCatalog } from './cap-catalog.js'
import { backendBaseUrl } from './port.js'

const FETCH_TIMEOUT_MS = 5_000

export interface DiscoverResult {
  ok: boolean
  backendCapabilities: string[]
  frontendComponents: string[]
  frontendUrl?: string
  schemaTables: number
  offline?: boolean
  error?: string
}

export async function discoverBackend(): Promise<{ ok: boolean; capabilities: string[]; error?: string }> {
  try {
    const res = await fetch(`${backendBaseUrl()}/api/capabilities?surface=ui`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, capabilities: [], error: `status ${res.status}` }
    const data = (await res.json()) as Array<{ id: string }> | { capabilities: Array<{ id: string }> }
    const caps = Array.isArray(data) ? data : data.capabilities ?? []
    return { ok: true, capabilities: caps.map((c) => c.id) }
  } catch (err) {
    return { ok: false, capabilities: [], error: String(err) }
  }
}

export async function discoverFrontend(): Promise<{ ok: boolean; components: string[]; url?: string; error?: string }> {
  // Check if frontend dev server is running
  try {
    const res = await fetch('http://localhost:5173', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (res.ok) {
      return { ok: true, components: [], url: 'http://localhost:5173' }
    }
    return { ok: true, components: [], url: '', error: `frontend returned ${res.status}` }
  } catch {
    return { ok: true, components: [], url: '', error: 'frontend not running' }
  }
}

/**
 * Combined discovery (caps + frontend + schema) — backs `devops runtime-test discover`.
 * Best-effort: a missing server or DB never throws; partial results are surfaced.
 * When `opts.offline` is set, returns the static capability catalog (no server needed).
 */
export async function discoverAll(opts?: { offline?: boolean }): Promise<DiscoverResult> {
  if (opts?.offline) {
    const cat = readCatalog()
    const caps = cat.capabilities.map((c) => c.id)
    return {
      ok: cat.ok,
      backendCapabilities: caps,
      frontendComponents: [],
      schemaTables: 0,
      offline: true,
      error: cat.ok ? undefined : 'offline catalog missing (run: devops runtime-test catalog-gen)',
    }
  }

  const backend = await discoverBackend()
  const frontend = await discoverFrontend()

  let schemaTables = 0
  try {
    // DB-agnostic schema introspection: count `model` blocks in the Prisma
    // schema rather than issuing a dialect-specific raw query (the project may
    // use SQLite, Postgres, etc.). Robust against dialect mismatches.
    const { readFileSync } = await import('node:fs')
    const schema = readFileSync('prisma/schema.prisma', 'utf8')
    const matches = schema.match(/^\s*model\s+\w+/gm)
    schemaTables = matches?.length ?? 0
  } catch {
  // [audit] log the error with context here
    // Schema file unreadable — schema introspection is optional, not fatal
  }

  return {
    ok: backend.ok,
    backendCapabilities: backend.capabilities,
    frontendComponents: frontend.components,
    frontendUrl: frontend.url,
    schemaTables,
    error: backend.error ?? frontend.error,
  }
}