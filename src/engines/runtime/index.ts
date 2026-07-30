// src/engines/runtime/index.ts
// Barrel exports for BrowserRuntime.
// Phase 2: Runtime Layer contains all browser execution mechanics.

export {
  BrowserRuntime,
  CDPProxy,
  CdpWatchdog,
  HealthMonitor,
  ReconnectManager,
} from './browser-runtime.js'
export type {
  CDPTransport,
  BrowserSession,
  ReconnectPolicy,
} from './browser-runtime.js'
