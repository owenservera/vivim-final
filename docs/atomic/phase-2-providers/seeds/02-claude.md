# Unit 2.5: Seed — claude.json

**Phase:** 2 | **File:** `seeds/providers/claude.json`
**Depends:** 2.1 ProviderRegistrar | **Produces:** Claude AI provider in DB
**Source:** `06-merged-seeds.md` §Claude (full manifest)

## ProviderManifest Schema
```typescript
interface ProviderManifest {
  $schema: "https://vivim.app/cap-store/v1/provider-manifest.schema.json";
  provider: {
    slug: string;
    display_name: string;
    description: string;
    category: string;
    provider_type: string;
    website_url: string;
    documentation_url?: string;
    auth_type: string;
    has_multi_account: boolean;
    profile_strategy: string;
    fleet_config?: { chrome_path?: string; port_range?: [number, number]; extra_args?: string[] };
    capabilities: string[];
  };
  endpoints: Array<{ label: string; url: string; endpoint_type: string; is_default?: boolean; selector?: Record<string, string> }>;
  parsers: Array<{ name: string; file: string; version: number; is_active?: boolean; fallback?: string }>;
  models: Array<{ slug: string; display_name: string; is_default?: boolean; context_window?: number; max_output_tokens?: number; supports_streaming?: boolean; supports_vision?: boolean; supports_thinking?: boolean; supports_tools?: boolean; pricing_input_per_1m?: number; pricing_output_per_1m?: number }>;
  capabilities_config: Array<{ global_capability_id: string; recovery_strategies?: Array<{ type: string; config?: object }>; ui_component_override?: string; ui_label_override?: string; ui_icon_override?: string; ui_position_override?: string; ui_priority_override?: string; existential_rule_override?: string; min_plan_tier_override?: string; depends_on_override?: string[] }>;
  config: Array<{ key: string; value: string; type?: string; is_secret?: boolean }>;
}
```

## Summary
Claude AI (Anthropic) — `claude`. Category: ai, provider_type: llm.
Auth: browser, multi_account: true, profile_strategy: per_account.
3 models: Sonnet 4 (default), Opus 4, Haiku 4.
11 capabilities: select_model, send_message, edit_message, regenerate_response, toggle_extended_thinking, upload_file, create_new_chat, navigate_chat, delete_chat, rename_chat, deep_research.
1 parser: claude/001_streaming_sse.ts.

## Key Selectors
- Composer: `[contenteditable]`
- Send button: `[aria-label='Send Message']`
- Login email: `input[type='email']`
- Continue button: `button[type='submit']`

## Recovery Strategies (send_message)
1. retry_selector — retry with same selector
2. retry_with_fallback (fallback: textarea) — try alternative selector
3. navigate_home — navigate to chat page and retry

## Tier Gating
- `deep_research` → min_plan_tier: pro

## Gate
- Valid JSON that parses to ProviderManifest interface
- All 3 endpoints defined (landing, chat, login)
- All 3 models defined with correct feature flags
- All 11 capabilities listed in provider.capabilities
