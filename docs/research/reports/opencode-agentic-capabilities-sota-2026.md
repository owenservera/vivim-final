# OpenCode Agentic Dev Loops & Subagent Orchestration — Capability Inventory for vivim-final

*Generated: 2026-07-19 | Sources: OpenCode official docs (agents, tools, cli, server, config) + vivim-final source | Confidence: High*

This artifact extracts the **full official OpenCode capability surface** for agentic dev loops and
subagent orchestration, then maps each capability to a concrete home in vivim-final's existing
engine/contract layout (sourced from `src/engines/*`). The integration shape is **Shape B
(`local-agent` provider type)** from `non-tui-kilocode-opencode-brief.md` — no CDP, ChromeGovernor
untouched.

## 0. Source map (vivim engines referenced below)

| vivim engine / contract | File | Role |
|---|---|---|
| `UnifiedCapabilityRegistry` | `src/engines/unified-registry.ts` | Single registry; every cap defined once, exported to cli/ui/workflow/mcp/api |
| `CapabilityResolutionEngine` | `src/engines/capability-resolution.ts` | Resolves which capability runs for a request |
| `CapabilityComposer` | `src/engines/capability-composer.ts` | Composite (multi-step) capabilities |
| `ConversationManager` | `src/engines/conversation-manager.ts` | Per-conversation send/capture; `captureAsNode()` |
| `ProviderRegistrar` | `src/engines/provider-registrar.ts` | Seeds providers into DB |
| `StreamParserEngine` | `src/engines/stream-parser.ts` | Parses agent output → `ContentBlock[]` (DB-only parser logic) |
| `CapabilityEventBus` | `src/engines/capability-event-bus.ts` | Pub/sub for capability lifecycle events |
| `CommandPatternRegistry` (NLCL) | `src/engines/nlcl/command-registry.ts` | NL phrase → capability binding |
| `ChromeGovernor` | `src/engines/chrome-governor.ts` | CDP-only (NOT used by local-agent) |

## 0.1 TESTED TRUTH — verified on this host (2026-07-19)

Commands were actually executed on the dev machine (Windows, `opencode` installed via bun,
Node v24). Results override any assumption in the official docs.

**Install confirmed:** `opencode` resolves on PATH (`C:\Users\VIVIM.inc\.bun\bin\opencode.cmd`);
`kilo` also present. No API key required for Zen free models.

**Zen free models actually run (zero key, cost: 0, `--format json` valid):**

| Model ID | Test | Result |
|---|---|---|
| `opencode/deepseek-v4-flash-free` | `run --auto --model … "PONG"` | ✅ exit 0, ~43s, returned `PONG`, `cost:0` |
| `opencode/hy3-free` (Tencent) | `run --auto --model … "OK"` | ✅ exit 0, ~54s, returned `OK` |
| `opencode/mimo-v2.5-free` | `run --auto --model … "OK"` | ✅ exit 0, ~41s, returned `OK` |
| `opencode/north-mini-code-free` | `run --auto --model … "OK"` | ✅ exit 0, ~37s, returned `OK` |
| `opencode/nemotron-3-ultra-free` | `run --auto … "OK"` | ❌ no text in 5 min — **unusable (too slow/queued)** |

**Decision:** For now use **only these four Zen free models** —
`deepseek-v4-flash-free`, `hy3-free`, `mimo-v2.5-free`, `north-mini-code-free`.

**Verified JSON shape** (`--format json`), directly parseable to `ContentBlock[]`:
```json
{"type":"text","part":{"type":"text","text":"PONG",
 "time":{"start":1784413182629,"end":1784413182639}},
 "tokens":{"total":68608,"input":68591,"output":3,"reasoning":14,"cost":0}}
```
`step_start` / `text` / `step_finish` event stream — same contract the impl doc's
`LocalAgentProviderExecutor.parse()` consumes via `StreamParserEngine`.

**`serve` verified to start** (`opencode server listening on http://127.0.0.1:4097`) but logs
`OPENCODE_SERVER_PASSWORD is not set; server is unsecured.` → the auth guardrail in the impl doc is
real; always set `OPENCODE_SERVER_PASSWORD` for any networked serve. (Health probe raced startup in
test; use `--attach` or a longer readiness wait, not a bare 5s GET.)

## 1. OpenCode capability inventory (official)

### 1.1 Agent topology
| Capability | OpenCode mechanism | vivim home |
|---|---|---|
| Primary agents (Build/Plan) | `mode: primary`, Tab to cycle | `LocalAgentProviderExecutor` agent variants seeded as `UnifiedCapability` |
| Subagents (General/Explore/Scout) | `mode: subagent`, `@`-mention, Task tool | Subagent fan-out capability → `CapabilityComposer` DAG |
| Hidden internal subagents | `hidden: true` (programmatic only) | `tags:['internal']` on the capability |
| `mode: all` | usable as both primary + subagent | single capability, `surfaces` includes all |

### 1.2 Subagent orchestration (the loop primitive)
| Capability | OpenCode mechanism | vivim home |
|---|---|---|
| Invoke subagent via Task tool | `permission.task` glob allow/deny; Task tool spawns child session | `capability-composer` node that shells `opencode run --agent <sub>` |
| `@`-mention dispatch | manual invoke in message | NLCL `command-registry` pattern `@<agent>` |
| Child sessions + navigation | `session_child_first/cycle/parent` keys | `ConversationManager` fork-linking (`responds_to` edge) |
| Task permissions scoping | `permission.task: { "*": "deny", "code-reviewer": "ask" }` | per-capability `requiresConfirmation` + `permission` map |
| Background subagents (experimental) | `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS` | async `UnifiedCapability.isAsync` + `CapabilityEventBus` |

### 1.3 Non-interactive / headless execution (dev loops)
| Capability | OpenCode mechanism | vivim home |
|---|---|---|
| One-shot prompt | `opencode run "<msg>"` | `local-agent` capability handler |
| Auto-approve | `--auto` | `permission` config passed to executor |
| JSON events | `--format json` | parse to `ContentBlock[]` via `StreamParserEngine` |
| Attach to warm server | `run --attach http://localhost:4096` | reuse a `serve` instance per devops loop |
| Async message | `POST /session/:id/prompt_async` (204) | fire-and-forget capability |
| Session fork/resume | `--fork`, `/session/:id/fork` | `ConversationManager` fork |
| Exit codes | `0`/`124`(timeout)/`1` | executor maps to vivim `Result` |

### 1.4 Headless HTTP server (programmatic control)
| Capability | OpenCode HTTP API | vivim home |
|---|---|---|
| Create session | `POST /session` | `conversation-manager` create |
| Send (blocking) | `POST /session/:id/message` | capability handler |
| Send (async) | `POST /session/:id/prompt_async` | async capability |
| Slash command | `POST /session/:id/command` | capability → `command-registry` |
| Shell exec | `POST /session/:id/shell` | `bash` tool capability |
| Read file | `GET /file/content?path=` | `read` tool capability |
| Grep/Find | `GET /find`, `GET /find/file`, `GET /find/symbol` | `grep`/`glob` tool capability |
| SSE events | `GET /event` | `CapabilityEventBus` bridge |
| Tool schemas | `GET /experimental/tool/ids`, `/experimental/tool` | capability introspection |
| MCP add | `POST /mcp` | MCP bridge capability |
| Auth set | `PUT /auth/:id` | credential capability |
| Health | `GET /global/health` | liveness probe |

### 1.5 Agent configuration axes (per-agent)
| Axis | OpenCode key | vivim mapping |
|---|---|---|
| System prompt | `prompt: "{file:...}"` | `UnifiedCapability.description` + seeded prompt |
| Model | `model: "provider/model"` | `provider` field on capability ctx |
| Temperature | `temperature` | passed to executor env/flag |
| Top-p | `top_p` | passed through |
| Max steps | `steps` | `CapabilityContext.metadata.maxSteps` → executor `--max-steps` |
| Permission | `permission` (allow/ask/deny + glob) | `requiresConfirmation` + permission map |
| Mode | `mode: primary|subagent|all` | `surfaces` |
| Hidden | `hidden: true` | `tags:['internal']` |
| Task scope | `permission.task` | capability allow-list |
| Color | `color` | UI slot styling |
| Pass-through model opts | arbitrary keys | executor extra flags |

### 1.6 Tool surface (what agents can do)
`bash`, `edit`, `write`, `read`, `grep`, `glob`, `lsp`, `patch`, `skill`, `todowrite`,
`todoread`, `webfetch`, `websearch`, `question`, `task`, `external_directory`, `doom_loop`.
Each maps to a `UnifiedCapability` with `tags:['agent-tool']`. Note `question` is auto-answered in
`--auto` mode ("make the decision autonomously") — see limitations.

## 2. Full capability list we can bring into vivim-final

Grouped by integration class. Each is real, derivable from the official docs above.

**A. Local-agent execution (Shape B core)**
1. `agent.run` — one-shot `kilo/opencode run --auto` → `ContentBlock[]`
2. `agent.run.json` — OpenCode `--format json` structured parse
3. `agent.run.attach` — attach to warm `serve` (skip MCP cold boot)
4. `agent.run.async` — `prompt_async` fire-and-forget
5. `agent.serve.start` — launch `opencode serve` as a managed dev-loop backend
6. `agent.serve.health` — `GET /global/health` liveness
7. `agent.session.create` — `POST /session`
8. `agent.session.fork` — fork at message
9. `agent.session.delete` — `DELETE /session/:id`

**B. Subagent orchestration**
10. `agent.subagent.invoke` — Task-tool spawn (child session)
11. `agent.subagent.mention` — `@<agent>` dispatch (NLCL pattern)
12. `agent.subagent.background` — `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS`
13. `agent.orchestrate` — multi-subagent DAG via `CapabilityComposer`
14. `agent.task.scope` — `permission.task` allow/deny lists

**C. Agent configuration as capabilities**
15. `agent.define` — seed an OpenCode agent (markdown/JSON) as a vivim capability
16. `agent.pick.model` — per-agent `model` override
17. `agent.pick.temperature` / `top_p` — sampling control
18. `agent.limit.steps` — `steps` cap → cost control
19. `agent.restrict.permissions` — per-agent allow/ask/deny + glob
20. `agent.hide` — `hidden:true` internal subagent

**D. Tool-surface bridge (agent tools → vivim capabilities)**
21. `tool.bash`, `tool.edit`, `tool.write`, `tool.read`, `tool.grep`, `tool.glob`,
    `tool.lsp`, `tool.patch`, `tool.skill`, `tool.todowrite`, `tool.webfetch`,
    `tool.websearch`, `tool.question`, `tool.task`, `tool.external_directory`,
    `tool.doom_loop` — 17 tool capabilities, each gated by `permission`.

**E. HTTP/server bridge**
22. `server.command` — `POST /session/:id/command`
23. `server.shell` — `POST /session/:id/shell`
24. `server.file.read` — `GET /file/content`
25. `server.find` / `server.find.file` / `server.find.symbol` — search
26. `server.event.stream` — `GET /event` → `CapabilityEventBus`
27. `server.mcp.add` — `POST /mcp`
28. `server.auth.set` — `PUT /auth/:id`

**F. Observability / handoff**
29. `agent.session.export` / `import` — JSON handoff
30. `agent.stats` — token/cost stats
31. `agent.otlp` — OTEL export bridge

That is **31 distinct capabilities** across 6 classes, all backed by official OpenCode APIs.

## 3. Limitations carried into vivim (must encode)
- `question` tool is auto-answered in `--auto` → never rely on it for input; pre-define permissions.
- `serve` can hang (community issue) → prefer `run` for unattended; client timeout + `124` check.
- `serve` unauthenticated unless `OPENCODE_SERVER_PASSWORD` set → bind localhost, require password.
- `--continue` mutually exclusive with prompt/`--auto` → use explicit session IDs.
- Non-TUI: no DOM vision → do NOT route browser-grounded work here; that stays ChromeGovernor.
- `{env:VAR}` only resolves in trusted config (global / env-passed), never committed project config.

## 4. Confidence & sources
All capabilities above trace to: OpenCode `docs/agents/`, `docs/tools/`, `docs/cli/`, `docs/server/`,
`docs/config/` (official, fetched 2026-07-19) and vivim `src/engines/*` (local source). Convergence:
CONFIRMED (Shape B). No conflicting guidance on the integration seam.
