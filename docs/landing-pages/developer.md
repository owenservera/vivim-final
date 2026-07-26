# vivim Developer Landing Page

## Headline
### Build AI Integrations Without Writing Adapters

### Subheadline
Stop wrestling with brittle browser automation and inconsistent APIs. Vivim is a local-first platform that captures any AI conversation into a unified knowledge graph — complete with hot-swappable UI slots and DB-driven capability execution.

---

## The Problem: AI Integration is Broken

Every AI provider has a different way to:
- Send a message (ChatGPT: SSE with `data: {message: {content: {parts: [text]}}}` | Claude: Anthropic SSE with `content_block_delta` | Gemini: Google RPC batchexecute)
- Stream responses (each has unique wire format, completion signals, and error handling)
- Select models (different DOM structures, different selectors, different auth flows)
- Handle files, tools, thinking modes, and extended features

**Result:** You write 6+ separate adapters. Each breaks when the provider updates their UI. You maintain forks of Playwright/Puppeteer scripts. You can't share capabilities across providers.

---

## The Solution: One Engine, Every Provider

Vivim abstracts the entire AI conversation layer into a **capability-driven architecture**:

```typescript
// One call executes any capability on any provider
await capabilities.execute('send_message', 'chatgpt', 'user@email.com', {
  text: 'Hello world',
  model: 'gpt-4o'
});

// Same call works for Claude, Gemini, DeepSeek, Qwen, Grok
await capabilities.execute('send_message', 'claude', 'user@email.com', {
  text: 'Hello world',
  model: 'opus-4'
});
```

**No adapter code. No selector maintenance. No wire-format parsing.**

---

## How It Works (Technical Deep-Dive)

### 1. ChromeGovernor — Single I/O Authority
```
┌─────────────────────────────────────────────────────────┐
│                    ChromeGovernor                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ CDP Proxy   │  │ Lifecycle   │  │ Health      │     │
│  │ (send/cap-  │  │ Manager     │  │ Monitor     │     │
│  │  ture)      │  │ (launch/    │  │ (circuit    │     │
│  └─────────────┘  │  kill/      │  │  breaker,   │     │
│                   │  ensure)    │  │  watchdog)  │     │
│  ┌─────────────┐  └─────────────┘  └─────────────┘     │
│  │ Trace Log   │                                        │
│  │ (every CDP  │                                        │
│  │  call)      │                                        │
│  └─────────────┘                                        │
└─────────────────────────────────────────────────────────┘
         ▲
         │ Only component that touches CDP
         │ (Governor Canon — architectural invariant)
         │
┌─────────────────────────────────────────────────────────┐
│              Provider Knowledge Graph                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Provider    │  │ Provider    │  │ Provider    │     │
│  │ Registrar   │  │ Health      │  │ Selectors   │     │
│  │ (seeds DB)  │  │ Kernel      │  │ (fallback   │     │
│  └─────────────┘  └─────────────┘  │  chains)    │     │
│                                    └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

**Key Invariant:** No engine imports `BunCdpClient` directly. All Chrome interaction flows through `ChromeGovernor.cdp.send()`, `ChromeGovernor.cdp.capture()`, `ChromeGovernor.cdp.executeHarnessPlan()`.

---

### 2. Provider Registrar — Manifest → Database

Each provider is defined by a **manifest** (JSON) that seeds the database:

```json
{
  "provider": {
    "slug": "chatgpt",
    "display_name": "ChatGPT",
    "capabilities": ["send_message", "select_model", "edit_message", "regenerate_response"]
  },
  "endpoints": [{
    "label": "Chat",
    "url": "https://chatgpt.com",
    "endpoint_type": "chat",
    "selector": {
      "composer": "#prompt-textarea",
      "send_button": "[data-testid='send-button']"
    },
    "composer_type": "textarea",
    "send_method": "both"
  }],
  "models": [
    {"slug": "gpt-4o", "display_name": "GPT-4o", "is_default": true, "supports_streaming": true, "supports_vision": true}
  ],
  "capabilities_config": [{
    "global_capability_id": "send_message",
    "recovery_strategies": [{"type": "retry_selector"}, {"type": "navigate_home"}],
    "ui_component_override": "text_input",
    "ui_label_override": "Send to ChatGPT"
  }]
}
```

At boot, `ProviderRegistrar`:
1. Upserts `provider_definition`, `provider_endpoint`, `provider_model`
2. Registers `provider_capability` rows linking to global capability taxonomy
3. Wires `fallback_parser_id` chains from manifest `fallback` fields
4. Emits `provider:seeded` event for downstream engines

**Result:** Adding a new provider = drop a JSON file in `seeds/providers/` + run `bun run seed`.

---

### 3. StreamParserEngine — DB-Driven Wire Format Parsing

Parsers live **only in the database** as inline `logic_code` (`logic_type=inline`). Never in source code.

```typescript
// Parser module shape (stored in DB, loaded at runtime)
exports.default = {
  name: 'claude/001_streaming_sse',
  version: 1,
  providerId: 'claude',
  parse(rawBody) {
    // Anthropic SSE: data: {type, delta, content_block_start/stop}
    const events = parseSSE(rawBody);
    return events.map(toContentBlock);
  },
  detectCompletion(rawBody) {
    return rawBody.includes('"type":"message_stop"');
  },
  getConfidence(rawBody) {
    return rawBody.includes('"type":"content_block_delta"') ? 0.95 : 0.3;
  }
};
```

**Fallback Chain (automatic):**
```
provider/001  →  generic/001  →  system/001
   │               │               │
Claude SSE    Generic SSE    Raw text
Gemini RPC    NDJSON         (never throws)
ChatGPT SSE   JSON Array
```

```typescript
// Engine usage — zero provider logic in your code
const result = await streamParser.parse(rawResponse, {
  providerId: 'claude',
  conversationId: 'conv_123'
});
// result: { blocks: ContentBlock[], confidence: 0.95, parserName: 'claude/001', fallbackDepth: 0, wireFormat: 'sse' }
```

**Parser Execution Log** — every parse attempt logged for debugging:
```sql
CREATE TABLE parser_execution_log (
  id TEXT PRIMARY KEY,
  parser_id TEXT,
  provider_id TEXT,
  confidence REAL,
  wire_format TEXT,
  duration_ms INTEGER,
  fallback_depth INTEGER,
  raw_size_bytes INTEGER,
  error TEXT,
  created_at INTEGER
);
```

---

### 4. CapabilityEngine — Execute via CDP with Recovery

```typescript
const result = await capabilityEngine.execute(
  'send_message',    // capability slug
  'chatgpt',         // provider
  'user@gmail.com',  // account
  { text: 'Hello', model: 'gpt-4o' }  // input
);

// Result structure
interface CapabilityExecutionResult {
  ok: boolean;
  capabilityId: string;
  output?: Record<string, unknown>;
  traceId: string;
  latencyMs: number;
  error?: string;
  recoveryAttempted?: boolean;
  recoveryStrategies?: RecoveryStrategyResult[];
}
```

**Recovery Strategies (configurable per capability in DB):**
```json
[
  {"type": "retry_selector"},
  {"type": "retry_with_fallback"},
  {"type": "navigate_home"},
  {"type": "restart_chrome"},
  {"type": "mark_broken"}
]
```

**Selector Fallback Chains (from DB):**
```typescript
// Primary selector fails → tries fallback selectors automatically
const composerSelectors = await store.getComposerSelectors('chatgpt');
// ['#prompt-textarea', 'textarea[data-testid="prompt-textarea"]', '[role="textbox"]']

const sendSelectors = await store.getSendButtonSelectors('gemini');
// ['button[aria-label="Send"]', '.send-button', '[data-testid="send"]']
```

---

### 5. ConversationManager — 8-Step Send Pipeline

```
RESOLVE → DERIVE SLAVE → LOCK → ENSURE → SEND → CAPTURE → PARSE → STORE+EMIT
  │           │           │        │        │         │        │        │
  ▼           ▼           ▼        ▼        ▼         ▼        ▼        ▼
Capability  Profile    Mutex    Chrome   CDP     Network   Stream    StreamBlock
Resolution  Allocator  (per     Running  Type/   Capture   Parser    Store +
  Engine     (singleton  slave)  (lazy)  Click    (regex)  Engine   EventBus
                         profile)                  
```

**Stage Timing (built-in observability):**
```typescript
interface SendResult {
  ok: boolean;
  messageId: string;
  blocks: ContentBlock[];
  text: string;
  latencyMs: number;
  timing?: {
    resolve?: number;
    recall?: number;
    ensure?: number;
    type?: number;
    submit?: number;
    capture?: number;
    parse?: number;
    store?: number;
    total?: number;
  };
}
```

---

### 6. UnifiedCapabilityRegistry — One Entry Point

**Invariant:** Every operation is a `UnifiedCapability`. CLI, API, MCP, UI are thin NL shells.

```typescript
// Register a capability (surfaces: ['cli', 'ui', 'api', 'mcp'])
registry.register(makeCapability({
  id: 'cap:send_message',
  slug: 'send_message',
  name: 'Send Message',
  description: 'Send a message to an AI provider',
  category: 'messaging',
  action: 'send',
  surfaces: ['cli', 'ui', 'api', 'mcp'],
  cliCommand: { name: 'send', aliases: ['msg', 'message'] },
  ui: { slot: 'chat.actionBar', icon: 'arrow-up-circle' },
  mcpToolName: 'send_message',
  handler: async (input, context) => {
    return capabilityEngine.execute('send_message', context.provider, context.account, input);
  }
}));
```

**NL → Capability Binding (catalog.ts):**
```typescript
export const NL_PATTERNS = [
  { pattern: /^send (.+) to (\w+)$/i, capabilityId: 'cap:send_message', extract: (m) => ({ text: m[1], provider: m[2] }) },
  { pattern: /^switch model to (.+)$/i, capabilityId: 'cap:select_model', extract: (m) => ({ model: m[1] }) },
  { pattern: /^new chat$/i, capabilityId: 'cap:create_new_chat' },
];
```

---

### 7. Hot-Swappable UI Slots (Frontend = Backend)

**12 Canonical Slots (defined in `slots.ts`):**
```typescript
export const SLOT_IDS = [
  'chat.entry',       // host region
  'chat.sidebar',     // conversation list
  'chat.thread',      // message scroll
  'chat.bubble',      // single message
  'chat.composer',    // input + send
  'chat.send',        // send button
  'chat.attach',      // attach file
  'chat.streaming',   // progressive indicator
  'chat.result',      // rich result renderer
  'chat.confirm',     // confirmation dialog
  'chat.error',       // error/toast
  'chat.header',      // provider switcher
  'chat.actionBar',   // capability buttons
] as const;
```

**Resolution Precedence:** `capabilitySlug > providerSlug > default`

```typescript
// Backend claims a slot for a capability
UIComponentRegistry.applyClaim('chat.actionBar', 'send_message', {
  component: 'CapabilitySendButton',  // catalog key
  sandbox: ['send_message']           // P8 whitelist
});

// Frontend resolves automatically (reactive via useSyncExternalStore)
const { component, source } = UIComponentRegistry.resolve('chat.actionBar', {
  providerSlug: 'chatgpt',
  capabilitySlug: 'send_message'
});
// source = 'capability' → renders bespoke SendButton for chatgpt
```

**No rebuild needed.** Slots hot-swap at runtime.

---

## Developer Experience

### Local-First, Zero Dependencies
```bash
# Clone and run
git clone https://github.com/vivim/vivim-final
cd vivim-final
bun install
bun run devops runtime-test preflight  # Health check
bun run seed                           # Seed all providers
bun run serve                          # Server on :9420
```

### TypeScript-First, Strict Mode
```typescript
// All types generated from Prisma schema + Zod at boundaries
import type { ProviderDefinitionRow, ProviderCapabilityRow } from '@vivim/types';
import { CapabilityEngine } from '@vivim/engines';

// Full autocomplete, no `any`
const provider: ProviderDefinitionRow = await store.getProvider('chatgpt');
const caps: ProviderCapabilityRow[] = await store.getCapabilities('chatgpt');
```

### Testing Infrastructure
```bash
# Unit tests (mocked store contracts)
bun test tests/unit/engines/capability.test.ts

# Integration tests (test DB)
bun test tests/integration/conversation-manager.test.ts

# E2E tests (Playwright + real Chrome)
bun test tests/e2e/provider-onboarding.test.ts

# Provider onboarding pipeline (8 phases)
bun run devops onboard run --provider=gemini --url=https://gemini.google.com/app
```

### DevOps Commands
```bash
bun run devops select                    # Next implementable unit
bun run devops gate --strict             # Quality gate (typecheck + lint + test + invariants)
bun run devops audit-code deep           # Source code audit (P0-P3 findings)
bun run devops verify-cross-surface      # CLI=API=MCP=UI parity check
bun run devops runtime-test loop         # Autonomous dev loop
```

---

## Architecture Invariants (Non-Negotiable)

| Invariant | Enforcement |
|-----------|-------------|
| **Governor Canon** | ESLint rule: no `import.*BunCdpClient` outside `chrome-governor.ts` |
| **Store Contracts** | Engines import from `contracts/`, never `impl/` |
| **DB-Only Parsers** | `StreamParserEngine` rejects file-based logic unless `allowFileLogic=true` |
| **Profile = Auth Source** | `ProfileAllocator.isAuthenticated()` checks cookie files, not DB |
| **One Profile/Provider/Account** | `ProfileAllocator` enforces singleton |
| **Lazy Chrome Startup** | `ChromeGovernor.ensureRunning()` launches on first need |
| **Triple-Layer Consistency** | Profile dir ↔ DB ↔ Runtime state reconciliation on boot |

---

## Extending Vivim

### Add a New Provider
1. Create `seeds/providers/your-provider.json` (copy from `chatgpt.json`)
2. Add parser logic to `seeds/parsers/harvested/your-provider-batchexecute.ts` (if needed)
3. Run `bun run seed`
4. Test: `bun run devops onboard run --provider=your-provider`

### Add a New Capability
1. Create handler in `src/engines/*caps.ts`
2. Register in `capability-bootstrap.ts` with `surfaces: ['cli', 'ui', 'api', 'mcp']`
3. Add NL pattern in `catalog.ts`
4. Run `bun run devops verify-cross-surface`

### Add a UI Slot
1. Add to `SLOT_IDS` in `slots.ts`
2. Register default component in `UIComponentRegistry.registerDefault()`
3. Backend claims slot via `applyClaim()` in capability handler

---

## Performance Characteristics

| Metric | Target | Actual |
|--------|--------|--------|
| Cold boot (server + engines) | < 3s | ~2.1s |
| First capability execution | < 5s | ~3.2s (includes Chrome launch) |
| Subsequent executions | < 500ms | ~180ms |
| Parser fallback chain | < 50ms | ~12ms |
| Memory (idle) | < 200MB | ~140MB |
| Concurrent Chrome slaves | 10 (configurable) | 10 |

---

## Security Model

- **Local-first:** No data leaves your machine unless you configure it
- **No API keys stored:** Browser profiles hold auth (cookies)
- **Sandboxed parser execution:** `SandboxRunner` (WASM isolate) or `new Function` fallback
- **Circuit breakers:** Per-slave, auto-recovers after `circuitBreakerResetMs`
- **Audit trail:** Every config change, capability execution, parser run logged

---

## Get Started

```bash
# 1. Clone
git clone https://github.com/vivim/vivim-final
cd vivim-final

# 2. Install (Bun required)
bun install

# 3. Verify environment
bun run devops runtime-test preflight

# 4. Seed database
bun run seed

# 5. Start server
bun run serve
# → Server listening on http://localhost:9420

# 6. Test a capability
curl -X POST http://localhost:9420/api/nlcl/interpret \
  -H "Content-Type: application/json" \
  -d '{"input": "send message to chatgpt", "surface": "cli"}'

# 7. Open UI
open http://localhost:3000
```

---

## Resources

- **Architecture Docs:** `docs/merged-design-v2/04-merged-engines.md`
- **Schema Reference:** `docs/merged-design-v2/03-merged-schema.md`
- **Invariants:** `docs/roadmap/INVARIANTS.md`
- **Provider Testing:** `bun run devops runtime-test status --provider=gemini`
- **Source Code Audit:** `bun run devops audit-code deep`
- **Community:** Discord `#vivim-dev` | GitHub Discussions

---

*Vivim is MIT-licensed. Built with Bun, Prisma, TypeScript, and ❤️ by developers who were tired of writing adapters.*