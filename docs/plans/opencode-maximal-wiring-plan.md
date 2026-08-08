# opencode Provider — Maximal Wiring Plan (1100%)

Goal: make the opencode local-agent provider *fully capable and fully wired* across
every surface (CLI, API, NLCL, MCP, UI, workflow) and close every gap surfaced in
`docs/audits/local-ai-provider-discovery-2026-08-08.md` (findings F1–F8).

Preamble (same rule as the audit): trust only code. Every task below names the exact
file:line that must change and an acceptance criterion that is checkable in the source.

---

## Phase 0 — Close the audit findings (F1–F8)

### T0.1 — F1: live `/api/agent/run` route
- `src/server/index.ts` — add `POST /api/agent/run` handler next to the `/api/opencode/*`
  block (~line 851). Reads `globalThis`-exposed local-agent executor (mirror the
  `__opencodeServe` pattern), body `{prompt, model?, sessionId?, cwd?}`, returns the
  `AgentRunResult` shape (`ok`, `blocks`, `model`, `sessionId`, `cost`, `tokens`,
  `timedOut`, `permissionDenied`).
- Acceptance: `curl -X POST localhost:9420/api/agent/run -d '{"prompt":"hi"}'` returns 200.

### T0.2 — F2: wire `nl_command` MCP tool
- `src/engines/mcp-server-adapter.ts` — inject `NLCLEngine` (optional dep) and register the
  `nl_command` tool from `src/mcp/nlcl-tools.ts` (or call `registerNLCLTools`).
- Acceptance: `McpServerAdapter.getTools()` includes `nl_command`; calling it reaches
  `opencode.send`.

### T0.3 — F3: use or delete `OpenCodePermissionDeniedError`
- Decision: promote it to the real denial path. `opencode-ingest.ts` `ingestPermission`
  (tier > 3) should `throw`/surface the error object so callers can inspect `{tool, tier}`,
  OR remove the class. Prefer: ingest still auto-denies (current behavior) but `cap:opencode:send`
  surfaces `permissionDenied: true` + the error code on output.
- Acceptance: after a tier-5 tool denial, the send output contains the permission info.

### T0.4 — F4: real session listing
- Three stubs today (`default.ts:816`, `opencode-executor.ts:151`, `index.ts:746`).
- Add `OpenCodeClient.listSessions()` (probe `opencode serve` — check `/session` GET or
  expose via ingest's in-memory `threadBySession` map) and surface it through all three.
- Minimum viable: return sessions tracked by `OpenCodeIngest.threadBySession` (ids +
  conversationId + createdAt). Capability `cap:opencode:session.list` becomes truthful.
- Acceptance: after `session.create`, `opencode session list` shows ≥1 session.

### T0.5 — F5: reconcile manifest ↔ seed models
- `seeds/providers/manifests.ts:999-1033` opencode `models[]` (qwen3.5-3b-free,
  glm4.5-air-free, deepseek-v3.2-free, grok4-fast-free) does NOT match
  `LOCAL_AGENT_FREE_MODELS` (deepseek-v4-flash-free, hy3-free, mimo-v2.5-free,
  north-mini-code-free) which `isModelAllowed` enforces.
- Fix: make the manifest the single source of truth and have
  `src/engines/capability-bootstrap/seed.ts` derive `LOCAL_AGENT_FREE_MODELS` from it
  (or vice-versa — pick manifest, since the protocol generator reads it). Regenerate
  `provider-protocol.ts` + `provider-protocol.dev.ts` (`bun run gen:protocol`).
- Acceptance: manifest models == seeded models == generated `config.allowed_models`.

### T0.6 — F6: wire the UI surface
- `frontend/src` currently has zero opencode/agent_run references. Add:
  - Provider row in the provider/health surfaces (reads provider-protocol or `/api/capabilities`).
  - Composer action for `agent_run` / `opencode_send` (`text_input` ui block, position
    `composer`) → `POST /api/agent/run` or universal execute route.
  - Sidebar actions for `opencode_session_create` / `_list` / `opencode_permission_respond`
    (`action-button`, position `sidebar`).
- Follow the FRONTEND = BACKEND rule: render from capability registry, no `if (slug==='x')`.
- Acceptance: capability catalog shows the 5 opencode/agent caps; composer button runs a
  one-shot agent task and renders blocks.

### T0.7 — F7: env hygiene
- Add to `.env.example`: `OPENCODE_SERVE_ENABLED`, `OPENCODE_SERVE_PORT`,
  `OPENCODE_SERVER_PASSWORD`, `OPENCODE_SERVER_USERNAME` with comments (off by default,
  loopback-only, password required). Remove `opencode-test-pw` from live `.env` → real secret.
- Acceptance: `.env.example` documents every OPENCODE_* key read in `src/config.ts:312-316`.

### T0.8 — F8: timeout reconciliation
- Pick a single policy: `SEND_TIMEOUT_MS` (executor, 120s) should equal or exceed the CLI
  config `timeout_ms` (seeded 180s) so a serve send can never be cut short before the CLI
  one-shot would be. Bump `OpenCodeExecutor.SEND_TIMEOUT_MS` to 180s and document the invariant
  in both files.
- Acceptance: constants satisfy `SEND_TIMEOUT_MS >= config.timeoutMs`.

---

## Phase 1 — Capability expansion (beyond the audit)

### T1.1 — `cap:opencode:session.diff`
- `OpenCodeClient.getDiff` (`opencode-client.ts:207`) exists but no capability uses it.
  Add `cap:opencode:session.diff` (POST, input `{sessionId}`) returning the RFC-6902 patch.
- Wire CLI `opencode session diff`, NLCL pattern, MCP tool `opencode_session_diff`,
  apiEndpoint `POST /api/opencode/diff`, UI `action-button`.

### T1.2 — `cap:opencode:session.cancel`
- Client has AbortControllers (`controllers` map). Add `cancel(sessionId)` → abort + POST
  cancel (check `opencode serve` cancel endpoint). Capability + CLI (`opencode stop`) + MCP
  tool + apiEndpoint `/api/opencode/cancel`.

### T1.3 — `cap:opencode:models` / model listing
- Surface `LOCAL_AGENT_FREE_MODELS` + `LocalAgentStore.isModelAllowed` list as a capability
  so any surface can enumerate valid models (currently only embedded in provider-protocol).
- Capability `cap:opencode:models`, CLI `opencode models`, MCP `opencode_models`,
  apiEndpoint `GET /api/opencode/models`.

### T1.4 — `cap:opencode:supervisor.health`
- `OpenCodeSupervisor.isRunning()/getPort()` already exist. Add capability returning
  `{running, port, restarts}` (+ optionally `/doc` probe). CLI `opencode status`.
- Feeds the HealthDashboard surface.

### T1.5 — permission decision as a first-class stream
- `cap:opencode:send` currently does fire-and-forget (`sendPrompt`) and the HTTP route does
  NOT wait for completion. Add a blocking variant (`sendMessage`) with an output that
  includes `permissionDecisions[]`, `fileEdits[]`, `cost`, `tokens` accumulated from the
  ingest layer — so API/UI consumers see the full agent trace, not just "Prompt sent".

### T1.6 — agent session persistence linkage
- `createOpencodeAgentSession` lands `AgentSession` + `ConversationMessage`/`StreamBlock`
  rows. Add a `cap:opencode:history` capability (or reuse conversation read) that joins
  session → conversation → messages so the UI can render a full served-agent transcript.

---

## Phase 2 — Cross-surface parity hardening

### T2.1 — `bun run devops verify-cross-surface` green
- After Phase 0+1, run the parity verifier; it must resolve every opencode/agent cap on
  CLI (name), API (path), MCP (tool name), UI (slot id). Fix any taxonomy/slot mismatches
  (see AGENTS.md "Taxonomy Chain Gotchas": UI slot ids must be namespaced).
- Acceptance: verifier exits 0.

### T2.2 — NLCL coverage parity
- Ensure every cap:opencode:* has ≥1 NLCL pattern in `categories/opencode.ts` (add
  `permission.respond`, `session.diff`, `session.cancel`, `models`, `supervisor.health`).
- Acceptance: `opencode` patterns file covers all 9 caps.

### T2.3 — MCP tool parity
- `McpServerAdapter.exportForMcp` auto-derives from `mcpToolName`, so new caps need their
  `mcpToolName` set. Verify `/tools` lists them after boot.

---

## Phase 3 — Tests

- Unit: `tests/unit/engines/opencode-client.test.ts` — add `listSessions`/`cancel`/`getDiff`
  wire-format fixtures; `parseOpencodeJson` still the shared grammar (unchanged).
- Unit: `tests/unit/engines/local-agent.test.ts` — assert `isModelAllowed` uses the
  reconciled model list (T0.5).
- Integration: `tests/integration/opencode/` — real session list round-trip; permission
  denial surfaces error (T0.3); `/api/agent/run` route (T0.1) with a mock executor.
- Frontend: catalog renders the 5 caps + composer action executes (T0.6).
- MCP: `nl_command` tool present + routes to opencode.send (T0.2).

---

## Phase 4 — Verification gates

1. `bun test tests/unit/engines/opencode-client.test.ts tests/unit/engines/local-agent.test.ts tests/integration/opencode/`
2. `bun run devops verify-cross-surface`
3. `bun run devops runtime-test test --nl="ask opencode to explain this codebase"` (live NLCL → opencode.send)
4. `bun run devops runtime-test onboard verify --provider=opencode`
5. Manual smoke: `agent run "hi"` (CLI), `POST /api/agent/run` (API), catalog → composer
   (UI), MCP `/tools` (MCP), `opencode: ...` (NLCL).
6. `bun run devops converge --provider=opencode` (spec/code/arch alignment).

---

## Open items / decisions to confirm before execution

- D1: Is `opencode serve` GET `/session` (list) available in the installed binary? If not,
  T0.4 falls back to ingest-tracked sessions only.
- D2: T0.5 single-source choice — manifest wins (needed for generator) or seed wins?
- D3: Does `opencode serve` expose a cancel endpoint? If not, T1.2 is abort-only
  (client-side SSE abort, no server cancel).
- D4: T0.3 — surface denial as error vs row-only. Recommend row + error surface.

---

## Model Sync (done 2026-08-08 — auto daily free-model refresh)

> User-priority feature on top of F1–F8: vivim must *always* have the latest free opencode
> model list, expose it, and let users pick a default — pulled daily in the background.

**Status: implemented.** Live `opencode v1.18.4` discovery verified (8 free models).

### What was built
- `src/engines/local-agent/opencode-model-sync.ts` — `OpenCodeModelSync` engine:
  spawns `opencode models opencode --verbose [--refresh]`, parses the bare-`opencode/<slug>`
  + JSON-block stream (`parseOpencodeModelsVerbose`, tolerant of stray header lines),
  keeps the free tier via cost (`cost.input===0 && cost.output===0` — catches zero-cost
  models with no `-free` suffix, e.g. `big-pickle`), persists, and runs a daily
  background daemon (`start()` → immediate best-effort sync + `setInterval`).
  Syncs are idempotent and skip when the cache is fresher than `intervalMs`
  (`syncWhenStale`), and record `models_last_synced_at` in `provider_config`.
- `src/storage/contracts/local-agent-store.ts` + `src/storage/impl/local-agent-store-impl.ts`:
  new `syncAgentModels()` (upsert incoming, deactivate stale, preserve current default when
  present, else caller default / first), `setAgentDefaultModel()`, `getAgentModelSyncState()`.
  `getAgentProvider`/`getAgentConfig` now filter to active models and carry context/pricing
  metadata.
- `src/engines/capability-bootstrap/default.ts` — 3 new capabilities (all surfaces:
  CLI/API/MCP/UI/workflow), gated on `localAgentStore`:
  | id | cli | api | mcp | ui |
  |----|-----|-----|-----|----|
  | `cap:opencode:models` | `opencode models` | `GET /api/opencode/models` | `opencode_models` | `model-list` sidebar 7 |
  | `cap:opencode:model.sync` | `opencode models sync [--refresh]` | `POST /api/opencode/models/sync` | `opencode_model_sync` | `action-button` sidebar 8 |
  | `cap:opencode:model.set_default` | `opencode model set-default <model>` | `POST /api/opencode/model/default` | `opencode_model_set_default` | `action-button` sidebar 9 |
- `src/engines/capability-bootstrap/types.ts` — `BootstrapServices.opencodeModelSync?`.
- `src/server/bootstrap/phases/capabilities.ts` — constructs the sync engine, passes it into
  `registerDefaultCapabilities`, and starts the daemon when `config.opencodeModelSyncEnabled`.
- `src/config.ts` + `.env.example` — `OPENCODE_MODEL_SYNC_ENABLED` (default 1),
  `OPENCODE_MODEL_SYNC_INTERVAL_HOURS` (default 24), `OPENCODE_MODEL_SYNC_REFRESH`.
- `src/engines/nlcl/categories/opencode.ts` — NLCL patterns for all 3 caps.

### Notes / residue
- The stale seed (`hy3-free`) is NOT manually edited; the first daily sync removes it and
  adds `big-pickle`, `laguna-s-2.1-free`, `ling-3.0-tiny-free`, `longcat-2.0-free` automatically.
- D2 (manifest vs seed single-source) remains open for T0.5; the model sync intentionally
  treats the CLI (models.dev) as the live source of truth for the allow-list.
- Next steps if desired: seed the manifest from the same discovered list, add UI rendering
  for `model-list` / `model.set_default`, and unit tests for `parseOpencodeModelsVerbose`
  (fixture: `%TEMP%\opencode-models-verbose.json`).
