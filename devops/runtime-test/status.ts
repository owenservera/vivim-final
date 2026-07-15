// devops/runtime-test/status.ts
// Unit — Report running server state from .runtime/*.pid + health endpoints.
//
// AGENT-SAFE: bounded fetch timeouts. Never hangs.

import { existsSync, readFileSync } from 'node:fs'
import { backendBaseUrl } from './port.js'

const FETCH_TIMEOUT_MS = 3_000

async function health(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    return r.ok
  } catch {
    return false
  }
}

export interface StatusResult {
  ok: boolean
  backend: { pid?: number; healthy: boolean }
  frontend: { pid?: number; healthy: boolean }
}

export async function serverStatus(): Promise<StatusResult> {
  const readPid = (name: string): number | undefined => {
    const f = `.runtime/${name}.pid`
    if (!existsSync(f)) return undefined
    const n = Number.parseInt(readFileSync(f, 'utf8').trim(), 10)
    return Number.isFinite(n) ? n : undefined
  }

  const backendPid = readPid('backend')
  const frontendPid = readPid('frontend')

  const [backendHealthy, frontendHealthy] = await Promise.all([
    health(`${backendBaseUrl()}/health`),
    health('http://localhost:5173'),
  ])

  return {
    ok: backendHealthy || frontendHealthy,
    backend: { pid: backendPid, healthy: backendHealthy },
    frontend: { pid: frontendPid, healthy: frontendHealthy },
  }
}
