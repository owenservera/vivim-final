// src/engines/config-manager.ts
// ConfigManager — single authority for all engine configuration.
// Handles schema registration, scoped config read/write, audit trail, and event emission.

import type { z } from 'zod'
import { EngineError } from '../errors.js'
import { safeJsonParse } from '../lib/safe-json.js'
import type { ConfigScope, ConfigStore } from '../storage/contracts/config-store.js'

// ── Event bus ──────────────────────────────────────────────────────────────

export interface ConfigEventBus {
  emit(event: string, data: unknown): void
}

// ── Types ──────────────────────────────────────────────────────────────────

interface SchemaRegistration {
  schema: z.ZodSchema
  defaults: Record<string, unknown>
}

export interface ConfigAuditEntry {
  id: string
  engineId: string
  entryId: string
  action: string
  fromJson: string | null
  toJson: string | null
  actor: string
  ts: number
}

// ── ConfigManager ──────────────────────────────────────────────────────────

export class ConfigManager {
  private schemas = new Map<string, SchemaRegistration>()
  private cache = new Map<string, Record<string, unknown>>()

  constructor(
    private store: ConfigStore,
    private eventBus?: ConfigEventBus,
  ) {}

  // ── Schema registration ────────────────────────────────────────────────

  registerSchema(engineId: string, schema: z.ZodSchema, defaults: Record<string, unknown>): void {
    schema.parse(defaults)
    this.schemas.set(engineId, { schema, defaults })
  }

  // ── Read ───────────────────────────────────────────────────────────────

  getConfig<T extends Record<string, unknown>>(engineId: string, scope?: ConfigScope): T {
    const { scopeType, scopeId } = this.resolveScope(scope)
    const cacheKey = `${engineId}:${scopeType}:${scopeId ?? 'null'}`

    const cached = this.cache.get(cacheKey)
    if (cached) return cached as T

    const registration = this.schemas.get(engineId)
    if (!registration) {
      throw new EngineError(`No schema registered for engine: ${engineId}`)
    }

    return registration.defaults as T
  }

  // ── Write ──────────────────────────────────────────────────────────────

  async updateConfig<T extends Record<string, unknown>>(
    engineId: string,
    patch: Partial<T>,
    actor: string,
    scope?: ConfigScope,
  ): Promise<T> {
    const { scopeType, scopeId } = this.resolveScope(scope)
    const registration = this.schemas.get(engineId)
    if (!registration) {
      throw new EngineError(`No schema registered for engine: ${engineId}`)
    }

    const current = this.getConfig<T>(engineId, scope)
    const merged = { ...current, ...patch } as Record<string, unknown>

    registration.schema.parse(merged)

    const configJson = JSON.stringify(merged)
    const entry = await this.store.upsertConfigEntry(engineId, scopeType, scopeId, configJson, 1)

    await this.store.insertConfigAudit({
      engineId,
      entryId: entry.id,
      action: 'update',
      fromJson: JSON.stringify(current),
      toJson: configJson,
      actor,
      ts: Date.now(),
    })

    const cacheKey = `${engineId}:${scopeType}:${scopeId ?? 'null'}`
    this.cache.set(cacheKey, merged)

    this.eventBus?.emit('config:changed', { engineId, scopeType, scopeId })

    return merged as T
  }

  // ── Audit ──────────────────────────────────────────────────────────────

  async getConfigHistory(engineId: string, limit = 50): Promise<ConfigAuditEntry[]> {
    return this.store.getConfigAuditHistory(engineId, limit)
  }

  // ── Reload ─────────────────────────────────────────────────────────────

  async reloadConfig<T extends Record<string, unknown>>(
    engineId: string,
    scope?: ConfigScope,
  ): Promise<T> {
    const { scopeType, scopeId } = this.resolveScope(scope)
    const cacheKey = `${engineId}:${scopeType}:${scopeId ?? 'null'}`

    const entry = await this.store.getConfigEntry(engineId, scopeType, scopeId)
    if (entry) {
      const parsed = safeJsonParse(entry.configJson, {}) as Record<string, unknown>
      this.cache.set(cacheKey, parsed)
      return parsed as T
    }

    this.cache.delete(cacheKey)
    return this.getConfig<T>(engineId, scope)
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private resolveScope(scope?: ConfigScope): { scopeType: string; scopeId: string | null } {
    return {
      scopeType: scope?.scopeType ?? 'global',
      scopeId: scope?.scopeId ?? null,
    }
  }
}
