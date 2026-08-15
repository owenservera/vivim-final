# Runbook — Providers

> Set up and test AI providers (ChatGPT, Claude, Gemini, etc.).

---

## Supported Providers

| Provider | Status | Auth Method | Streaming Format |
|----------|--------|-------------|------------------|
| **ChatGPT** | Full Support | Browser (CDP) | `data: {choices[].delta.content}` + `[DONE]` |
| **Claude** | Full Support | Browser (CDP) | Anthropic SSE (`content_block_delta`) |
| **Gemini** | Full Support | Browser (CDP) | Google RPC batchexecute |
| **DeepSeek** | Supported | Browser (CDP) | SSE with reasoning channel |
| **Qwen** | Supported | Browser (CDP) | TBD |
| **Grok** | Supported | Browser (CDP) | TBD |

**Total registered:** 16 providers (including aliases like `generic`, `system`, `facebook`, `slack`, etc.)

---

## Provider Manifest

Each provider is described by a **manifest** — a declarative JSON document in `seeds/providers/manifests.ts`:

```typescript
{
  provider: {
    slug: 'chatgpt',
    display_name: 'ChatGPT',
    category: 'ai',
    provider_type: 'llm',
    auth_type: 'browser',
    capabilities: ['send_message', 'select_model', 'create_new_chat', ...],
  },
  endpoints: [
    {
      label: 'Chat',
      url: 'https://chatgpt.com',
      endpoint_type: 'chat',
      selector: {
        composer: '#prompt-textarea',
        send_button: "[data-testid='send-button']",
      },
    },
  ],
  // ... parsers, models, etc.
}
```

---

## Chrome Profiles

Each provider account needs a Chrome profile with valid cookies:

```
chrome-profiles/
  chatgpt/owservera/    # One profile per provider+account
  claude/owservera/
  gemini/owservera/
```

### Profile Meta

Each profile has a `.profile-meta.json`:

```json
{
  "providerSlug": "chatgpt",
  "accountId": "owservera",
  "allocatedAt": "2026-08-01T00:00:00Z",
  "lastUsed": "2026-08-13T00:00:00Z"
}
```

**Authentication is determined by cookie files**, not DB rows. `ProfileAllocator.isAuthenticated()` checks for `Default/Network/Cookies` or `Profile N/Network/Cookies`.

---

## Provider-Specific Gotchas

### Gemini

- Uses Quill-based composer: `div.ql-editor[contenteditable="true"]`
- **Enter doesn't work** — must click the send button
- Streaming is custom Google RPC batchexecute (NOT SSE)

### ChatGPT

- Composer: `#prompt-textarea` / `textarea[data-testid="prompt-textarea"]`
- Streaming: `data: {message: {content: {parts: [text]}}}` with `[DONE]` terminator

### Claude

- Composer: `div[contenteditable="true"]` with ProseMirror
- Streaming: Anthropic SSE (`data: {type, delta, content_block_start/stop}`)

---

## 8-Phase Onboarding Pipeline

Testing a provider follows this pipeline:

```
discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
```

| Phase | Command | What It Does |
|-------|---------|--------------|
| discover | `bun run devops discover-protocol <url> --hint=<name>` | CDP protocol discovery |
| infer | `bun run devops runtime-test onboard infer --provider=<slug>` | Infer parser from streaming data |
| test-selectors | `bun run devops runtime-test onboard test-selectors --provider=<slug>` | Validate CDP selectors |
| test-parse | `bun run devops runtime-test onboard test-parse --provider=<slug>` | Wire-format parsing tests |
| test-cap | `bun run devops runtime-test onboard test-cap --provider=<slug>` | Capability registration + execution |
| test-frontend | `bun run devops runtime-test onboard test-frontend --provider=<slug>` | E2E frontend test |
| verify | `bun run devops runtime-test onboard verify --provider=<slug>` | Cross-surface verification |
| converge | `bun run devops runtime-test onboard converge --provider=<slug>` | Spec/code/arch alignment |

---

## Checking Provider Status

```bash
# All providers
bun run devops runtime-test preflight

# Single provider
bun run devops runtime-test status --provider=gemini

# Health check
bun run devops runtime-test health

# Test via interpreter
bun run devops runtime-test test --nl="send message to gemini"
```

---

## Parser System

Parsers live **only in the DB** (inline `logic_code`, `logic_type=inline`). They are seeded from `seeds/parsers/harvested/*.ts`.

### Parser Fallback Chain

```
provider/001 → generic/001 → system/001
```

Wired by `seeds/parsers/harvest.seed.ts` via 2-pass upsert.

### Existing Parsers

| Parser | Provider | Format |
|--------|----------|--------|
| `claude-streaming-sse` | Claude | SSE `content_block_delta` |
| `chatgpt-openai-delta` | ChatGPT | `choices[].delta.content` |
| `gemini-batchexecute` | Gemini | XSSI `decodeEnvelope` |
| `google-ai-studio` | Gemini | `candidates[].content.parts[].text` |
| `deepseek-reasoning-sse` | DeepSeek | SSE with reasoning channel |
| `generic-format-agnostic` | generic | Best-effort |
| `system-raw-text` | system | Last-resort raw text |

---

## Provider Protocol Data Layer

DB is the single source of truth. Generate the static file:

```bash
bun run gen:protocol
```

### Dev/Prod Flip

```bash
bun run devops protocol dev     # Switch to dev clone
bun run devops protocol diff    # Show dev vs prod deltas
bun run devops protocol promote # Push dev → DB → regenerate prod
bun run devops protocol prod    # Switch back to prod
```

---

See [DEV.md](DEV.md) for general development setup.
