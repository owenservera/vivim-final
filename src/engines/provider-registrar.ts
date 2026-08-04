// src/engines/provider-registrar.ts
// Seeds provider intel from the canonical in-repo manifests (seeds/providers/manifests.ts)
// into the DB. Handles atomic multi-table inserts. Can reload all providers or a single provider.
// The generator (provider-protocol-generator.ts) then reads the DB into a static file.

import { resolve } from 'node:path'
import { PROVIDER_MANIFESTS } from '../../seeds/providers/manifests.js'
import { EngineError } from '../errors.js'
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
import { StreamAlignmentEngine } from './stream-align.js'

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
    // Use the slug as the stable provider id so the entire API surface (which addresses
    // providers by slug, e.g. /api/providers/claude/*) aligns with the DB primary key.
    // This removes the slug<->ULID mismatch that broke account/conversation creation.
    const providerId = manifest.provider.slug

    // [1] Upsert provider_definition
    const accessTier = manifest.provider.accessTier ?? 'free'
    const isActive = accessTier === 'free' ? 1 : 0
    const protocolStatus = accessTier === 'free' ? 'Active' : 'Locked'
    const defRow: ProviderDefinitionRow = {
      id: providerId,
      slug: manifest.provider.slug,
      display_name: manifest.provider.display_name,
      description: manifest.provider.description ?? null,
      category: manifest.provider.category,
      provider_type: manifest.provider.provider_type,
      is_active: isActive,
      protocol_status: protocolStatus,
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
        selectors_json: JSON.stringify(ep.selector ?? {}),
        composer_type: ep.composer_type ?? 'textarea',
        send_method: ep.send_method ?? 'both',
        content_editable: ep.content_editable ? 1 : 0,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertEndpoint(epRow)
      rowsAdded++
    }
    if (manifest.endpoints.length > 0) tablesAffected.push('provider_endpoint')

    // [3] Delete old parsers → Upsert new parsers
    // Two-pass: (1) insert every parser with null fallback, recording name→id;
    // (2) patch fallback_parser_id from each parser's `fallback` reference so
    // the DB parser graph reflects the manifest's fallback chain (019).
    await this.store.deleteProviderParsers(providerId)
    const parserNameToId = new Map<string, string>()
    for (const parser of manifest.parsers) {
      const logicType = parser.logic_type ?? 'inline'
      if (logicType === 'inline' && !parser.logic_code) {
        throw new EngineError(
          `Provider ${manifest.provider.slug} parser '${parser.name}': inline logic_type requires logic_code`,
        )
      }
      const parserId = newId()
      const parserRow: ProviderParserRow = {
        id: parserId,
        provider_id: providerId,
        parser_name: parser.name,
        parser_version: parser.version,
        parser_logic_type: logicType,
        parser_file_path: parser.file ?? null,
        parser_logic_code: parser.logic_code ?? null,
        // Unit 2.15 — autocompute a stable hash so the parser cache stays in sync.
        parser_hash: StreamAlignmentEngine.computeParserHash(
          parser.logic_code ?? parser.file ?? `${parser.name}:${parser.version}`,
        ),
        sample_body: parser.sample_body ?? null,
        is_active: parser.is_active ? 1 : 0,
        fallback_parser_id: null,
        created_at: now,
        updated_at: now,
      }
      await this.store.upsertParser(parserRow)
      parserNameToId.set(parser.name, parserId)
      rowsAdded++
    }
    // Patch fallback references now that all parser ids are known.
    for (const parser of manifest.parsers) {
      if (
        parser.fallback &&
        parserNameToId.has(parser.name) &&
        parserNameToId.has(parser.fallback)
      ) {
        const fromId = parserNameToId.get(parser.name)
        const fallbackId = parserNameToId.get(parser.fallback)
        if (fromId && fallbackId) {
          await this.store.setParserFallback(fromId, fallbackId)
        }
      }
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

    // In-repo canonical manifests (seeds/providers/manifests.ts) — zero filesystem reads.
    // The generator inlined the 12 JSON manifests at build time; validation happens here.
    for (const raw of PROVIDER_MANIFESTS) {
      try {
        const manifest = ProviderManifestSchema.parse(raw)
        const registerResult = await this.register(manifest)
        result.seeded.push(registerResult)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push({ file: '(in-repo manifest)', error: msg })
      }
    }

    return result
  }

  async seedProvider(providerSlug: string): Promise<RegisterResult> {
    for (const raw of PROVIDER_MANIFESTS) {
      const candidate = ProviderManifestSchema.safeParse(raw)
      if (candidate.success && candidate.data.provider.slug === providerSlug) {
        return this.register(candidate.data)
      }
    }
    throw new EngineError(`Provider manifest not found for slug: ${providerSlug}`)
  }

  async verifySeeds(): Promise<VerifyResult> {
    const result: VerifyResult = { valid: true, providers: [] }

    for (const raw of PROVIDER_MANIFESTS) {
      const parseResult = ProviderManifestSchema.safeParse(raw)
      const slug =
        parseResult.success && parseResult.data.provider.slug
          ? parseResult.data.provider.slug
          : '(manifest)'

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
    }

    return result
  }

  async reloadFromSeeds(): Promise<SeedAllResult> {
    return this.seedAll()
  }

  // ── 1.3 Provider Taxonomy Layer ────────────────────────────────────────────

  async registerCapability(input: {
    providerId: string
    slug: string
    title: string
    description?: string
    category?: string
    intent?: string
    selector?: string
    version?: string
  }): Promise<{ id: string }> {
    return this.store.registerCapability(input)
  }

  async overrideCapability(input: {
    providerId: string
    capabilityId: string
    overrideType: string
    overrideJson: string
  }): Promise<void> {
    return this.store.overrideCapability(input)
  }

  async listCapabilities(
    providerId: string,
  ): Promise<
    Array<{ id: string; slug: string; title: string; description?: string; version?: string }>
  > {
    return this.store.listCapabilities(providerId)
  }
}
