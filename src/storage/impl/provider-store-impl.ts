// src/storage/impl/provider-store-impl.ts
// Prisma-backed ProviderStore for ProviderRegistrar.

import type {
  ProviderCapabilityRow,
  ProviderConfigRow,
  ProviderDefinitionRow,
  ProviderEndpointRow,
  ProviderModelRow,
  ProviderParserRow,
} from '../../schema/types.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = Record<string, unknown>

export class ProviderStoreImpl {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db as unknown as PrismaLoose
  }

  // biome-ignore lint/suspicious/noExplicitAny: Prisma escape hatch
  private get p(): any {
    return this.db.prisma
  }

  // ── Definitions ────────────────────────────────────────────────────────────

  async upsertDefinition(def: ProviderDefinitionRow): Promise<void> {
    const now = Date.now()
    await this.p.providerDefinition.upsert({
      where: { id: def.id },
      create: {
        id: def.id,
        slug: def.slug,
        displayName: def.display_name,
        description: def.description,
        category: def.category,
        providerType: def.provider_type,
        isActive: def.is_active,
        websiteUrl: def.website_url,
        documentationUrl: def.documentation_url,
        authType: def.auth_type,
        hasMultiAccount: def.has_multi_account,
        profileStrategy: def.profile_strategy,
        fleetConfigJson: def.fleet_config_json,
        capabilitiesJson: def.capabilities_json,
        modelsJson: def.models_json,
        createdAt: def.created_at,
        updatedAt: now,
      },
      update: {
        slug: def.slug,
        displayName: def.display_name,
        description: def.description,
        category: def.category,
        providerType: def.provider_type,
        isActive: def.is_active,
        websiteUrl: def.website_url,
        documentationUrl: def.documentation_url,
        authType: def.auth_type,
        hasMultiAccount: def.has_multi_account,
        profileStrategy: def.profile_strategy,
        fleetConfigJson: def.fleet_config_json,
        capabilitiesJson: def.capabilities_json,
        modelsJson: def.models_json,
        updatedAt: now,
      },
    })
  }

  async getDefinition(id: string): Promise<ProviderDefinitionRow | null> {
    const r = await this.p.providerDefinition.findUnique({ where: { id } })
    if (!r) return null
    return {
      id: r.id,
      slug: r.slug,
      display_name: r.displayName,
      description: r.description,
      category: r.category,
      provider_type: r.providerType,
      is_active: r.isActive,
      website_url: r.websiteUrl,
      documentation_url: r.documentationUrl,
      auth_type: r.authType,
      has_multi_account: r.hasMultiAccount,
      profile_strategy: r.profileStrategy,
      fleet_config_json: r.fleetConfigJson,
      capabilities_json: r.capabilitiesJson,
      models_json: r.modelsJson,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }
  }

  async getDefinitionBySlug(slug: string): Promise<ProviderDefinitionRow | null> {
    const r = await this.p.providerDefinition.findUnique({ where: { slug } })
    if (!r) return null
    return {
      id: r.id,
      slug: r.slug,
      display_name: r.displayName,
      description: r.description,
      category: r.category,
      provider_type: r.providerType,
      is_active: r.isActive,
      website_url: r.websiteUrl,
      documentation_url: r.documentationUrl,
      auth_type: r.authType,
      has_multi_account: r.hasMultiAccount,
      profile_strategy: r.profileStrategy,
      fleet_config_json: r.fleetConfigJson,
      capabilities_json: r.capabilitiesJson,
      models_json: r.modelsJson,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }
  }

  async listDefinitions(opts?: { isActive?: boolean }): Promise<ProviderDefinitionRow[]> {
    const where = opts?.isActive !== undefined ? { isActive: opts.isActive ? 1 : 0 } : undefined
    const rows = await this.p.providerDefinition.findMany({
      where,
      orderBy: { displayName: 'asc' },
    })
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      slug: r.slug as string,
      display_name: r.displayName as string,
      description: r.description as string | null,
      category: r.category as string,
      provider_type: r.providerType as string,
      is_active: r.isActive as number,
      website_url: r.websiteUrl as string | null,
      documentation_url: r.documentationUrl as string | null,
      auth_type: r.authType as string,
      has_multi_account: r.hasMultiAccount as number,
      profile_strategy: r.profileStrategy as string,
      fleet_config_json: r.fleetConfigJson as string,
      capabilities_json: r.capabilitiesJson as string,
      models_json: r.modelsJson as string,
      created_at: r.createdAt as number,
      updated_at: r.updatedAt as number,
    }))
  }

  // ── Endpoints ──────────────────────────────────────────────────────────────

  async upsertEndpoint(ep: ProviderEndpointRow): Promise<void> {
    const now = Date.now()
    await this.p.providerEndpoint.upsert({
      where: { id: ep.id },
      create: {
        id: ep.id,
        providerId: ep.provider_id,
        url: ep.url,
        label: ep.label,
        endpointType: ep.endpoint_type,
        isDefault: ep.is_default,
        selectorsJson: ep.selectors_json,
        composerType: ep.composer_type,
        sendMethod: ep.send_method,
        contentEditable: ep.content_editable,
        createdAt: ep.created_at,
        updatedAt: now,
      },
      update: {
        url: ep.url,
        label: ep.label,
        endpointType: ep.endpoint_type,
        isDefault: ep.is_default,
        selectorsJson: ep.selectors_json,
        composerType: ep.composer_type,
        sendMethod: ep.send_method,
        contentEditable: ep.content_editable,
        updatedAt: now,
      },
    })
  }

  async deleteProviderEndpoints(providerId: string): Promise<void> {
    await this.p.providerEndpoint.deleteMany({ where: { providerId } })
  }

  // ── Parsers ────────────────────────────────────────────────────────────────

  async upsertParser(parser: ProviderParserRow): Promise<void> {
    const now = Date.now()
    await this.p.providerParser.upsert({
      where: { id: parser.id },
      create: {
        id: parser.id,
        providerId: parser.provider_id,
        parserName: parser.parser_name,
        parserVersion: parser.parser_version,
        parserLogicType: parser.parser_logic_type,
        parserFilePath: parser.parser_file_path,
        parserLogicCode: parser.parser_logic_code,
        parserHash: parser.parser_hash,
        isActive: parser.is_active,
        fallbackParserId: parser.fallback_parser_id,
        createdAt: parser.created_at,
        updatedAt: now,
      },
      update: {
        parserName: parser.parser_name,
        parserVersion: parser.parser_version,
        parserLogicType: parser.parser_logic_type,
        parserFilePath: parser.parser_file_path,
        parserLogicCode: parser.parser_logic_code,
        parserHash: parser.parser_hash,
        isActive: parser.is_active,
        fallbackParserId: parser.fallback_parser_id,
        updatedAt: now,
      },
    })
  }

  async deleteProviderParsers(providerId: string): Promise<void> {
    await this.p.providerParser.deleteMany({ where: { providerId } })
  }

  // ── Capabilities ───────────────────────────────────────────────────────────

  async upsertCapability(cap: ProviderCapabilityRow): Promise<void> {
    const now = Date.now()
    await this.p.providerCapability.upsert({
      where: { id: cap.id },
      create: {
        id: cap.id,
        providerId: cap.provider_id,
        globalCapabilityId: cap.global_capability_id,
        recoveryStrategiesJson: cap.recovery_strategies_json,
        uiComponentOverride: cap.ui_component_override,
        uiLabelOverride: cap.ui_label_override,
        uiIconOverride: cap.ui_icon_override,
        uiPositionOverride: cap.ui_position_override,
        uiOrderOverride: cap.ui_order_override,
        uiGroupOverride: cap.ui_group_override,
        uiPriorityOverride: cap.ui_priority_override,
        interactionModeOverride: cap.interaction_mode_override,
        uiStatesOverrideJson: cap.ui_states_override_json,
        uiVisibilityRuleOverride: cap.ui_visibility_rule_override,
        existentialRuleOverride: cap.existential_rule_override,
        uiInputSchemaOverride: cap.ui_input_schema_override,
        mutationEffectsOverrideJson: cap.mutation_effects_override_json,
        recoveryBehaviorOverride: cap.recovery_behavior_override,
        statePersistenceOverride: cap.state_persistence_override,
        dataFlowOverride: cap.data_flow_override,
        minPlanTierOverride: cap.min_plan_tier_override,
        dependsOnOverrideJson: cap.depends_on_override_json,
        confidence: cap.confidence,
        successCount: cap.success_count,
        failCount: cap.fail_count,
        consecutiveFailures: cap.consecutive_failures,
        avgLatencyMs: cap.avg_latency_ms,
        p95LatencyMs: cap.p95_latency_ms,
        lastUsedAt: cap.last_used_at,
        selectorHitCount: cap.selector_hit_count,
        selectorMissCount: cap.selector_miss_count,
        selectorLastMissAt: cap.selector_last_miss_at,
        selectorLastError: cap.selector_last_error,
        createdAt: cap.created_at,
        updatedAt: now,
      },
      update: {
        globalCapabilityId: cap.global_capability_id,
        recoveryStrategiesJson: cap.recovery_strategies_json,
        uiComponentOverride: cap.ui_component_override,
        uiLabelOverride: cap.ui_label_override,
        uiIconOverride: cap.ui_icon_override,
        uiPositionOverride: cap.ui_position_override,
        uiOrderOverride: cap.ui_order_override,
        uiGroupOverride: cap.ui_group_override,
        uiPriorityOverride: cap.ui_priority_override,
        interactionModeOverride: cap.interaction_mode_override,
        uiStatesOverrideJson: cap.ui_states_override_json,
        uiVisibilityRuleOverride: cap.ui_visibility_rule_override,
        existentialRuleOverride: cap.existential_rule_override,
        uiInputSchemaOverride: cap.ui_input_schema_override,
        mutationEffectsOverrideJson: cap.mutation_effects_override_json,
        recoveryBehaviorOverride: cap.recovery_behavior_override,
        statePersistenceOverride: cap.state_persistence_override,
        dataFlowOverride: cap.data_flow_override,
        minPlanTierOverride: cap.min_plan_tier_override,
        dependsOnOverrideJson: cap.depends_on_override_json,
        confidence: cap.confidence,
        successCount: cap.success_count,
        failCount: cap.fail_count,
        consecutiveFailures: cap.consecutive_failures,
        avgLatencyMs: cap.avg_latency_ms,
        p95LatencyMs: cap.p95_latency_ms,
        lastUsedAt: cap.last_used_at,
        selectorHitCount: cap.selector_hit_count,
        selectorMissCount: cap.selector_miss_count,
        selectorLastMissAt: cap.selector_last_miss_at,
        selectorLastError: cap.selector_last_error,
        updatedAt: now,
      },
    })
  }

  async deleteProviderCapabilities(providerId: string): Promise<void> {
    await this.p.providerCapability.deleteMany({ where: { providerId } })
  }

  // ── Configs ────────────────────────────────────────────────────────────────

  async upsertConfig(config: ProviderConfigRow): Promise<void> {
    const now = Date.now()
    await this.p.providerConfig.upsert({
      where: { id: config.id },
      create: {
        id: config.id,
        providerId: config.provider_id,
        configKey: config.config_key,
        configValue: config.config_value,
        configType: config.config_type,
        isSecret: config.is_secret,
        createdAt: config.created_at,
        updatedAt: now,
      },
      update: {
        configKey: config.config_key,
        configValue: config.config_value,
        configType: config.config_type,
        isSecret: config.is_secret,
        updatedAt: now,
      },
    })
  }

  async deleteProviderConfigs(providerId: string): Promise<void> {
    await this.p.providerConfig.deleteMany({ where: { providerId } })
  }

  // ── Models ─────────────────────────────────────────────────────────────────

  async upsertModel(model: ProviderModelRow): Promise<void> {
    const now = Date.now()
    await this.p.providerModel.upsert({
      where: { id: model.id },
      create: {
        id: model.id,
        providerId: model.provider_id,
        modelSlug: model.model_slug,
        displayName: model.display_name,
        isActive: model.is_active,
        isDefault: model.is_default,
        capabilitiesJson: model.capabilities_json,
        contextWindow: model.context_window,
        maxOutputTokens: model.max_output_tokens,
        supportsStreaming: model.supports_streaming,
        supportsVision: model.supports_vision,
        supportsThinking: model.supports_thinking,
        supportsTools: model.supports_tools,
        pricingInputPer1m: model.pricing_input_per_1m,
        pricingOutputPer1m: model.pricing_output_per_1m,
        createdAt: model.created_at,
        updatedAt: now,
      },
      update: {
        modelSlug: model.model_slug,
        displayName: model.display_name,
        isActive: model.is_active,
        isDefault: model.is_default,
        capabilitiesJson: model.capabilities_json,
        contextWindow: model.context_window,
        maxOutputTokens: model.max_output_tokens,
        supportsStreaming: model.supports_streaming,
        supportsVision: model.supports_vision,
        supportsThinking: model.supports_thinking,
        supportsTools: model.supports_tools,
        pricingInputPer1m: model.pricing_input_per_1m,
        pricingOutputPer1m: model.pricing_output_per_1m,
        updatedAt: now,
      },
    })
  }

  async deleteProviderModels(providerId: string): Promise<void> {
    await this.p.providerModel.deleteMany({ where: { providerId } })
  }
}
