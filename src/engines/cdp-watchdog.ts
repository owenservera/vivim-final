// src/engines/cdp-watchdog.ts
// Watchdog system for CDP session resilience.
// Adapted from dao-ai/cdp-browser + browser-use for vivim-final.

import type { CDPTransport } from './chrome-governor.js'

export type WatchdogEvent = 'dialog' | 'crash' | 'navigate' | 'timeout' | 'error'

export type WatchdogHandler = (event: WatchdogEvent, data: Record<string, unknown>) => Promise<void>

/**
 * Watchdog for CDP sessions. Monitors for dialogs, crashes, timeouts,
 * and other provider-side issues that block automation.
 */
export class CdpWatchdog {
  private handlers = new Map<WatchdogEvent, WatchdogHandler[]>()

  on(event: WatchdogEvent, handler: WatchdogHandler): void {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  }

  async emit(event: WatchdogEvent, data: Record<string, unknown>): Promise<void> {
    for (const handler of this.handlers.get(event) ?? []) {
      try {
        await handler(event, data)
      } catch (err) {
        console.error(`[watchdog] handler error for ${event}:`, err)
      }
    }
  }
}

/**
 * Auto-dismiss alert/confirm/prompt dialogs that block provider interaction.
 * Provider pages sometimes show cookie consent, upgrade prompts, etc.
 *
 * @param transport - CDP transport
 * @param slaveId - Chrome slave session ID
 * @param watchdog - Watchdog instance to register handlers on
 */
export function setupDialogWatchdog(
  transport: CDPTransport,
  slaveId: string,
  watchdog: CdpWatchdog,
): void {
  // Enable dialog handling via CDP
  transport.send(slaveId, 'Page.enable').catch(() => {})

  // Listen for dialog events — auto-dismiss all dialogs
  watchdog.on('dialog', async (_event, data) => {
    const type = data.type as string
    const sessionId = data.sessionId as string
    console.log(`[watchdog] auto-dismissing ${type} dialog on ${sessionId}`)
    // Dialog dismissal handled at transport level via Page.handleJavaScriptDialog
  })
}

/**
 * Auto-recover on page crash. Re-navigates to the last known URL.
 *
 * @param transport - CDP transport
 * @param slaveId - Chrome slave session ID
 * @param watchdog - Watchdog instance to register handlers on
 * @param getLastUrl - Function returning the last navigated URL
 */
export function setupCrashWatchdog(
  transport: CDPTransport,
  slaveId: string,
  watchdog: CdpWatchdog,
  getLastUrl: () => string,
): void {
  watchdog.on('crash', async (_event, data) => {
    console.error('[watchdog] page crash detected:', data)
    const lastUrl = getLastUrl()
    if (lastUrl) {
      try {
        await transport.send(slaveId, 'Runtime.evaluate', {
          expression: `window.location.href = ${JSON.stringify(lastUrl)}`,
        })
      } catch (err) {
        console.error('[watchdog] crash recovery failed:', err)
      }
    }
  })
}

/**
 * Set up all watchdog subsystems for a slave session.
 * Convenience function called once per slave connection.
 */
export function setupWatchdog(
  transport: CDPTransport,
  slaveId: string,
  getLastUrl: () => string,
): CdpWatchdog {
  const watchdog = new CdpWatchdog()
  setupDialogWatchdog(transport, slaveId, watchdog)
  setupCrashWatchdog(transport, slaveId, watchdog, getLastUrl)
  return watchdog
}
