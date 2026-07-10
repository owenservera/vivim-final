// src/executor/cdp-types.ts
// Shared types for CDP client

export interface CdpClientOptions {
  timeoutMs?: number
  maxRetries?: number
  retryDelayMs?: number
  pingIntervalMs?: number
}

export interface CommandOptions {
  timeoutMs?: number
  sessionId?: string
  retries?: number
}
