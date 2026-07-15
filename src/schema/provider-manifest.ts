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
  composer_type: z
    .enum(['textarea', 'contenteditable', 'prosemirror', 'quill'])
    .optional()
    .default('textarea'),
  send_method: z.enum(['enter_key', 'button_click', 'both']).optional().default('both'),
  content_editable: z.boolean().optional().default(false),
})

const ParserSchema = z.object({
  name: z.string(),
  file: z.string().optional(), // Optional for inline parsers
  version: z.number().int().positive(),
  is_active: z.boolean().optional().default(true),
  fallback: z.string().optional(),
  logic_type: z.enum(['file', 'inline', 'composed']).optional().default('file'),
  logic_code: z.string().optional(), // Inline TypeScript/JavaScript for DB-driven loading
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

// ── Provider stream config (unit 2.16) ──────────────────────────────────────
// Validates ProviderStreamConfig rows: the wire transport, the SSE archetype,
// and the delta path(s) used to extract streamed content.

export const StreamTransportSchema = z.enum([
  'sse',
  'batchexecute',
  'websocket',
  'sse-patch',
  'json',
])
export const SseFormatSchema = z.enum(['openai', 'anthropic', 'gemini', 'generic'])

export const StreamConfigSchema = z.object({
  streamTransport: StreamTransportSchema,
  streamTerminalJson: z.string().default('[]'),
  sseFormat: SseFormatSchema.nullable().optional(),
  deltaPathJson: z
    .string()
    .refine(
      (v) => {
        try {
          const parsed = JSON.parse(v)
          return Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')
        } catch {
          return false
        }
      },
      { message: 'deltaPathJson must be a JSON array of string paths' },
    )
    .nullable()
    .optional(),
  contentType: z.string().nullable().optional(),
  completionDetectorsJson: z.string().default('[]'),
  isActive: z.number().int().min(0).max(1).default(1),
  version: z.number().int().positive().default(1),
})

export type StreamConfig = z.infer<typeof StreamConfigSchema>

export interface StreamConfigValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/** Unit 2.16 — validate a ProviderStreamConfig record against the schema. */
export function validateStreamConfig(config: unknown): StreamConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const result = StreamConfigSchema.safeParse(config)
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    return { valid: false, errors, warnings }
  }
  if (!result.data.deltaPathJson) {
    warnings.push('No deltaPathJson set — parser must locate the response field itself.')
  }
  if (result.data.streamTransport === 'sse' && !result.data.sseFormat) {
    warnings.push('SSE transport without an sseFormat archetype — parser may mis-detect framing.')
  }
  return { valid: errors.length === 0, errors, warnings }
}

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
