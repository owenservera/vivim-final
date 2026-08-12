// devops/runtime-test/process-guard.ts
// Unit 1.4 (safety) — Context-interception hook for the devops loop.
//
// AGENT-SAFE: installed at the top of every `runtime-test` command. Registers
// SIGINT/SIGTERM/uncaughtException/unhandledRejection handlers that ALWAYS run
// `stopServices()` before the process exits. This is the "hook to intercept context
// just in case" — even if the loop or a spawned server hangs or the agent is
// interrupted, no orphan backend/Chrome is left behind.

import { stopServices } from './stop.js'

let installed = false
let stopping = false

async function teardown(): Promise<void> {
  if (stopping) return
  stopping = true
  try {
    await stopServices()
  } catch {
  // [audit] log the error with context here
    // best effort
  }
}

export function installProcessGuard(): void {
  if (installed) return
  installed = true

  const onSignal = () => {
    void teardown().finally(() => process.exit(130))
  }

  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)
  process.once('uncaughtException', (err) => {
    // [audit] removed: console.error('[process-guard] uncaughtException:', err)
    void teardown().finally(() => process.exit(1))
  })
  process.once('unhandledRejection', (reason) => {
    // [audit] removed: console.error('[process-guard] unhandledRejection:', reason)
    void teardown().finally(() => process.exit(1))
  })
}
