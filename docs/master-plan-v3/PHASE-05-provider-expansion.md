# Phase 5: Provider & Capability Expansion

**Status:** PROPOSED
**Units:** 10
**Depends on:** Phase 2
**Produces:** Full provider coverage (every major consumer-AI site works), MCP integration as first-class, local-model providers (Ollama/llama.cpp) as default rather than fallback.

---

## Goal

The current provider roster (chatgpt, claude, gemini, deepseek, qwen, studio-ai, z-ai, system) covers the basics but lacks: (a) programmatic/API providers treated as first-class (OpenAI direct, Anthropic direct, OpenRouter), (b) local models (Ollama) as anything more than an airgap fallback, (c) robust capability coverage — most providers only have `send_message` + `select_model` wired. Phase 5 makes the provider layer comprehensive and turns local models into the default rather than the fallback.

---

## Units

### 5.1 Local model provider (Ollama) — first-class registration
**Source:** v3 Overview §1.10
**Depends on:** —
**Produces:** `seeds/providers/ollama.json` + adapter engine; local models appear in capability palette alongside cloud providers.

`ollama.json` declares `auth_type: "none"`, `provider_type: "local"`, endpoints point at `http://localhost:11434`. `LocalModelAdapter` (existing) is wrapped as a `ProviderPlugin` that implements `onAction` for `send_message`/`select_model`. Provider is marked `isLocal: true` and is preferred when `AirGapEngine` is enabled.

### 5.2 Local model provider (llama.cpp server)
**Source:** v3 Overview §1.10
**Depends on:** 5.1
**Produces:** `seeds/providers/llamacpp.json` + adapter for llama.cpp's HTTP server.

Same pattern as Ollama but for `llama.cpp --server`. Different response format (OpenAI-compatible). Adapter parses accordingly.

### 5.3 API-direct providers (OpenAI, Anthropic, OpenRouter)
**Source:** v3 Overview §1.10
**Depends:** —
**Produces:** `seeds/providers/openai-api.json`, `anthropic-api.json`, `openrouter.json`.

These skip Chrome entirely and call the cloud API directly. `auth_type: "api_key"`, no endpoints (or virtual endpoints), parsers use the existing inline SSE logic. Account row stores `apiKeyRef` instead of `profileDir`.

### 5.4 Capability taxonomy v2 — full coverage
**Source:** v3 Overview §1.2
**Depends on:** 1.3
**Produces:** ~60 capability taxonomy rows covering every common AI-site action.

Current taxonomy is implicit in seed JSON. Phase 5 formalizes it: `send_message`, `select_model`, `edit_message`, `regenerate_response`, `delete_chat`, `rename_chat`, `create_new_chat`, `navigate_chat`, `upload_file`, `toggle_extended_thinking`, `toggle_web_search`, `toggle_tools`, `deep_research`, `export_conversation`, `clear_context`, `browse_with_bing`, `view_artifacts`, `run_code`, `analyze_image`, `transcribe_audio`, etc. Each gets full 21-field UI contract + intent patterns.

### 5.5 Capability-binding matrix per provider
**Source:** v3 Overview §1.2
**Depends on:** 5.4
**Produces:** Every provider declares which capabilities it supports + selectors.

For each provider × capability, a `provider_capability` row with selector strategies, recovery strategies, and UI overrides. Most browser-based providers share selectors; document the differences. Test each binding via the integration harness.

### 5.6 MCP server discovery + auto-registration
**Source:** v3 Overview §1.3
**Depends:** 2.9
**Produces:** MCP servers in `mcp_server_config` auto-register their tools as live capabilities.

On startup, `McpClientAdapter.connect` to each enabled server, fetch tool list, register each tool as a `LiveCapability` with `handlerSpec.kind: 'mcp'`. Tools get slug `mcp:{serverName}:{toolName}` and appear in the capability palette.

### 5.7 MCP server exposure (vivim-as-MCP-server)
**Source:** v3 Overview §1.3
**Depends:** 1.3
**Produces:** `McpServerAdapter` (existing) wired with the full capability catalog.

Every `UnifiedCapabilityRegistry` entry with `surface: 'mcp'` is exposed via `McpServerAdapter`. External agents (Claude Code, Cursor, etc.) can connect and invoke vivim capabilities as MCP tools. Endpoint: `ws://localhost:9421`.

### 5.8 Provider consent + local-first enforcement
**Source:** v3 Overview §1.10
**Depends:** 5.1, Phase 9
**Produces:** `provider_consent` table; `TelemetryAuditInterceptor` blocks unconsented outbound calls.

Each cloud provider requires explicit user consent before first use (recorded in `provider_consent`). Bun's global `fetch` is monkey-patched to check consent + log to `TelemetryAudit` on every call. Unconsented hosts get a `403` thrown locally.

### 5.9 Provider discovery v2 (UI-driven)
**Source:** v3 Overview §1.6 (extending existing `ProviderDiscoveryEngine`)
**Depends on:** 3.13, Phase 3
**Produces:** Discovery is operable from the workspace UI.

User pastes a URL into a "Discover new provider" panel. Discovery engine runs (existing), produces manifest draft, opens an approval canvas. User edits the manifest inline (canvas-bound form), approves → provider is registered + seeded.

### 5.10 Provider test harness
**Source:** v3 Overview §4 (Scenario C — self-healing depends on this)
**Depends:** 5.5
**Produces:** Automated provider-capability smoke tests.

Per-provider integration test that exercises each declared capability against the live site (or API mock). Runs in CI nightly + on-demand via `bun run devops gate --include-integration`. Records outcomes to `ProvenanceGraph`. Drift detected → `drift_event` row + health score hit.

---

## Acceptance

- Local Ollama installation appears in the provider palette within 1s of startup.
- A user can connect an external MCP server and its tools appear as capabilities within 5s.
- A user can discover a new provider from a URL, edit the manifest, and register it without touching a CLI.
- Nightly provider test harness runs against the 3 main browser providers and reports a green/red matrix.
- `TelemetryAudit` report shows zero outbound calls to non-consented hosts after fresh install.
