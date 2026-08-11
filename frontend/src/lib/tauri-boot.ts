/**
 * lib/tauri-boot.ts — Tauri V2 boot sequence
 * ------------------------------------------------
 * In web mode this is a no-op.  Inside Tauri it waits for the
 * Next.js static export to hydrate, then emits `backend-ready`
 * so the Rust shell shows the window (no white-flash).
 */

import { isTauri, tauriInvoke } from './tauri-bridge'

let booted = false

export async function tauriBoot(): Promise<void> {
  if (booted || !isTauri()) return
  booted = true

  try {
    // Give React a tick to hydrate before signaling
    await new Promise((r) => requestAnimationFrame(r))
    await tauriInvoke('backend_ready')
    console.log('[tauri-boot] backend-ready signaled, window should be visible')
  } catch (err) {
    console.warn('[tauri-boot] failed to signal backend-ready:', err)
  }
}
