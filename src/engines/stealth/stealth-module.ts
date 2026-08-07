// src/engines/stealth/stealth-module.ts
// 11.2 — StealthModule interface + context. A stealth module injects JS into a
// running Chrome instance via CDP before any page loads.

import type { z } from 'zod'
import type { Logger } from '../../lib/logger.js'

export interface StealthCdpProxy {
  send(slaveId: string, method: string, params: Record<string, unknown>): Promise<unknown>
}

export interface StealthContext {
  cdp: StealthCdpProxy
  slaveId: string
  logger?: Logger
}

export interface StealthModuleConfig {
  name: string
  enabled: boolean
  config: Record<string, unknown>
}

export interface StealthModuleProfile {
  id: string
  name: string
  modules: StealthModuleConfig[]
}

export interface StealthModule {
  name: string
  detectionVector: string
  description: string
  configSchema: z.ZodSchema
  priority: number
  apply(config: Record<string, unknown>, ctx: StealthContext): Promise<void>
  verify?(ctx: StealthContext): Promise<boolean>
}
