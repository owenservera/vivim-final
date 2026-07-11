// src/schema/provider-manifest.ts
// Zod schema for provider manifest JSON files.
// Validates seeds/providers/*.json before registration.

import { z } from 'zod'

const EndpointSchema = z.object({
  label: z.string(),
  url: z.string().url(),
  endpoint_type: z.enum(['landing', 'chat', 'login', 'api', 'auth']),
  is_default: z.boolean().optional().default(false),
  selector: z.record(z.string()).optional(),
})

const ParserSchema = z.object({
  name: z.string(),
  file: z.string(),
  version: z.number().int().positive(),
  is_active: z.boolean().optional().default(true),
  fallback: z.string().optional(),
})

const ModelSchema = z.object({
  slug: z.string(),
  display_name: z.string(),
  is_default: z.boolean().optional().default(false),
  context_window: z.number().int().positive().optional(),
  max_output_tokens: z.number().int().positive().optional(),
  supports_streaming: z.boolean().optional().default(false),
  supports_vision: z.boolean().optional().default(false),
  supports_thinking: z.boolean().optional().default(false),
  supports_tools: z.boolean().optional().default(false),
  pricing_input_per_1m: z.number().nonnegative().optional(),
  pricing_output_per_1m: z.number().nonnegative().optional(),
})

const CapabilityConfigSchema = z.object({
  global_capability_id: z.string(),
  recovery_strategies: z
    .array(
      z.object({
        type: z.enum([
          'retry_selector',
          'retry_with_fallback',
          'navigate_home',
          'restart_chrome',
          'mark_broken',
        ]),
        config: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
  ui_component_override: z.string().optional(),
  ui_label_override: z.string().optional(),
  ui_icon_override: z.string().optional(),
  ui_position_override: z.string().optional(),
  ui_order_override: z.number().int().optional(),
  ui_group_override: z.string().optional(),
  ui_priority_override: z.string().optional(),
  interaction_mode_override: z.string().optional(),
  ui_states_override: z.array(z.string()).optional(),
  ui_visibility_rule_override: z.string().optional(),
  existential_rule_override: z.string().optional(),
  ui_input_schema_override: z.record(z.unknown()).optional(),
  mutation_effects_override: z.record(z.unknown()).optional(),
  recovery_behavior_override: z.string().optional(),
  state_persistence_override: z.string().optional(),
  data_flow_override: z.string().optional(),
  min_plan_tier_override: z.string().optional(),
  depends_on_override: z.array(z.string()).optional(),
})

const ConfigEntrySchema = z.object({
  key: z.string(),
  value: z.string(),
  type: z.string().optional().default('string'),
  is_secret: z.boolean().optional().default(false),
})

export const ProviderManifestSchema = z.object({
  $schema: z.string().optional(),
  provider: z.object({
    slug: z.string().min(1).max(64),
    display_name: z.string().min(1),
    description: z.string(),
    category: z.string().default('ai'),
    provider_type: z.string().default('llm'),
    website_url: z.string().url(),
    documentation_url: z.string().url().optional(),
    auth_type: z.string().default('browser'),
    has_multi_account: z.boolean().default(false),
    profile_strategy: z.string().default('per_account'),
    fleet_config: z
      .object({
        chrome_path: z.string().optional(),
        port_range: z.tuple([z.number(), z.number()]).optional(),
        extra_args: z.array(z.string()).optional(),
      })
      .optional(),
    capabilities: z.array(z.string()).default([]),
  }),
  endpoints: z.array(EndpointSchema).default([]),
  parsers: z.array(ParserSchema).default([]),
  models: z.array(ModelSchema).default([]),
  capabilities_config: z.array(CapabilityConfigSchema).default([]),
  config: z.array(ConfigEntrySchema).default([]),
})

export type ProviderManifest = z.infer<typeof ProviderManifestSchema>
