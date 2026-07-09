// src/schema/chrome.ts
// Chrome browser slave types — used by ChromeGovernor and LifecycleManager.

export type SlaveStatus = 'launching' | 'ready' | 'busy' | 'stale' | 'dead'

export type SuperState = 'active' | 'sleep' | 'error' | 'recovering'

export interface LaunchOptions {
  headless: boolean
  userDataDir: string
  args: string[]
  timeoutMs: number
  debugPort: number
}

export interface ChromeSlave {
  id: string
  providerId: string
  accountId: string
  status: SlaveStatus
  port: number
  profileDir: string
  pid: number | null
  launchOptions: LaunchOptions
}

export interface CDPCommand {
  method: string
  params: Record<string, unknown>
  sessionId?: string
}

export interface CDPResult {
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}
