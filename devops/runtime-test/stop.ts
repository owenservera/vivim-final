// devops/runtime-test/stop.ts
// Unit — Stop all vivim services via the canonical PS1 stopper.
//
// AGENT-SAFE: delegates to scripts/stop-all.ps1 (PID-file + port-scan, infallible).
// This is the single correct way to tear down servers, whether they were launched
// by start-all.ps1 or by the supervisor — never leave orphan processes.

import { spawnSync } from 'node:child_process'

export interface StopResult {
  ok: boolean
  detail: string
}

export function stopServices(): StopResult {
  try {
    const res = spawnSync('pwsh', ['scripts/stop-all.ps1'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim()
    return { ok: res.status === 0, detail: out.slice(-500) }
  } catch (err) {
    return { ok: false, detail: String(err) }
  }
}
