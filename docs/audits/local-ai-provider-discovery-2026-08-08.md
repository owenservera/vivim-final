# Local AI Provider Design + opencode — Discovery Audit — 2026-08-08

Scope: code-only discovery of the local-AI provider design generally (offline LLM /
airgap / embeddings / intent resolution) and of the **opencode** provider specifically —
the only local-agent provider in the system. Trust only source code. Assumption stated
up front: skills/docs/devops scripts are stale until read; every claim below was verified
against actual source (file:line references included).

---

## 1. Verdict (TL;DR)

| Dimension | Status |
|---|---|
| General local-AI design | ✅ Coherent: `resolvePlanner` offline-first, LocalModelAdapter (Ollama/llama.cpp/none), AirGapEngine, OllamaEmbeddingProvider, LocalLLMResolver |
| opencode = only local-agent provider | ✅ `provider_type: 'local-agent'` — the sole entry in the provider catalog |
| opencode has TWO transport layers | ✅ 1) one-shot CLI (NDJSON, v1.17.15) via `LocalAgentProviderExecutor`; 2) `serve` HTTP/SSE supervisor (v1.18.4) via `src/engines/opencode/*` — both reuse `parseOpencodeJson` |
| Cross-surface parity | ⚠️ CLI ✅ (bridged) · API ✅ (universal + 4 `/api/opencode/*` routes) · NLCL ✅ (3 patterns) · MCP ⚠️ (via `mcpToolName` only; `nl_command` tool never wired) · UI ❌ (no frontend/src reference to opencode at all) |
| Security posture | ✅ Loopback-only, password-gated, off by default, `tier > 3` auto-deny |
| Manifest ↔ seed divergence | ⚠️ Manifest opencode `models[]` (qwen3.5-3b-free…) ≠ seeded `LOCAL_AGENT_FREE_MODELS` (deepseek-v4-flash-free…) — two different model lists for the same provider |
| Dead code / gaps | ⚠️ `registerNLCLTools`+`nl_command` never registered; `OpenCodePermissionDeniedError` never thrown; `/api/opencode/sessions` returns hardcoded `[]`; opencode manifest models unreachable via `isModelAllowed` |
| Env hygiene | ⚠️ `.env` has OPENCODE_* vars, `.env.example` has none |

The local-AI layer is **operationally sound and self-consistent**, but the opencode
surface story is **half-wired**: backend + CLI + NLCL are complete, while UI, MCP
NLCL tooling, and session listing are stubs or absent.

---

## 2. General Local-AI Provider Design

### 2.1 Offline-first planner resolution
`src/engines/autonomous-execution.ts:1293` — `resolvePlanner(goal, {airgap, consented})`:
- no `llmProvider` override **or** `'local'` → `{provider:'local', local:true}` — always allowed.
- any other (cloud) provider → throws `ConsentViolationError` unless `consented`.
- `AirGapEngine` is instantiated with `airgap = true` default (`autonomous-execution.ts:74`, Unit 36.2 offline-first).

### 2.2 Local model adapter
`src/engines/local-model-adapter.ts` — `LocalModelAdapter` for `'ollama' | 'llamacpp' | 'none'`.
- `/api/tags` availability check (Ollama), `/api/generate` for completion.
- `generate()` + `complete()` alias (used by `IntentDecomposer`).

### 2.3 Air-gap engine
`src/engines/airgap.ts` — `AirGapEngine` (`enable`/`disable`/`getStatus`):
- DNS probe to `dns.google` to detect connectivity.
- `/api/tags`, `/api/generate` calls, response cache `Map`, `localModelName`.

### 2.4 Embeddings
`src/engines/embedding-ollama.ts` — `OllamaEmbeddingProvider`:
- endpoint `http://localhost:11434`, model `nomic-embed-text` (768-d), `/api/embeddings`, 120s timeout.

### 2.5 NLCL intent resolver (local-LLM option)
`src/engines/nlcl/intent-resolver.ts`:
- `DeterministicResolver` (default, zero AI) + `LocalLLMResolver` (`name:'local-llm'`, `LocalLLMAdapter` interface with `complete(prompt,opts)`, `minConfidence 0.5`) — supports Ollama/llama.cpp/LM Studio.

### 2.6 Framing / transport
- `src/framing/schemas.ts` — `transport` enum `['webapp','api','local']`.
- `src/framing/adapter.ts` — `localModelArgs` for the `'local'` transport.

### 2.7 Local-agent store (DB layer)
- Contract: `src/storage/contracts/local-agent-store.ts` — `getAgentProvider`, `getAgentConfig`, `upsertAgentProvider`, `isModelAllowed`; `LocalAgentConfig {binary, timeoutMs, allowedModels, defaultModel}`.
- Impl: `src/storage/impl/local-agent-store-impl.ts` — Prisma tables `provider_definition` / `provider_model` / `provider_config`; `DEFAULT_TIMEOUT_MS = 120_000`; config rows `binary`, `timeout_ms`, `allowed_models`, `default_model`.

---

## 3. The opencode Provider (the only one added)

### 3.1 Provider catalog identity
- `seeds/providers/manifests.ts:972-998` — `slug:'opencode'`, `display_name:'OpenCode Local Agent'`, `provider_type:'local-agent'` (only one in the catalog), `auth_type:'none'`, `capabilities:['agent_run']`, `accessTier:'premium'`, endpoint `opencode://local` (`endpoint_type:api`, `composer_type:textarea`, `send_method:'both'`).
- Generated static protocol: `src/__generated__/provider-protocol.ts:725-783` — `config.allowed_models` = the 4 verified free models, `run_mode:'one-shot'`, `transport:'opencode-cli'`, `timeout_ms:'180000'`.
- ⚠️ **Divergence:** the manifest `models[]` (qwen3.5-3b-free, glm4.5-air-free, deepseek-v3.2-free, grok4-fast-free — `manifests.ts:999-1033`) does **not** match the seeded `LOCAL_AGENT_FREE_MODELS` (deepseek-v4-flash-free, hy3-free, mimo-v2.5-free, north-mini-code-free — `src/engines/capability-bootstrap/seed.ts:12-17`). The manifest list is unreachable: `isModelAllowed` reads `provider_model` rows seeded from `LOCAL_AGENT_FREE_MODELS`, so the 4 manifest models would be rejected by the executor. Stale/aspirational manifest data.

### 3.2 One-shot CLI layer (v1.17.15)
`src/engines/local-agent/local-agent-executor.ts`:
- `LOCAL_AGENT_SLUG = 'opencode'` (line 15).
- `parseOpencodeJson(raw)` (lines 85-183) — the **single source of truth** NDJSON grammar: `--format json` lines each carry top-level `type`; content in `part.text`/`part.type`. Verified: `step_start`, `reasoning`, `tool_use` (with `part.tool === 'invalid'` ⇒ silent permission denial), `text`, `step_finish` (tokens/cost), `error`. Returns `{blocks, cost, tokens, sessionId, permissionDenied}` → `ContentBlock[]`.
- `LocalAgentProviderExecutor.run()` (lines 194-300) — `opencode run --auto --model <m> --format json [--session <id>] <prompt>`; resume via `-s/--session` (NOT `--continue`); race against `config.timeoutMs` (seeded 180_000); `exitCode !== 0` + stderr ⇒ pushes `AGENT_FAILED` block; emits `capability:executed`/`capability:failed` on `CapabilityEventBus`.
- `cap:agent:run` (`src/engines/capability-bootstrap/default.ts:634-692`) — guarded by `services.localAgentExecutor`; runs the executor; `apiEndpoint` declares `POST /api/agent/run` (**no live route — see §5 finding F1**).

### 3.3 `serve` supervisor layer (v1.18.4, feature 027) — 5 files
`src/engines/opencode/`:
- **types.ts** — `OpencodeEvent` (v1.18.4 namespaced `properties` wrapper + v1.17.15 flat compat), `textDeltaFromEvent`, `isSessionDone` (`session.idle`/`session.status.idle`/`step_finish`/`done`), `riskTierForTool` (regex → tier 1-5: read=1, write/edit=2, default=3, bash/exec=4, delete/format=5), `autoDenyTier` (tier>3 ⇒ deny).
- **opencode-supervisor.ts** — `OpenCodeSupervisor`: `Bun.spawn('opencode serve --port <p> --hostname 127.0.0.1')`, password required (`OPENCODE_SERVE_NO_PASSWORD`), 90s readiness via `GET /doc` with Basic auth, `MAX_RESTARTS=5` + exponential backoff (500ms base), stdout/stderr drained (Windows pipe-buffer fix), port auto-pick via `Bun.serve(port:0)` probe. Never `--mdns`/`--cors *`.
- **opencode-client.ts** — `OpenCodeClient` base `http://127.0.0.1:<port>`; `modelRefFromSlug` splits `prov/model` → `{id, providerID}` (v1.18.4 `POST /session` wants object, not slug); `POST /session`; `POST /session/:id/prompt_async` with `parts:[{type:'text',text}]`; `POST /session/:id/message` (blocking); `GET /event?session=` SSE subscribe (frame → `parseOpencodeJson`); `POST /session/:id/permissions/:pid`; `GET /session/:id/diff`.
- **opencode-executor.ts** — `OpenCodeExecutor id='opencode'` (NLCL): `opencode.send` / `session.create` / `session.list` / `permission.respond`; `SEND_TIMEOUT_MS=120_000`; collects SSE text deltas into blocks until `isSessionDone`.
- **opencode-ingest.ts** — `OpenCodeIngest`: projects events → `AgentSession`/`AgentPermissionDecision`/`AgentFileEdit` + hash-chained `EventRecord` (`source:'opencode'`); v1.18.4 `message.part.delta` accumulates per `partID` in `textByPart`, flushed on `session.idle`; in-process permission rule (`riskTierForTool` + `autoDenyTier`, injectable `assessPermission`); `seen` Set dedupe.
- Wired (env-gated) in `src/server/bootstrap/phases/capabilities.ts:349-377` → `globalThis.__opencodeServe = {supervisor, client, ingest}`; NLCLEngine receives the pair in `src/server/bootstrap/phases/lifecycle.ts`, and `src/engines/nlcl/nlcl-engine.ts:663-670` pushes `OpenCodeExecutor` only when both deps exist.
- `OpenCodeServeError` (`src/errors.ts:133-138`) — codes `OPENCODE_SERVE_DISABLED`, `OPENCODE_SERVE_NO_PASSWORD`, `OPENCODE_SERVE_NO_PORT`, `OPENCODE_SERVE_NOT_READY`, `OPENCODE_HTTP`, `OPENCODE_NO_SESSION_ID`, `OPENCODE_NO_STREAM`.

### 3.4 Capabilities (feature 029, env-gated)
`src/engines/capability-bootstrap/default.ts:700-859` — `cap:opencode:send`, `cap:opencode:session.create`, `cap:opencode:session.list`, `cap:opencode:permission.respond`. All `category:'agent'`, all `surfaces` default `ALL_SURFACES` (cli, ui, workflow, mcp, api — `src/engines/capability-bootstrap/types.ts:34`). Handlers read `globalThis.__opencodeServe` lazily; return `{ok:false, error:'OpenCode serve not enabled'}` when absent.

### 3.5 NLCL patterns
`src/engines/nlcl/categories/opencode.ts` — 3 patterns (priorities 16/15/14 for `opencode.send`; 12/12 for `session.create`/`session.list`), aliases, `executor:'opencode'`, `category:'agent'`, bound `capabilityId`s. Catalog imports them at `src/engines/nlcl/catalog.ts:20,46`. **No NLCL pattern for `opencode.permission.respond`** (capability exists, NLCL surface missing for it).

### 3.6 HTTP routes
`src/server/index.ts:706-773` (`handleOpenCodeRoutes`) + dispatch `:851-862`:
- `POST /api/opencode/send` — create session if missing → `ingest.start` → `client.sendPrompt`. Returns `{ok, sessionId, text:'Prompt sent to session…'}` (does NOT block for completion — fire-and-forget).
- `POST /api/opencode/session` — create → `{ok, sessionId}`.
- `GET /api/opencode/sessions` — **hardcoded** `{ok:true, sessions:[], text:'Session listing requires the ingest layer.'}`.
- `POST /api/opencode/permission/:id` — `allow | deny | allow_always`.
- Route guard requires `globalThis.__opencodeServe`; otherwise 503 `'OpenCode serve not enabled'`. Behind `auth(req)` (line 837) — authed surface.

### 3.7 Env config
`src/config.ts:312-316`:
- `opencodeServeEnabled` (`OPENCODE_SERVE_ENABLED==='1'`), `opencodeServePort` (`OPENCODE_SERVE_PORT`), `opencodeServerPassword` (`OPENCODE_SERVER_PASSWORD`), `opencodeServerUsername` (`OPENCODE_SERVER_USERNAME` default `'opencode'`).
- Live `.env`: `OPENCODE_SERVE_ENABLED=1`, `OPENCODE_SERVER_PASSWORD=opencode-test-pw` → supervisor active with a **test** password. `.env.example`: **no OPENCODE_* entries** — a fresh clone won't know the feature exists.

---

## 4. Cross-Surface Reachability Matrix

| Surface | cap:agent:run | cap:opencode:send | cap:opencode:session.* | cap:opencode:permission |
|---|---|---|---|---|
| CLI (bridged, `src/cli/commands/registry-bridge.ts`) | `agent run` / `ar` | `opencode send` / `os` | `opencode session create` / `osc`, `opencode session list` / `osl` | `opencode permission` / `op` |
| API (direct route) | ❌ `/api/agent/run` not routed (F1) | ✅ `/api/opencode/send` | ✅ `/api/opencode/session`, `/sessions` (stub) | ✅ `/api/opencode/permission/:id` |
| API (universal) | ✅ `/api/capabilities/cap:agent:run/execute` | ✅ `/api/capabilities/cap:opencode:send/execute` | ✅ | ✅ |
| NLCL | via executor chain | ✅ 3 patterns | ✅ 2 patterns | ❌ no pattern |
| MCP (`McpServerAdapter.exportForMcp`, `src/engines/mcp-server-adapter.ts:144,240`) | ✅ tool `agent_run` | ✅ tool `opencode_send` | ✅ tools `opencode_session_create`/`_list` | ✅ tool `opencode_permission_respond` |
| UI (frontend/src) | ❌ no reference anywhere | ❌ | ❌ | ❌ |

- `makeCapability` defaults `surfaces` to `ALL_SURFACES` (`types.ts:34,48`); `UnifiedCapabilityRegistry.validateCapability` (`src/engines/unified-registry.ts:59-70`) forces presence of `cliCommand`/`mcpToolName`/`apiEndpoint`/`ui` per surface — all opencode caps satisfy it.

---

## 5. Findings

- **F1 (dead route).** `cap:agent:run` declares `apiEndpoint POST /api/agent/run` (`default.ts:664`) but `src/server/index.ts` only routes `/api/agent/canvas/*` (line 886). The declared endpoint is unreachable as HTTP; the capability still runs via universal execute / CLI / NLCL / MCP. The registry validates the `api` surface by checking `apiEndpoint` **exists**, not that a route serves it — so this never surfaces an error.
- **F2 (MCP NLCL dead code).** `src/mcp/nlcl-tools.ts` defines `registerNLCLTools` + `nl_command` tool, but no code in `src/` ever calls it. opencode is MCP-reachable only through `McpServerAdapter`'s `mcpToolName` mapping, not the intended NLCL tool.
- **F3 (unused error).** `OpenCodePermissionDeniedError` (`src/errors.ts:140-148`) is defined but never thrown. The ingest path records denials as rows + `client.respondPermission`, and the CLI layer sets `permissionDenied` on the result — neither raises this error type.
- **F4 (session-list stub).** Three implementations return hardcoded `[]`/stub text: capability handler (`default.ts:816-820`), executor (`opencode-executor.ts:151-166`), HTTP route (`index.ts:746-748`). No `opencode serve` session-list API is called.
- **F5 (manifest ↔ seed model divergence).** See §3.1. Manifest `models[]` (qwen3.5-3b-free etc.) is not what `isModelAllowed` enforces (deepseek-v4-flash-free etc.). The two lists also disagree on the default (`qwen3.5-3b-free` in manifest vs `deepseek-v4-flash-free` in seed).
- **F6 (UI surface absent).** All opencode/agent caps declare `ui` blocks (`text_input`, `action-button`, `composer`/`sidebar` positions) but `frontend/src` has **zero** references to `opencode` or `agent_run` — the UI surface is declared, never rendered.
- **F7 (env hygiene).** `.env` enables serve with test password; `.env.example` documents neither the feature nor the vars.
- **F8 (timeout skew).** `LocalAgentStoreImpl.DEFAULT_TIMEOUT_MS = 120_000` vs seeded `timeout_ms = 180_000` (`seed.ts:34`) vs `OpenCodeExecutor.SEND_TIMEOUT_MS = 120_000`. Executor timeout (serve path) is 2 min while the CLI config allows 3 min — inconsistent worst-case expectations.

---

## 6. Tests

- `tests/unit/engines/local-agent.test.ts` — NDJSON fixture (verified v1.17.15 transcript), `parseOpencodeJson` text/cost/sessionId, tool→tool-call+result mapping, `tool:'invalid'` ⇒ `PERMISSION_DENIED`.
- `tests/unit/engines/opencode-client.test.ts` — `parseOpencodeJson` reuse for serve SSE frames; risk-tier mapping.
- `tests/integration/opencode/{ingest,permission,supervisor}.test.ts` — ingest projection + thread render (S1/S2), Governor tier>3 auto-deny (S2b), supervisor lifecycle (S3).
- No frontend tests reference opencode; no test covers `/api/opencode/*` HTTP routes end-to-end.

---

## 7. Key File Index

| File | Role |
|---|---|
| `src/engines/local-agent/local-agent-executor.ts` | CLI one-shot executor + `parseOpencodeJson` (grammar source of truth) + `LOCAL_AGENT_SLUG` |
| `src/engines/opencode/{types,opencode-supervisor,opencode-client,opencode-executor,opencode-ingest}.ts` | `serve` supervisor/client/executor/ingest (feature 027) |
| `seeds/providers/manifests.ts:972-1033` | opencode provider manifest |
| `src/engines/capability-bootstrap/{seed,default}.ts` | `LOCAL_AGENT_FREE_MODELS`, `seedLocalAgentProvider`, cap:agent:run + cap:opencode:* |
| `src/server/index.ts:706-773, 851-862` | `/api/opencode/*` routes + dispatch |
| `src/server/bootstrap/phases/{capabilities,lifecycle}.ts` | env-gated serve wiring, `globalThis.__opencodeServe`, NLCL executor injection |
| `src/engines/nlcl/{categories/opencode.ts,nlcl-engine.ts:663-670}` | NLCL patterns + executor registration |
| `src/config.ts:312-316` | OPENCODE_* env keys |
| `src/storage/{contracts,impl}/local-agent-store.ts` + `agentic-store.ts` + `event-record-store.ts` | landing tables / contracts |
| `src/errors.ts:133-148` | `OpenCodeServeError`, `OpenCodePermissionDeniedError` |
| `src/engines/{local-model-adapter,airgap,embedding-ollama}.ts` + `nlcl/intent-resolver.ts` + `autonomous-execution.ts:1293` | general local-AI design |
