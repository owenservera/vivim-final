// src/schema/config.ts
// Configuration domain types — used by ConfigManager.

export interface ConfigEntry {
  id: string
  engineId: string
  configKey: string
  configValue: string
  configType: string
  isRuntime: boolean
}

export interface ConfigAuditEntry {
  id: string
  engineId: string
  configKey: string | null
  fromValue: string | null
  toValue: string
  actor: string
  ts: number
}

export interface ConfigSchema {
  engineId: string
  zodSchema: string
  defaults: string
  isRuntime?: boolean
}
