// devops/runtime-test/watchdog.ts
// Unit 1.4 — Agent-death watchdog (background reaper).
//
// AGENT-SAFE: a tiny monitor the agent launches as a DETACHED background script at loop
// start. It polls the agent's parent PID; when the parent vanishes (crash/OOM), it runs
// `stopServices()` so the detached `serve` + spawned Chrome are reclaimed — no orphans.
//
// Launch: `bun run devops runtime-test watchdog --pid=<agentPid>`
// (The agent passes its own `process.pid` as the watched parent.)

import { stopServices } from './stop.js'

export function startWatchdog(parentPid: number, intervalMs = 5_000): void {
  const timer = setInterval(async () => {
    let alive = false
    try {
      // signal 0 = existence check, works on Windows + POSIX
      process.kill(parentPid, 0)
      alive = true
    } catch {
      alive = false
    }
    if (!alive) {
      clearInterval(timer)
      try {
        await stopServices()
      } catch {
        // best effort
      }
      process.exit(0)
    }
  }, intervalMs)

  // Don't keep the event loop alive solely for the watchdog if parent detaches us.
  if (typeof timer.unref === 'function') timer.unref()
}
