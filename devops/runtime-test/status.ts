// devops/runtime-test/status.ts
// Unit — Report running server state from .runtime/*.pid + health endpoints.
//
// AGENT-SAFE: bounded fetch timeouts. Never hangs.

import { existsSync, readFileSync } from 'node:fs'
import { ProfileAllocator } from '../../src/executor/profile-allocator.js'
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

/** Format bytes to human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
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

export interface ProfileHealthEntry {
  providerSlug: string
  accountId: string
  path: string
  lastUsed: Date
  crashCount: number
  diskSize: string
  lastAuthVerified: string
}

/**
 * Surface profile health metrics for a specific provider (or all providers).
 * Returns crash counts, disk footprint, and last auth verification timestamps.
 */
export async function profileStatus(provider?: string): Promise<ProfileHealthEntry[]> {
  const allocator = new ProfileAllocator('chrome-profiles')
  const profiles = await allocator.list()
  const filtered = provider ? profiles.filter((p) => p.providerSlug === provider) : profiles

  return filtered.map((p) => ({
    providerSlug: p.providerSlug,
    accountId: p.accountId,
    path: p.path,
    lastUsed: p.lastUsed,
    crashCount: p.crashCount,
    diskSize: formatBytes(p.diskSizeBytes),
    lastAuthVerified: p.lastAuthVerifiedAt ? p.lastAuthVerifiedAt.toISOString() : 'never',
  }))
}
