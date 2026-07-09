// src/storage/contracts/config-store.ts
// ConfigStore — the data access contract for ConfigManager.
// Implements Prisma calls against config_entry + config_audit.

import { z } from 'zod'

// ── Scope ──────────────────────────────────────────────────────────────────

export const ConfigScopeSchema = z.object({
  scopeType: z.enum(['global', 'provider', 'account', 'engine']),
  scopeId: z.string().nullable().optional(),
})

export type ConfigScope = z.infer<typeof ConfigScopeSchema>

// ── Row types ──────────────────────────────────────────────────────────────

export interface ConfigEntryRow {
  id: string
  engineId: string
  scopeType: string
  scopeId: string | null
  configJson: string
  schemaVersion: number
  createdAt: number
  updatedAt: number
}

export interface ConfigAuditRow {
  id: string
  engineId: string
  entryId: string
  action: string
  fromJson: string | null
  toJson: string | null
  actor: string
  ts: number
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface ConfigStore {
  getConfigEntry(
    engineId: string,
    scopeType: string,
    scopeId: string | null,
  ): Promise<ConfigEntryRow | null>
  upsertConfigEntry(
    engineId: string,
    scopeType: string,
    scopeId: string | null,
    configJson: string,
    schemaVersion: number,
  ): Promise<ConfigEntryRow>
  insertConfigAudit(row: Omit<ConfigAuditRow, 'id'>): Promise<ConfigAuditRow>
  getConfigAuditHistory(engineId: string, limit: number): Promise<ConfigAuditRow[]>
  getConfigEntryById(id: string): Promise<ConfigEntryRow | null>
}
