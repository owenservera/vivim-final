// devops/runtime-test/port.ts
// Shared backend port resolver for the dev-loop runtime.
//
// The dev loop keeps ONE server alive across many agent turns. When the default
// port (9420) is held by a Windows zombie socket (a dead PID still LISTENING),
// the launcher (scripts/dev.ts / bun run dev:backend) falls back to the next free port and
// records it in .runtime/backend.port. Every client in the loop must resolve the
// port the same way:
//
//   CAP_STORE_PORT env  >  .runtime/backend.port  >  9420 (default)
//
// This is the single source of truth for the backend port. Never hardcode 9420.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Resolve the running backend port. Precedence:
 *   1. CAP_STORE_PORT env var (set by the launcher when it falls back)
 *   2. .runtime/backend.port (written by the launcher after choosing a port)
 *   3. 9420 (the historical default)
 */
export function resolveBackendPort(): number {
  const env = process.env.CAP_STORE_PORT
  if (env && /^\d+$/.test(env.trim())) {
    return Number.parseInt(env.trim(), 10)
  }
  try {
    const p = join(process.cwd(), '.runtime', 'backend.port')
    if (existsSync(p)) {
      const v = readFileSync(p, 'utf8').trim()
      if (/^\d+$/.test(v)) return Number.parseInt(v, 10)
    }
  } catch {
  // [audit] log the error with context here
    // ignore — fall through to default
  }
  return 9420
}

/** Backend base URL with the resolved port. */
export function backendBaseUrl(): string {
  return `http://localhost:${resolveBackendPort()}`
}
