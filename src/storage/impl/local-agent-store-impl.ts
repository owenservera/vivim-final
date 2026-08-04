// src/storage/impl/local-agent-store-impl.ts
// Prisma-backed LocalAgentStore. Reads the seeded `opencode` provider + its verified
// free-model allow-list from provider_definition / provider_model / provider_config.

import { newId } from '../../ids.js'
import type {
  LocalAgentConfig,
  LocalAgentModelRow,
  LocalAgentProviderRow,
  LocalAgentStore,
} from '../contracts/local-agent-store.js'
import type { CapStoreDb } from '../db.js'

const DEFAULT_TIMEOUT_MS = 120_000

export class LocalAgentStoreImpl implements LocalAgentStore {
  private db: CapStoreDb

  constructor(db: CapStoreDb) {
    this.db = db.loose
  }

  private get p() {
    return this.db.prisma
  }

  async getAgentProvider(slug: string): Promise<LocalAgentProviderRow | null> {
    const def = await this.p.providerDefinition.findUnique({
      where: { slug },
      include: { models: true },
    })
    if (!def) return null
    const models: LocalAgentModelRow[] = (def.models ?? []).map((m: any) => ({
      slug: m.modelSlug,
      displayName: m.displayName,
      isDefault: m.isDefault === 1,
    }))
    return {
      slug: def.slug,
      displayName: def.displayName,
      authType: 'none',
      models,
    }
  }

  async getAgentConfig(slug: string): Promise<LocalAgentConfig | null> {
    const def = await this.p.providerDefinition.findUnique({
      where: { slug },
      include: { models: true, configs: true },
    })
    if (!def) return null
    const configs = new Map<string, string>(
      (def.configs ?? []).map((c: any) => [c.configKey, c.configValue]),
    )
    const models: string[] = (def.models ?? []).map((m: any) => m.modelSlug)
    const defaultModel =
      (def.models ?? []).find((m: any) => m.isDefault === 1)?.modelSlug ?? models[0] ?? ''
    const timeoutRaw = configs.get('timeout_ms')
    const timeoutMs = timeoutRaw ? Number(timeoutRaw) || DEFAULT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
    return {
      binary: configs.get('binary') ?? 'opencode',
      timeoutMs,
      allowedModels: models,
      defaultModel,
    }
  }

  async upsertAgentProvider(row: LocalAgentProviderRow, config: LocalAgentConfig): Promise<void> {
    const now = Date.now()
    await this.p.providerDefinition.upsert({
      where: { slug: row.slug },
      create: {
        id: row.slug,
        slug: row.slug,
        displayName: row.displayName,
        providerType: 'local-agent',
        authType: 'none',
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      },
      update: { displayName: row.displayName, updatedAt: now },
    })
    for (const m of row.models) {
      await this.p.providerModel.upsert({
        where: { providerId_modelSlug: { providerId: row.slug, modelSlug: m.slug } },
        create: {
          id: newId(),
          providerId: row.slug,
          modelSlug: m.slug,
          displayName: m.displayName,
          isActive: 1,
          isDefault: m.isDefault ? 1 : 0,
          createdAt: now,
          updatedAt: now,
        },
        update: { displayName: m.displayName, isDefault: m.isDefault ? 1 : 0, updatedAt: now },
      })
    }
    const cfgRows = [
      { key: 'binary', value: config.binary },
      { key: 'timeout_ms', value: String(config.timeoutMs) },
      { key: 'allowed_models', value: config.allowedModels.join(',') },
      { key: 'default_model', value: config.defaultModel },
    ]
    for (const c of cfgRows) {
      await this.p.providerConfig.upsert({
        where: { providerId_configKey: { providerId: row.slug, configKey: c.key } },
        create: {
          id: newId(),
          providerId: row.slug,
          configKey: c.key,
          configValue: c.value,
          configType: 'string',
          isSecret: 0,
          createdAt: now,
          updatedAt: now,
        },
        update: { configValue: c.value, updatedAt: now },
      })
    }
  }

  async isModelAllowed(slug: string, model: string): Promise<boolean> {
    const cfg = await this.getAgentConfig(slug)
    if (!cfg) return false
    return cfg.allowedModels.includes(model)
  }
}
