// src/engines/chrome-governor-resilience.ts
// Session resilience layer for ChromeGovernor (Migration 004).
// Implements detach/reconnect cycle and graceful degradation (API-mode fallback)
// based on Playwright CDPSession patterns (official docs: playwright.dev/docs/api/class-cdpsession).

import { getLogger } from '../lib/logger.js';

const logger = getLogger('chrome-governor-resilience');

export interface ResilienceConfig {
  maxReconnectAttempts: number; // default 3
  reconnectDelayMs: number;     // default 5000
  sessionTimeoutMs: number;     // default 120000 (2 min)
  gracefulFallbackEnabled: boolean; // default true (API-mode fallback)
}

export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  maxReconnectAttempts: 3,
  reconnectDelayMs: 5000,
  sessionTimeoutMs: 120000,
  gracefulFallbackEnabled: true,
};

// Detach wrapper: ensures clean teardown of the CDP session.
// Pattern: session.detach() (Playwright CDPSession docs).
export async function detachSession(session: { detach(): Promise<void> }) {
  logger.info('Detaching CDP session');
  try {
    await session.detach();
    logger.info('CDP session detached successfully');
  } catch (err) {
    logger.warn('Detach failed (session may already be dead):', err);
  }
}

// Session health check: monitors session state via event monitoring.
// Pattern: session.on('close') (Playwright docs) detects session death.
export function onSessionClose(
  session: { on(event: 'close', handler: () => void): void },
  handler: () => void
) {
  session.on('close', handler);
  logger.info('Registered session close listener');
}

// Reconnect cycle: kill zombie session, relaunch browser, reattach.
// Pattern: Playwright auto-restart + session reconnect.
export async function reconnectCycle(
  killZombie: () => Promise<void>,
  relaunchBrowser: () => Promise<any>,
  reattachToNewSession: (newSession: any) => Promise<void>,
  config: ResilienceConfig = DEFAULT_RESILIENCE_CONFIG
): Promise<void> {
  for (let attempt = 1; attempt <= config.maxReconnectAttempts; attempt++) {
    logger.info(`Reconnect attempt ${attempt}/${config.maxReconnectAttempts}`);
    try {
      await killZombie();
      const newSession = await relaunchBrowser();
      await reattachToNewSession(newSession);
      logger.info('Reconnect cycle completed successfully');
      return;
    } catch (err) {
      logger.warn(`Reconnect attempt ${attempt} failed:`, err);
      if (attempt < config.maxReconnectAttempts) {
        await new Promise((r) => setTimeout(r, config.reconnectDelayMs));
      }
    }
  }
  throw new Error(`Reconnect cycle exhausted after ${config.maxReconnectAttempts} attempts`);
}

// Graceful degradation: if Chrome is unavailable, fall back to API-mode.
// Pattern: provider REST API as fallback (ARCHITECTURAL_DECISIONS.md §Decision 3).
export function gracefulFallbackEnabled(config: ResilienceConfig): boolean {
  return config.gracefulFallbackEnabled;
}

export { DEFAULT_RESILIENCE_CONFIG as defaultConfig };
