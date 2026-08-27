// src/schema/chrome.ts
// Chrome browser slave domain types — used by ChromeGovernor and LifecycleManager.
// Canonical lifecycle/super-state now lives in executor/slave-states (atomic-v13 / FR-3).

import type { ChromeChannel, ChromeMode } from '../executor/chrome-instance-profile.js'
import type { FleetSuperState, SlaveLifecycle } from '../executor/slave-states.js'

export type SlaveStatus = SlaveLifecycle
export type SuperState = FleetSuperState

export type { ChromeChannel, ChromeMode, FleetSuperState, SlaveLifecycle }

export interface LaunchOptions {
  headless: boolean
  userDataDir: string
  args: string[]
  timeoutMs: number
  debugPort: number
  channel?: ChromeChannel
  mode?: ChromeMode
}

export interface ChromeSlave {
  id: string
  providerId: string
  accountId: string
  status: SlaveStatus
  superState: SuperState
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
