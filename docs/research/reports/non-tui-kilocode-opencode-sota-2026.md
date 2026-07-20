# Non-TUI Kilocode / OpenCode: Capabilities, Limitations & Wiring into vivim-final
*Generated: 2026-07-18 | Sources: 18 | Confidence: High*

## Executive Summary

Kilocode (CLI 1.0, built from Kilo-Org/kilocode, a fork of OpenCode) and OpenCode both ship
fully headless, non-interactive surfaces: `kilo run --auto "<msg>"`, `opencode run ... --auto`, and
a headless HTTP server via `opencode serve` / `kilo serve` exposing an OpenAPI 3.1 spec with full
session/message/file/tool APIs. This makes them directly usable inside CI/CD, devops loops, and
scheduled agentic pipelines. The decisive architectural insight for vivim-final is that the two
systems use the word "provider" with **opposite meanings**: vivim "providers" are *browser-automated
chat UIs* (ChatGPT/Gemini/Claude) driven over CDP, while Kilo/OpenCode "providers" are *LLM API
backends* (Anthropic/OpenAI/etc.) they call. Wiring them in therefore means adding a **new
"local-agent" provider type** that shells out to `kilo run --auto` or talks to `opencode serve`,
NOT registering them alongside `chatgpt`/`gemini` as CDP targets.

## 1. Non-TUI Surfaces: What Each Tool Ships

### OpenCode
- **`opencode run "<msg>"`** — non-interactive one-shot prompt ([OpenCode CLI docs](https://opencode.ai/docs/cli/)).
  Flags: `--auto` (auto-approve permissions not explicitly denied), `--model provider/model`,
  `--agent`, `--format json` (raw JSON events), `--continue`/`--session`, `--attach <url>` (reuse a
  running `serve` instance to skip MCP cold-boot), `--dir`, `--title`, `--variant` (reasoning effort).
- **`opencode serve`** — headless HTTP server (default port 4096) publishing OpenAPI 3.1 at `/doc`
  ([OpenCode Server docs](https://opencode.ai/docs/server/)). APIs span Global/Project/Session/Message/File/Tool/Agent/TUI/Auth/Event.
  Key for integration: `POST /session`, `POST /session/:id/message` (blocking),
  `POST /session/:id/prompt_async` (fire-and-forget, 204), `GET /event` (SSE stream),
  `GET /find`, `GET /file/content`, `GET /experimental/tool/ids`. Optional HTTP basic auth via
  `OPENCODE_SERVER_PASSWORD`.
- **`opencode acp`** — ACP (Agent Client Protocol) server over stdin/stdout nd-JSON. This is the
  cleanest machine-to-machine contract for embedding OpenCode as a subagent inside another runtime.
- **`opencode github`**, **`opencode session`** — repository automation and session management for
  pipeline use.

### Kilocode (CLI 1.0)
- **`kilo run --auto "<msg>"`** — autonomous non-interactive mode ([Kilo CLI docs](https://kilo.ai/docs/code-with-ai/platforms/cli/)).
  Behavior: no user interaction; follow-up questions auto-answered with "make the decision
  autonomously"; auto-approval from `permission` config; automatic exit. Exit codes: `0` success,
  `124` timeout, `1` error. CI/CD example shown is literally `kilo run "Implement the new feature" --auto`.
- **`kilo serve`** — headless Kilo server (same OpenCode-derived architecture).
- **`kilo acp`** — ACP server (same protocol as OpenCode).
- **`kilo daemon` / `kilo remote` / `kilo session`** — daemon management and remote session relay.
- **`kilo run` org routing** — for non-interactive/CI, org resolved from `KILO_ORG_ID` env var or a
  persisted `/teams` pick (no `--org` flag).
- **`kilo export <sessionID>` / `kilo import`** — JSON session export/import for handoff between runs.

### Shared config model (Kilo is an OpenCode fork)
- Both read `~/.config/kilo/kilo.json[c]` (Kilo) / OpenCode config schema; `model: "provider/model"`,
  `provider.<id>.options.apiKey = "{env:ANTHROPIC_API_KEY}"`, `mcp`, `permission` (`allow`/`ask`/`deny`,
  pattern-based with wildcard matching, `external_directory` for out-of-tree paths), `instructions`
  (paths to AGENTS.md-style files), `disabled_providers`/`enabled_providers`.
- Env overrides: `OPENCODE_CONFIG_CONTENT` (inline JSON), `OPENCODE_PERMISSION`, `KILO_PROVIDER` /
  `KILO_<FIELD>`. `{env:VAR}` resolves only in **trusted** config (global or env-passed), never in a
  repo-committed project `kilo.json` (security: stops malicious repos from exfiltrating secrets to a
  rogue `baseURL`).

## 2. How Top-Tier Teams Leverage Non-TUI Agents

Three recurring patterns dominate production usage (derived from Claude-Code-headless, Kiro-headless,
and Kilo/OpenCode CI docs and write-ups):

1. **CI/CD gated checks** — run `kilo run --auto` / `opencode run --auto` in GitHub Actions for
   scheduled refactors, PR triage, and pre-merge code review. The `-p`/`--auto` headless flag prints
   to stdout and exits, making it pipeline-native. (Kilo docs: "Autonomous mode allows Kilo Code to
   run in automated environments like CI/CD pipelines"; Kiro/Claude headless guides confirm the same.)
2. **Agentic dev loops** — the agent *is* the runtime: launch backend once (`opencode serve`), then
   `opencode run --attach http://localhost:4096 ...` repeatedly without MCP cold-boot. vivim's own
   `devops`/`vivim-runtime`/`agentic` skills already embody this exact pattern (launch stack, drive
   protocol pipeline, verify).
3. **Subagent orchestration** — route tasks to specialized agents via `opencode agent create` (scoped
   permissions, model, mode `all|primary|subagent`) or the ACP server for embedding. Ralph TUI and
   similar orchestrators wrap `opencode` as a managed subagent with intelligent task routing.

## 3. Capability & Limitation Matrix (Non-TUI)

| Capability | OpenCode | Kilocode | Notes |
|------------|----------|----------|-------|
| One-shot non-interactive prompt | ✅ `run` | ✅ `run --auto` | Both exit with code |
| Headless HTTP server (OpenAPI) | ✅ `serve` | ✅ `serve` | Full CRUD session/message/file/tool API |
| ACP (stdin/stdout nd-JSON) | ✅ `acp` | ✅ `acp` | Best embed contract |
| Auto-approve (no prompts) | ✅ `--auto` | ✅ `--auto` | Permission-gated |
| Attach to warm server | ✅ `--attach` | ✅ (server) | Avoids MCP cold boot |
| JSON event output | ✅ `--format json` | ⚠️ (TUI-derived) | OpenCode explicit |
| SSE event stream | ✅ `/event` | ✅ (serve) | Streaming integration |
| Org/team routing (CI) | n/a | ✅ `KILO_ORG_ID` | Kilo-only Gateway |
| Session export/import | ✅ | ✅ | Handoff |
| Auth (OAuth/MCP) | ✅ | ✅ | `auth login`, MCP OAuth |
| OTEL tracing export | (config) | ✅ `OTEL_EXPORTER_OTLP_*` | Observability |

**Limitations / risks:**
- **Non-interactive follow-up questions are auto-answered blindly** — in autonomous mode the agent is
  told to "decide autonomously." For high-stakes steps you must pre-define permissions to `deny`
  (anything not allowed is blocked, anything allowed runs). Kilo docs: "Operations which are not
  auto-approved will not be allowed."
- **No vision/UI grounding** — non-TUI agents operate on files/shell only; they cannot "see" a browser
  DOM. This is precisely what vivim's CDP/ChromeGovernor layer adds for the web-chat providers.
- **Server is unauthenticated by default** — `OPENCODE_SERVER_PASSWORD` must be set for any networked
  `serve`/`web` exposure.
- **`--continue` cannot combine with a prompt or autonomous mode** — resume vs. fresh are mutually
  exclusive; design pipelines around explicit session IDs instead.
- **Model/provider list is external** — OpenCode fetches from models.dev; offline/custom endpoints
  need provider blocks in config.
- **Headless reliability** — community issues report agent hangs in `serve`+client combos (issue
  anomalyco/opencode#16367). Use `--format json` + timeouts + `124` exit-code checks, and prefer ACP
  or `run` over long-lived `serve` for unattended jobs.

## 4. Wiring into vivim-final (the "provider" question)

vivim's `seeds/providers/manifests.ts` defines providers as **browser UIs** with
`provider_type: 'llm'`, `auth_type: 'browser'`, `capabilities` (send_message, select_model, …), and
`endpoints` carrying CDP `selector`/`composer_type`/`send_method`. The `ProviderRegistrar` seeds these
and ChromeGovernor drives them via CDP (Governor Canon: only ChromeGovernor touches CDP). Kilo/OpenCode
are **not** browser UIs — they are LLM-calling agents. Two integration shapes:

**Shape A — CDP-wrapped UI (treat Kilo/OpenCode like chatgpt/gemini).**
Register a provider manifest for `kilo`/`opencode` whose `endpoints` point at the **web surface**
(`kilo web` / `opencode web`) and drive its composer/send selectors via ChromeGovernor. This reuses
the existing provider pipeline 1:1 but is heavyweight (needs a logged-in browser, defeats the point of
headless) and loses structured JSON output. **Not recommended** for devops automation.

**Shape B — New "local-agent" provider type (recommended).**
Add a `provider_type: 'local-agent'` alongside `'llm'`. Its `capabilities` (send_message,
get_stream_blocks, etc.) are implemented by **shelling out to `kilo run --auto` / `opencode run --auto`**
or POSTing to `opencode serve` `/session/:id/message`, then parsing stdout/JSON into vivim
`ContentBlock[]` (text/reasoning/tool-call) via the existing `StreamParserEngine` contract. This keeps
ChromeGovernor untouched (no CDP), satisfies the Store-Contracts invariant, and lets vivim treat a
Kilo/OpenCode agent as just another cap-store provider — enabling "run unit X via Kilo agent",
subagent fan-out, and headless devops. A thin `LocalAgentProviderExecutor` (new engine, behind a
storage contract) is the only net-new surface.

The distinction is the crux: **do NOT put Kilo/OpenCode in the `chatgpt`/`gemini` CDP bucket** — they
are a different axis of "provider" (agent backend vs. web UI).

## Key Takeaways
- Both tools are fully headless-capable today: `run --auto` for one-shots, `serve`/`acp` for
  programmatic servers, JSON/SSE for machine parsing.
- For devops headless use, prefer `opencode run --auto` / `kilo run --auto` with `--format json` and
  explicit permission `deny` rules; set `OPENCODE_SERVER_PASSWORD` only if exposing `serve` to a network.
- Wiring into vivim = a **new `local-agent` provider type** (Shape B), not a CDP provider entry.
- Non-TUI agents have no DOM vision — pair with vivim's CDP layer only if you specifically want to
  drive *their web UI*; for agentic devops, shell/HTTP is the right seam.

## Sources
1. [Kilo Code CLI docs](https://kilo.ai/docs/code-with-ai/platforms/cli) — install, `kilo run --auto`, `serve`, `acp`, permissions, config
2. [OpenCode CLI docs](https://opencode.ai/docs/cli/) — `run`, `serve`, `acp`, `agent`, flags, env vars
3. [OpenCode Server docs](https://opencode.ai/docs/server/) — OpenAPI 3.1 surface, `/session/:id/message`, `/event`, auth
4. [OpenCode Providers docs](https://opencode.ai/docs/providers/) — provider config, custom models, `/connect`
5. [OpenCode Config docs](https://opencode.ai/docs/config/) — model/provider/mcp/permission schema
6. [Kilo CLI landing](https://kilo.ai/cli) — 500+ models, CI/CD automation
7. [Kilo open-source agentic CLI](https://kilo.ai/open-source-agentic-cli) — "Headless & CI-ready" claim
8. [Claude Code CI/CD headless (analog)](https://hidekazu-konishi.com/entry/claude_code_cicd_and_headless_automation.html) — `-p`/headless pipeline pattern
9. [Kiro headless mode (analog)](https://kiro.dev/blog/introducing-headless-mode/) — `--no-interactive` pipeline pattern
10. [OpenRouter headless agent cookbook](https://openrouter.ai/docs/cookbook/building-agents/create-headless-agent) — headless agent scaffolding for pipelines
11. [How coding agents work (OpenCode internals)](https://cefboud.com/posts/coding-agents-internals-opencode-deepdive/) — agentic loop internals
12. [awesome-cli-coding-agents](https://github.com/bradagi/awesome-cli-coding-agents) — survey of terminal coding agents
13. [OpenCode vs Kilo Code 2026 (MIT, BYOM)](https://www.morphllm.com/comparisons/opencode-vs-kilo-code) — environment, not price
14. [Reddit: OpenCode serve hang issue](https://github.com/anomalyco/opencode/issues/16367) — reliability caveat for `serve`
15. [OpenCode local AI provider setup](https://github.com/groxaxo/opencode-local-setup) — Ollama/vLLM/LM Studio wiring
16. [Ralph TUI OpenCode agent](https://ralph-tui.com/docs/plugins/agents/opencode) — subagent orchestration wrapper
17. [OpenCode custom provider setup](https://haimaker.ai/blog/opencode-custom-provider-setup/) — custom OpenAI-compatible API pattern
18. vivim-final `seeds/providers/manifests.ts` — local provider schema (provider_type 'llm', CDP endpoints)

## Methodology
Searched 9 web queries across web + docs (Kilo CLI, OpenCode CLI/Server/Providers/Config, headless
CI analogs, internals, orchestration). Deep-read 5 primary sources (Kilo CLI, OpenCode CLI, OpenCode
Server, OpenCode Config, vivim provider manifests). Cross-referenced the "provider" semantics mismatch
between the two systems as the central finding.
