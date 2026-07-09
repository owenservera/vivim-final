# Unit 2.5: ProviderManifest Zod validation schema

**Phase:** 2 | **File:** `src/schema/provider-manifest.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** Zod schema for validating provider JSON manifests
**Source:** `06-merged-seeds.md` §Provider Manifest JSON Schema, `04-merged-engines.md` §Engine 5 seed flow

## Purpose

Zod schema that validates `seeds/providers/*.json` files before `ProviderRegistrar.register()` inserts them. The seed flow (unit 2.1) calls "Validate against Zod schema" — this unit defines that schema. Must match the `ProviderManifest` interface from 06-merged-seeds.md exactly.

## Interface
```typescript
import { z } from 'zod/v4';

export const ProviderManifestSchema = z.object({
  $schema: z.literal('https://vivim.app/cap-store/v1/provider-manifest.schema.json'),
  provider: z.object({
    slug: z.string().min(1),
    display_name: z.string().min(1),
    description: z.string(),
    category: z.string(),
    provider_type: z.string(),
    website_url: z.string().url(),
    documentation_url: z.string().url().optional(),
    auth_type: z.string(),
    has_multi_account: z.boolean(),
    profile_strategy: z.string(),
    fleet_config: z.object({
      chrome_path: z.string().optional(),
      port_range: z.tuple([z.number(), z.number()]).optional(),
      extra_args: z.array(z.string()).optional(),
    }).optional(),
    capabilities: z.array(z.string()),
  }),
  endpoints: z.array(z.object({
    label: z.string(),
    url: z.string().url(),
    endpoint_type: z.enum(['landing', 'chat', 'login', 'api', 'auth']),
    is_default: z.boolean().optional(),
    selector: z.record(z.string()).optional(),
  })),
  parsers: z.array(z.object({
    name: z.string(),
    file: z.string(),
    version: z.number().int().positive(),
    is_active: z.boolean().optional(),
    fallback: z.string().optional(),
  })),
  models: z.array(z.object({
    slug: z.string(),
    display_name: z.string(),
    is_default: z.boolean().optional(),
    context_window: z.number().int().positive().optional(),
    max_output_tokens: z.number().int().positive().optional(),
    supports_streaming: z.boolean().optional(),
    supports_vision: z.boolean().optional(),
    supports_thinking: z.boolean().optional(),
    supports_tools: z.boolean().optional(),
    pricing_input_per_1m: z.number().optional(),
    pricing_output_per_1m: z.number().optional(),
  })),
  capabilities_config: z.array(z.object({
    global_capability_id: z.string(),
    recovery_strategies: z.array(z.object({
      type: z.enum(['retry_selector', 'retry_with_fallback', 'navigate_home', 'restart_chrome', 'mark_broken']),
      config: z.record(z.unknown()).optional(),
    })).optional(),
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
  })),
  config: z.array(z.object({
    key: z.string(),
    value: z.string(),
    type: z.string().optional(),
    is_secret: z.boolean().optional(),
  })),
});

export type ProviderManifest = z.infer<typeof ProviderManifestSchema>;
```

## Tests
- [ ] Valid Claude manifest passes validation
- [ ] Missing `$schema` field fails validation
- [ ] Invalid `endpoint_type` enum fails validation
- [ ] Empty `endpoints` array passes (valid — some providers have no endpoints)
- [ ] `fleet_config` is optional — omitting it passes
- [ ] Invalid URL in `website_url` fails validation

## Gate
- `bunx tsc --noEmit` passes
- `ProviderRegistrar.seedAll()` can import and use this schema
- All 7 seed files validate against this schema
