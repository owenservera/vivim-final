// devops/runtime-test/stop.ts
// Unit — Stop all vivim services via the canonical TypeScript stopper.
//
// AGENT-SAFE: delegates to `bun run stop` (port-scanner + .runtime cleanup, infallible).
// This is the single correct way to tear down servers — never leave orphan processes.

import { execSync } from 'node:child_process'

export interface StopResult {
  ok: boolean
  detail: string
}

export function stopServices(): StopResult {
  try {
    const out = execSync('bun run stop', { encoding: 'utf8', timeout: 30_000 })
    return { ok: true, detail: out.trim().slice(-500) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, detail: msg.slice(-500) }
  }
}
