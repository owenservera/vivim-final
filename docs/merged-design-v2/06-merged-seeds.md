# 06 — Merged Seeds: Provider Manifests, Parsers & Harness Modules

**Status:** FINAL — merged PRD
**Covers:** Original `04-provider-manifest.md` + `06-seed-file-specs.md` (updated to TypeScript)

---

## Provider Manifest JSON Schema

Each manifest file in `seeds/providers/<slug>.json`:

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
    fleet_config?: {
      chrome_path?: string;
      port_range?: [number, number];
      extra_args?: string[];
    };
    capabilities: string[];           // list of global capability slugs
  };
  endpoints: Array<{
    label: string;
    url: string;
    endpoint_type: 'landing' | 'chat' | 'login' | 'api' | 'auth';
    is_default?: boolean;
    selector?: Record<string, string>;
  }>;
  parsers: Array<{
    name: string;
    file: string;                    // relative to seeds/parsers/
    version: number;
    is_active?: boolean;
    fallback?: string;
  }>;
  models: Array<{
    slug: string;
    display_name: string;
    is_default?: boolean;
    context_window?: number;
    max_output_tokens?: number;
    supports_streaming?: boolean;
    supports_vision?: boolean;
    supports_thinking?: boolean;
    supports_tools?: boolean;
    pricing_input_per_1m?: number;
    pricing_output_per_1m?: number;
  }>;
  capabilities_config: Array<{
    global_capability_id: string;
    recovery_strategies?: Array<{
      type: 'retry_selector' | 'retry_with_fallback' | 'navigate_home' | 'restart_chrome' | 'mark_broken';
      config?: Record<string, unknown>;
    }>;
    ui_component_override?: string;
    ui_label_override?: string;
    ui_icon_override?: string;
    ui_position_override?: string;
    ui_order_override?: number;
    ui_group_override?: string;
    ui_priority_override?: string;
    interaction_mode_override?: string;
    ui_states_override?: string[];
    ui_visibility_rule_override?: string;
    existential_rule_override?: string;
    ui_input_schema_override?: Record<string, unknown>;
    mutation_effects_override?: Record<string, unknown>;
    recovery_behavior_override?: string;
    state_persistence_override?: string;
    data_flow_override?: string;
    min_plan_tier_override?: string;
    depends_on_override?: string[];
  }>;
  config: Array<{
    key: string;
    value: string;
    type?: string;
    is_secret?: boolean;
  }>;
}
```

---

## Provider Manifest: Claude

```json
{
  "$schema": "https://vivim.app/cap-store/v1/provider-manifest.schema.json",
  "provider": {
    "slug": "claude",
    "display_name": "Claude",
    "description": "Anthropic's Claude AI assistant",
    "category": "ai",
    "provider_type": "llm",
    "website_url": "https://claude.ai",
    "documentation_url": "https://docs.anthropic.com",
    "auth_type": "browser",
    "has_multi_account": true,
    "profile_strategy": "per_account",
    "fleet_config": {
      "port_range": [9222, 9250],
      "extra_args": ["--disable-features=Translate", "--no-first-run"]
    },
    "capabilities": [
      "select_model", "send_message", "edit_message", "regenerate_response",
      "toggle_extended_thinking", "upload_file", "create_new_chat",
      "navigate_chat", "delete_chat", "rename_chat", "deep_research"
    ]
  },
  "endpoints": [
    {
      "label": "Landing",
      "url": "https://claude.ai",
      "endpoint_type": "landing",
      "is_default": true
    },
    {
      "label": "Chat",
      "url": "https://claude.ai/chat",
      "endpoint_type": "chat",
      "selector": { "composer": "[contenteditable]", "send_button": "[aria-label='Send Message']" }
    },
    {
      "label": "Login",
      "url": "https://claude.ai/login",
      "endpoint_type": "login",
      "selector": { "email_input": "input[type='email']", "continue_button": "button[type='submit']" }
    }
  ],
  "parsers": [
    {
      "name": "Claude SSE Streaming Parser",
      "file": "claude/001_streaming_sse.ts",
      "version": 1,
      "is_active": true
    }
  ],
  "models": [
    { "slug": "claude-sonnet-4-20250514", "display_name": "Sonnet 4", "is_default": true, "context_window": 200000, "max_output_tokens": 64000, "supports_streaming": true, "supports_vision": true, "supports_thinking": true, "supports_tools": true },
    { "slug": "claude-opus-4-20250514", "display_name": "Opus 4", "context_window": 200000, "max_output_tokens": 64000, "supports_streaming": true, "supports_vision": true, "supports_thinking": true, "supports_tools": true },
    { "slug": "claude-haiku-4-20250514", "display_name": "Haiku 4", "context_window": 200000, "max_output_tokens": 64000, "supports_streaming": true, "supports_vision": true, "supports_tools": true }
  ],
  "capabilities_config": [
    {
      "global_capability_id": "send_message",
      "recovery_strategies": [
        { "type": "retry_selector" },
        { "type": "retry_with_fallback", "config": { "fallback_selector": "textarea" } },
        { "type": "navigate_home" }
      ],
      "ui_component_override": "text_input",
      "ui_label_override": "Send to Claude",
      "ui_icon_override": "arrow-up-circle",
      "ui_position_override": "composer",
      "ui_priority_override": "primary"
    },
    {
      "global_capability_id": "select_model",
      "ui_component_override": "dropdown_selector",
      "ui_label_override": "Select Claude Model",
      "ui_icon_override": "cpu",
      "ui_position_override": "header",
      "ui_priority_override": "primary"
    },
    {
      "global_capability_id": "toggle_extended_thinking",
      "ui_component_override": "toggle_switch",
      "ui_label_override": "Extended Thinking",
      "ui_position_override": "header",
      "ui_priority_override": "secondary",
      "existential_rule_override": "message_has_thinking_block"
    },
    {
      "global_capability_id": "deep_research",
      "ui_component_override": "action_button",
      "ui_label_override": "Deep Research",
      "ui_icon_override": "flask",
      "ui_position_override": "composer",
      "ui_priority_override": "secondary",
      "min_plan_tier_override": "pro"
    }
  ],
  "config": [
    { "key": "base_url", "value": "https://claude.ai" },
    { "key": "auth_type", "value": "email" }
  ]
}
```

---

## Provider Manifests: Remaining 6 Providers

*(Abbreviated — same schema, provider-specific values)*

| File | Slug | Models | Key capabilities |
|------|------|--------|-----------------|
| `chatgpt.json` | chatgpt | gpt-4o, gpt-4-turbo, o1 | send_message, select_model, upload_file, create_new_chat, temporary_chat |
| `gemini.json` | gemini | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash-lite | send_message, select_model, upload_file, flash_thinking |
| `deepseek.json` | deepseek | deepseek-v3, deepseek-r1 | send_message, select_model, deep_think |
| `studio-ai.json` | studio-ai | studio-ai-turbo | send_message, select_model, agent_mode |
| `z-ai.json` | z-ai | z-ai-pro | send_message, select_model |
| `qwen.json` | qwen | qwen-max, qwen-plus | send_message, select_model, upload_file, web_search |

Complete JSON files include all fields shown in the schema above.

---

## Parser Seed File Contract

All parser seed files must export a `ParserModule`:

```typescript
// seeds/parsers/<provider>/NNN_<name>.ts

interface ParserModule {
  /** Unique parser name */
  name: string;
  /** Incremented on each change */
  version: number;
  /** Provider slug this parser targets */
  providerId: string;

  /**
   * Parse a raw provider API response body into typed ContentBlock[].
   * Must be pure (no side effects, no network I/O).
   */
  parse(rawBody: string): ContentBlock[];

  /**
   * Detect whether the raw body represents a completed response.
   * Returns true when the SSE stream (or equivalent) has terminated.
   */
  detectCompletion(rawBody: string): boolean;

  /**
   * Return a confidence score 0.0-1.0 for how well this parser
   * understood the raw body. 0.0 = completely unrecognized format.
   */
  getConfidence(rawBody: string): number;
}

export default parserModule; // named export also accepted
```

---

## Parser Seed File: Claude SSE Parser

```typescript
// seeds/parsers/claude/001_streaming_sse.ts

import type { ParserModule, ContentBlock } from '../../../src/schema/streaming.js';

const parser: ParserModule = {
  name: 'Claude SSE Streaming Parser',
  version: 1,
  providerId: 'claude',

  parse(rawBody: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const lines = rawBody.split('\n');
    let blockIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();

      // SSE data prefix
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);

      // Stream end
      if (data === '[DONE]') break;

      try {
        const parsed = JSON.parse(data);
        const event = parsed.type || parsed.event;

        switch (event) {
          case 'content_block_start': {
            const block = parsed.content_block;
            if (!block) continue;
            blocks.push(mapBlock(block, blockIndex++));
            break;
          }
          case 'content_block_delta': {
            const delta = parsed.delta;
            if (!delta || !delta.text) continue;
            const last = blocks[blocks.length - 1];
            if (last && last.kind === 'text') {
              last.content += delta.text;
            }
            break;
          }
          case 'message_stop': {
            break;
          }
          case 'error': {
            blocks.push({ kind: 'error', message: parsed.error?.message || 'Unknown error', code: parsed.error?.code, index: blockIndex++ });
            break;
          }
        }
      } catch {
        continue; // skip unparseable lines
      }
    }

    return blocks;
  },

  detectCompletion(rawBody: string): boolean {
    return rawBody.includes('"type":"message_stop"') || rawBody.includes('data: [DONE]');
  },

  getConfidence(rawBody: string): number {
    if (!rawBody.includes('data: ')) return 0;
    if (!rawBody.includes('content_block')) return 0.3;
    if (rawBody.includes('message_stop')) return 1.0;
    return 0.7;
  },
};

function mapBlock(block: Record<string, unknown>, index: number): ContentBlock {
  const type = (block.type || 'text') as string;
  switch (type) {
    case 'text':
      return { kind: 'text', content: (block.text || '') as string, index };
    case 'tool_use':
      return { kind: 'tool_use', toolName: (block.name || '') as string, input: (block.input || {}) as Record<string, unknown>, index };
    case 'thinking':
      return { kind: 'thinking', content: (block.thinking || '') as string, index };
    case 'image':
      return { kind: 'image', url: (block.source?.url || '') as string, alt: (block.alt || '') as string, index };
    default:
      return { kind: 'meta', key: type, value: block, index };
  }
}

export default parser;
```

---

## Parser Seed File: Gemini Batchexecute Parser

```typescript
// seeds/parsers/gemini/001_batchexecute.ts

import type { ParserModule, ContentBlock } from '../../../src/schema/streaming.js';

const parser: ParserModule = {
  name: 'Gemini Batchexecute Parser',
  version: 1,
  providerId: 'gemini',

  parse(rawBody: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    let blockIndex = 0;

    const lines = rawBody.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const outer = JSON.parse(trimmed);
        if (!Array.isArray(outer)) continue;
        if (!outer[0] || !Array.isArray(outer[0])) continue;

        const inner = outer[0];
        for (const chunk of inner) {
          if (!chunk || typeof chunk !== 'string') continue;

          try {
            const parsed = JSON.parse(chunk);
            if (!Array.isArray(parsed)) continue;

            for (const item of parsed) {
              if (!Array.isArray(item)) continue;
              const data = item[1];
              if (!data) continue;

              const block = extractBlock(data, blockIndex++);
              if (block) blocks.push(block);
            }
          } catch { continue; }
        }
      } catch { continue; }
    }

    return blocks;
  },

  detectCompletion(rawBody: string): boolean {
    try {
      const outer = JSON.parse(rawBody.split('\n')[0]!);
      return Array.isArray(outer) && outer.length === 1 && Array.isArray(outer[0]) && outer[0].length === 1;
    } catch {
      return true;
    }
  },

  getConfidence(rawBody: string): number {
    try {
      JSON.parse(rawBody.split('\n')[0]!);
      return 0.8;
    } catch {
      return 0;
    }
  },
};

function extractBlock(data: unknown, index: number): ContentBlock | null {
  if (typeof data === 'string') {
    return { kind: 'text', content: data, index };
  }
  return { kind: 'meta', key: 'gemini_raw', value: data, index };
}

export default parser;
```

---

## Parser Seed File: System Fallback Parser

```typescript
// seeds/parsers/system/001_fallback.ts

import type { ParserModule, ContentBlock } from '../../../src/schema/streaming.js';

const parser: ParserModule = {
  name: 'System Fallback Parser',
  version: 1,
  providerId: 'system',

  parse(rawBody: string): ContentBlock[] {
    return [{ kind: 'text', content: rawBody, index: 0 }];
  },

  detectCompletion(_rawBody: string): boolean {
    return true;
  },

  getConfidence(rawBody: string): number {
    return rawBody.length > 0 ? 0.1 : 0;
  },
};

export default parser;
```

---

## Harness Module Contract

```typescript
// seeds/harness/<name>.module.ts

interface HarnessModule {
  /** Module identifier (matches capability slug) */
  name: string;
  /** Semantic version */
  version: number;

  /** Zod schema for input validation */
  inputSchema: ZodSchema;

  /** Zod schema for output validation */
  outputSchema: ZodSchema;

  /** Preconditions that must be true before execute */
  preconditions: string[];
  // e.g., 'composer_visible', 'logged_in', 'page_loaded'

  /** Postconditions verified after execute */
  postconditions: string[];
  // e.g., 'composer_focused', 'message_sent'

  /** Execute the harness module */
  execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult>;
}

interface HarnessContext {
  /** DOM query helpers */
  query(selector: string): Element | null;
  queryAll(selector: string): Element[];
  waitFor(selector: string, timeoutMs?: number): Promise<Element | null>;

  /** Page state */
  getPageState(): { url: string; title: string; readyState: string };

  /** Network interception */
  intercept(pattern: RegExp): Promise<string>;

  /** Telemetry emission */
  emitTelemetry(event: HarnessTelemetryEvent): void;
}

interface HarnessModuleResult {
  ok: boolean;
  output: Record<string, unknown>;
  domState?: Record<string, unknown>;
  error?: string;
}
```

---

## Harness Module: Composer

```typescript
// seeds/harness/composer.module.ts

import { z } from 'zod/v4';
import type { HarnessModule, HarnessContext, HarnessModuleResult } from '../types.js';

const inputSchema = z.object({
  action: z.enum(['focus', 'type', 'clear', 'send', 'get_content']),
  text: z.string().optional(),
  selector: z.string().optional(),
});

const outputSchema = z.object({
  ok: z.boolean(),
  action: z.string(),
  content: z.string().optional(),
  error: z.string().optional(),
});

const composerModule: HarnessModule = {
  name: 'composer',
  version: 1,
  inputSchema,
  outputSchema,
  preconditions: ['page_loaded'],
  postconditions: ['composer_visible'],

  async execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult> {
    const { action, text, selector } = inputSchema.parse(input);
    const sel = (selector as string) || '[contenteditable]';

    const el = await ctx.waitFor(sel, 5000);
    if (!el) {
      return { ok: false, output: {}, error: `Composer element not found: ${sel}` };
    }

    try {
      switch (action) {
        case 'focus': {
          (el as HTMLElement).focus();
          return { ok: true, output: { action: 'focus', content: '' } };
        }
        case 'type': {
          if (!text) return { ok: false, output: {}, error: 'text required for type action' };
          (el as HTMLElement).focus();
          document.execCommand('insertText', false, text);
          return { ok: true, output: { action: 'type', content: el.textContent || '' } };
        }
        case 'clear': {
          (el as HTMLElement).innerHTML = '';
          return { ok: true, output: { action: 'clear', content: '' } };
        }
        case 'send': {
          const sendBtn = document.querySelector('[aria-label="Send Message"]');
          if (sendBtn) {
            (sendBtn as HTMLElement).click();
            return { ok: true, output: { action: 'send' } };
          }
          // Fallback: dispatch Enter key
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return { ok: true, output: { action: 'send' } };
        }
        case 'get_content': {
          return { ok: true, output: { action: 'get_content', content: el.textContent || '' } };
        }
        default: {
          return { ok: false, output: {}, error: `Unknown action: ${action}` };
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.emitTelemetry({ type: 'error', moduleId: 'composer', data: { action, message }, ts: Date.now() });
      return { ok: false, output: {}, error: message };
    }
  },
};

export default composerModule;
```

---

## See also

- `03-merged-schema.md` — Tables seeded by these manifests
- `04-merged-engines.md` — ProviderRegistrar, StreamParserEngine, ChromeGovernor (HarnessRuntime)
