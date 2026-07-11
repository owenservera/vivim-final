// src/engines/provider-registrar.ts
// Reads provider JSON manifests from seeds/providers/ and writes them to the DB.
// Handles atomic multi-table inserts. Can reload all providers or a single provider.

import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { newId } from '../ids.js'
import { type ProviderManifest, ProviderManifestSchema } from '../schema/provider-manifest.js'
import type {
  ProviderCapabilityRow,
  ProviderConfigRow,
  ProviderDefinitionRow,
  ProviderEndpointRow,
  ProviderModelRow,
  ProviderParserRow,
} from '../schema/types.js'
import type { ProviderStore } from '../storage/contracts/provider-store.js'

// ── Lightweight event bus interface (avoids circular dep on CapabilityEventBus) ──

export interface ProviderRegistrarEventBus {
  emit(event: { type: string; [key: string]: unknown }): void
}

// ── Result types ────────────────────────────────────────────────────────────────

export interface RegisterResult {
  providerId: string
  slug: string
  status: 'created' | 'updated' | 'unchanged'
  tablesAffected: string[]
  rowsAdded: number
  rowsModified: number
}

export interface SeedAllResult {
  seeded: RegisterResult[]
  skipped: string[]
  errors: Array<{ file: string; error: string }>
}

export interface VerifyResult {
  valid: boolean
  providers: Array<{
    slug: string
    status: 'ok' | 'missing_file' | 'parse_error' | 'schema_mismatch'
    details: string
  }>
}

// ── Auditor interface (avoids circular dep on RegistrationAuditor) ───────────────

export interface ProviderRegistrarAuditor {
  registerAndAudit(manifest: ProviderManifest): Promise<void>
}

// ── ProviderRegistrar ───────────────────────────────────────────────────────────

export class ProviderRegistrar {
  private readonly seedsDir: string

  constructor(
    private store: ProviderStore,
    private auditor?: ProviderRegistrarAuditor,
    private eventBus?: ProviderRegistrarEventBus,
    seedsDir?: string,
  ) {
    this.seedsDir = seedsDir ?? resolve(import.meta.dir, '../../seeds/providers')
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async register(manifest: ProviderManifest): Promise<RegisterResult> {
    const now = Date.now()
    const tablesAffected: string[] = []
    let rowsAdded = 0
    let rowsModified = 0

    // Determine if provider exists
    const existing = await this.store.getDefinitionBySlug(manifest.provider.slug)
    const status = existing ? 'updated' : 'created'
    const providerId = existing?.id ?? newId()

    // [1] Upsert provider_definition
    const defRow: ProviderDefinitionRow = {
      id: providerId,
      slug: manifest.provider.slug,
      display_name: manifest.provider.display_name,
      description: manifest.provider.description ?? null,
      category: manifest.provider.category,
      provider_type: manifest.provider.provider_type,
      is_active: 1,
      website_url: manifest.provider.website_url ?? null,
      documentation_url: manifest.provider.documentation_url ?? null,
      auth_type: manifest.provider.auth_type,
      has_multi_account: manifest.provider.has_multi_account ? 1 : 0,
      profile_strategy: manifest.provider.profile_strategy,
      fleet_config_json: JSON.stringify(manifest.provider.fleet_config ?? {}),
      capabilities_json: JSON.stringify(manifest.provider.capabilities),
      models_json: JSON.stringify([]),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }
    await this.store.upsertDefinition(defRow)
    tablesAffected.push('provider_definition')
    if (existing) rowsModified++
    else rowsAdded++

    // [2] Delete old endpoints → Upsert new endpoints
    await this.store.deleteProviderEndpoints(providerId)
    for (const ep of manifest.endpoints) {
      const epRow: ProviderEndpointRow = {
        id: newId(),
        provider_id: providerId,
        url: ep.url,
        label: ep.label,
        endpoint_type: ep.endpoint_type,
        is_default: ep.is_default ? 1 : 0,
        selector_json: JSON.stringify(ep.selector ?? {}),
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertEndpoint(epRow)
      rowsAdded++
    }
    if (manifest.endpoints.length > 0) tablesAffected.push('provider_endpoint')

    // [3] Delete old parsers → Upsert new parsers
    await this.store.deleteProviderParsers(providerId)
    for (const parser of manifest.parsers) {
      const parserRow: ProviderParserRow = {
        id: newId(),
        provider_id: providerId,
        parser_name: parser.name,
        parser_version: parser.version,
        parser_logic_type: 'file',
        parser_file_path: parser.file ?? null,
        parser_hash: null,
        is_active: parser.is_active ? 1 : 0,
        fallback_parser_id: null,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertParser(parserRow)
      rowsAdded++
    }
    if (manifest.parsers.length > 0) tablesAffected.push('provider_parser')

    // [4] Delete old capabilities → Upsert new capabilities
    await this.store.deleteProviderCapabilities(providerId)
    for (const cap of manifest.capabilities_config) {
      const capRow: ProviderCapabilityRow = {
        id: newId(),
        provider_id: providerId,
        global_capability_id: cap.global_capability_id,
        recovery_strategies_json: JSON.stringify(cap.recovery_strategies ?? []),
        ui_component_override: cap.ui_component_override ?? null,
        ui_label_override: cap.ui_label_override ?? null,
        ui_icon_override: cap.ui_icon_override ?? null,
        ui_position_override: cap.ui_position_override ?? null,
        ui_order_override: cap.ui_order_override ?? null,
        ui_group_override: cap.ui_group_override ?? null,
        ui_priority_override: cap.ui_priority_override ?? null,
        interaction_mode_override: cap.interaction_mode_override ?? null,
        ui_states_override_json: cap.ui_states_override
          ? JSON.stringify(cap.ui_states_override)
          : null,
        ui_visibility_rule_override: cap.ui_visibility_rule_override ?? null,
        existential_rule_override: cap.existential_rule_override ?? null,
        ui_input_schema_override: cap.ui_input_schema_override
          ? JSON.stringify(cap.ui_input_schema_override)
          : null,
        mutation_effects_override_json: cap.mutation_effects_override
          ? JSON.stringify(cap.mutation_effects_override)
          : null,
        recovery_behavior_override: cap.recovery_behavior_override ?? null,
        state_persistence_override: cap.state_persistence_override ?? null,
        data_flow_override: cap.data_flow_override ?? null,
        min_plan_tier_override: cap.min_plan_tier_override ?? null,
        depends_on_override_json: cap.depends_on_override
          ? JSON.stringify(cap.depends_on_override)
          : null,
        confidence: 1.0,
        success_count: 0,
        fail_count: 0,
        consecutive_failures: 0,
        avg_latency_ms: 0,
        p95_latency_ms: 0,
        last_used_at: null,
        selector_hit_count: 0,
        selector_miss_count: 0,
        selector_last_miss_at: null,
        selector_last_error: null,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertCapability(capRow)
      rowsAdded++
    }
    if (manifest.capabilities_config.length > 0) tablesAffected.push('provider_capability')

    // [5] Delete old configs → Upsert new configs
    await this.store.deleteProviderConfigs(providerId)
    for (const cfg of manifest.config) {
      const cfgRow: ProviderConfigRow = {
        id: newId(),
        provider_id: providerId,
        config_key: cfg.key,
        config_value: cfg.value,
        config_type: cfg.type ?? 'string',
        is_secret: cfg.is_secret ? 1 : 0,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertConfig(cfgRow)
      rowsAdded++
    }
    if (manifest.config.length > 0) tablesAffected.push('provider_config')

    // [6] Delete old models → Upsert new models
    await this.store.deleteProviderModels(providerId)
    for (const model of manifest.models) {
      const modelRow: ProviderModelRow = {
        id: newId(),
        provider_id: providerId,
        model_slug: model.slug,
        display_name: model.display_name,
        is_active: 1,
        is_default: model.is_default ? 1 : 0,
        capabilities_json: '[]',
        context_window: model.context_window ?? null,
        max_output_tokens: model.max_output_tokens ?? null,
        supports_streaming: model.supports_streaming ? 1 : 0,
        supports_vision: model.supports_vision ? 1 : 0,
        supports_thinking: model.supports_thinking ? 1 : 0,
        supports_tools: model.supports_tools ? 1 : 0,
        pricing_input_per_1m: model.pricing_input_per_1m ?? null,
        pricing_output_per_1m: model.pricing_output_per_1m ?? null,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertModel(modelRow)
      rowsAdded++
    }
    if (manifest.models.length > 0) tablesAffected.push('provider_model')

    // [7] Emit event
    this.eventBus?.emit({
      type: 'provider:seeded',
      providerId,
      capabilities: manifest.capabilities_config.length,
    })

    // [8] Audit (if configured)
    if (this.auditor) {
      await this.auditor.registerAndAudit(manifest)
    }

    return {
      providerId,
      slug: manifest.provider.slug,
      status,
      tablesAffected,
      rowsAdded,
      rowsModified,
    }
  }

  async seedAll(): Promise<SeedAllResult> {
    const result: SeedAllResult = { seeded: [], skipped: [], errors: [] }

    let files: string[]
    try {
      const entries = await readdir(this.seedsDir)
      files = entries.filter((f) => f.endsWith('.json'))
    } catch (err) {
      result.errors.push({ file: this.seedsDir, error: `Cannot read seeds dir: ${err}` })
      return result
    }

    for (const file of files) {
      const filePath = join(this.seedsDir, file)
      try {
        const raw = await readFile(filePath, 'utf-8')
        const parsed: unknown = JSON.parse(raw)
        const manifest = ProviderManifestSchema.parse(parsed)
        const registerResult = await this.register(manifest)
        result.seeded.push(registerResult)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push({ file, error: msg })
      }
    }

    return result
  }

  async seedProvider(providerSlug: string): Promise<RegisterResult> {
    const filePath = join(this.seedsDir, `${providerSlug}.json`)
    const raw = await readFile(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    const manifest = ProviderManifestSchema.parse(parsed)
    return this.register(manifest)
  }

  async verifySeeds(): Promise<VerifyResult> {
    const result: VerifyResult = { valid: true, providers: [] }

    let files: string[]
    try {
      const entries = await readdir(this.seedsDir)
      files = entries.filter((f) => f.endsWith('.json'))
    } catch {
      result.valid = false
      result.providers.push({
        slug: '(dir)',
        status: 'missing_file',
        details: `Cannot read seeds directory: ${this.seedsDir}`,
      })
      return result
    }

    for (const file of files) {
      const filePath = join(this.seedsDir, file)
      const slug = file.replace('.json', '')

      try {
        const raw = await readFile(filePath, 'utf-8')
        const parsed: unknown = JSON.parse(raw)
        const parseResult = ProviderManifestSchema.safeParse(parsed)

        if (!parseResult.success) {
          result.valid = false
          result.providers.push({
            slug,
            status: 'schema_mismatch',
            details: parseResult.error.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; '),
          })
          continue
        }

        result.providers.push({ slug, status: 'ok', details: 'Valid manifest' })
      } catch (err) {
        result.valid = false
        const msg = err instanceof Error ? err.message : String(err)
        result.providers.push({
          slug,
          status: 'parse_error',
          details: msg,
        })
      }
    }

    return result
  }

  async reloadFromSeeds(): Promise<SeedAllResult> {
    return this.seedAll()
  }
}
