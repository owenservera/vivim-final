// src/storage/impl/local-agent-store-impl.ts
// Prisma-backed LocalAgentStore. Reads the seeded `opencode` provider + its verified
// free-model allow-list from provider_definition / provider_model / provider_config.

import { newId } from '../../ids.js'
import type {
  AgentModelSyncResult,
  AgentModelSyncState,
  LocalAgentConfig,
  LocalAgentModelRow,
  LocalAgentProviderRow,
  LocalAgentStore,
} from '../contracts/local-agent-store.js'
import type { CapStoreDb } from '../db.js'

const DEFAULT_TIMEOUT_MS = 120_000
const MODELS_LAST_SYNC_KEY = 'models_last_synced_at'

function toModelRow(m: any): LocalAgentModelRow {
  return {
    slug: m.modelSlug,
    displayName: m.displayName,
    isDefault: m.isDefault === 1,
    contextWindow: m.contextWindow ?? null,
    maxOutputTokens: m.maxOutputTokens ?? null,
    pricingInputPer1m: m.pricingInputPer1m ?? null,
    pricingOutputPer1m: m.pricingOutputPer1m ?? null,
  }
}

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
    const models: LocalAgentModelRow[] = (def.models ?? [])
      .filter((m: any) => m.isActive === 1)
      .map(toModelRow)
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
    const models: string[] = (def.models ?? [])
      .filter((m: any) => m.isActive === 1)
      .map((m: any) => m.modelSlug)
    const defaultModel =
      (def.models ?? []).find((m: any) => m.isActive === 1 && m.isDefault === 1)?.modelSlug ??
      models[0] ??
      ''
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
          contextWindow: m.contextWindow ?? null,
          maxOutputTokens: m.maxOutputTokens ?? null,
          pricingInputPer1m: m.pricingInputPer1m ?? null,
          pricingOutputPer1m: m.pricingOutputPer1m ?? null,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          displayName: m.displayName,
          isDefault: m.isDefault ? 1 : 0,
          contextWindow: m.contextWindow ?? null,
          maxOutputTokens: m.maxOutputTokens ?? null,
          pricingInputPer1m: m.pricingInputPer1m ?? null,
          pricingOutputPer1m: m.pricingOutputPer1m ?? null,
          updatedAt: now,
        },
      })
    }
    const cfgRows = [
      { key: 'binary', value: config.binary },
      { key: 'timeout_ms', value: String(config.timeoutMs) },
      { key: 'allowed_models', value: config.allowedModels.join(',') },
      { key: 'default_model', value: config.defaultModel },
    ]
    for (const c of cfgRows) {
      await this.upsertConfigRow(row.slug, c.key, c.value)
    }
  }

  async syncAgentModels(
    slug: string,
    models: LocalAgentModelRow[],
    opts: { defaultModel?: string } = {},
  ): Promise<AgentModelSyncResult> {
    const def = await this.p.providerDefinition.findUnique({
      where: { slug },
      include: { models: true },
    })
    if (!def) {
      throw new Error(`syncAgentModels: provider '${slug}' not found — seed it first`)
    }

    const incoming = models.map((m) => m.slug)
    const existing = (def.models ?? []).map((m: any) => m.modelSlug)
    const added = incoming.filter((s) => !existing.includes(s))
    const removed = existing.filter((s) => !incoming.includes(s))
    const kept = incoming.filter((s) => existing.includes(s))

    // Preserve the current default when it is still present; else fall back to
    // the caller-provided default (or the first incoming model).
    const currentDefault = (def.models ?? []).find((m: any) => m.isDefault === 1)?.modelSlug
    const defaultModel = incoming.includes(currentDefault)
      ? currentDefault!
      : (opts.defaultModel ?? incoming[0] ?? '')

    for (const m of models) {
      const isDefault = m.slug === defaultModel
      await this.p.providerModel.upsert({
        where: { providerId_modelSlug: { providerId: slug, modelSlug: m.slug } },
        create: {
          id: newId(),
          providerId: slug,
          modelSlug: m.slug,
          displayName: m.displayName,
          isActive: 1,
          isDefault: isDefault ? 1 : 0,
          contextWindow: m.contextWindow ?? null,
          maxOutputTokens: m.maxOutputTokens ?? null,
          pricingInputPer1m: m.pricingInputPer1m ?? null,
          pricingOutputPer1m: m.pricingOutputPer1m ?? null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        update: {
          displayName: m.displayName,
          isActive: 1,
          isDefault: isDefault ? 1 : 0,
          contextWindow: m.contextWindow ?? null,
          maxOutputTokens: m.maxOutputTokens ?? null,
          pricingInputPer1m: m.pricingInputPer1m ?? null,
          pricingOutputPer1m: m.pricingOutputPer1m ?? null,
          updatedAt: Date.now(),
        },
      })
    }

    // Deactivate models the CLI no longer reports.
    for (const stale of removed) {
      await this.p.providerModel.updateMany({
        where: { providerId: slug, modelSlug: stale },
        data: { isActive: 0, isDefault: 0, updatedAt: Date.now() },
      })
    }

    const now = Date.now()
    await this.upsertConfigRow(slug, 'allowed_models', incoming.join(','))
    await this.upsertConfigRow(slug, 'default_model', defaultModel)
    await this.upsertConfigRow(slug, MODELS_LAST_SYNC_KEY, String(now))

    return { added, removed, kept, defaultModel }
  }

  async setAgentDefaultModel(slug: string, modelSlug: string): Promise<void> {
    const row = await this.p.providerModel.findUnique({
      where: { providerId_modelSlug: { providerId: slug, modelSlug } },
    })
    if (!row) {
      throw new Error(`setAgentDefaultModel: model '${modelSlug}' is not in provider '${slug}'`)
    }
    const now = Date.now()
    await this.p.providerModel.updateMany({
      where: { providerId: slug, isDefault: 1 },
      data: { isDefault: 0, updatedAt: now },
    })
    await this.p.providerModel.update({
      where: { id: row.id },
      data: { isDefault: 1, isActive: 1, updatedAt: now },
    })
    await this.upsertConfigRow(slug, 'default_model', modelSlug)
  }

  async getAgentModelSyncState(slug: string): Promise<AgentModelSyncState> {
    const row = await this.p.providerConfig.findUnique({
      where: { providerId_configKey: { providerId: slug, configKey: MODELS_LAST_SYNC_KEY } },
    })
    const lastSyncedAt = row ? Number(row.configValue) || null : null
    return { lastSyncedAt }
  }

  async isModelAllowed(slug: string, model: string): Promise<boolean> {
    const cfg = await this.getAgentConfig(slug)
    if (!cfg) return false
    return cfg.allowedModels.includes(model)
  }

  private async upsertConfigRow(
    providerId: string,
    configKey: string,
    configValue: string,
  ): Promise<void> {
    const now = Date.now()
    await this.p.providerConfig.upsert({
      where: { providerId_configKey: { providerId, configKey } },
      create: {
        id: newId(),
        providerId,
        configKey,
        configValue,
        configType: 'string',
        isSecret: 0,
        createdAt: now,
        updatedAt: now,
      },
      update: { configValue, updatedAt: now },
    })
  }
}
