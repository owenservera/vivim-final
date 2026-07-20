# Feature Specification: Local-Agent OpenCode Provider (Zen free models)

**Feature Branch**: `022-local-agent-opencode`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Wire the 4 verified Zen free OpenCode models (deepseek-v4-flash-free, hy3-free, mimo-v2.5-free, north-mini-code-free) into vivim as a `local-agent` provider so the UnifiedCapabilityRegistry can dispatch them without CDP/Chrome."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register local-agent provider + capabilities (Priority: P1)

vivim boots, seeds a `local-agent` provider manifest (`slug: opencode`) with 4 Zen free
models, and registers a `cap:agent:run` UnifiedCapability so any surface (CLI/UI/API/MCP)
can dispatch an OpenCode agent task. No browser, no CDP, no ChromeGovernor.

**Why this priority**: This is the minimal shippable integration — it makes the 4 verified
free models first-class vivim capabilities without touching the Governor Canon.

**Independent Test**: `bun run devops runtime-test status --provider=opencode` shows the
provider seeded with 4 models; `bun run devops runtime-test test --nl "run deepseek agent: say hello"`
returns a parsed `ContentBlock[]` text.

**Acceptance Scenarios**:

1. **Given** a fresh boot, **When** `registerDefaultCapabilities` + local-agent seed runs, **Then** a provider row `opencode` with `provider_type='local-agent'` and 4 model rows exists.
2. **Given** the registry, **When** `cap:agent:run` is executed with `model: 'opencode/deepseek-v4-flash-free'`, **Then** an `opencode run --auto --format json` subprocess is spawned and its stdout parsed to `ContentBlock[]`.
3. **Given** `nemotron-3-ultra-free` is requested, **When** dispatched, **Then** it is rejected with `EngineError` (model not in allowed list).

---

### User Story 2 - LocalAgentProviderExecutor parses `--format json` (Priority: P2)

  The executor wraps `opencode run` and converts the **verified** opencode v1.17.15 NDJSON event
  stream into the canonical `ContentBlock[]` consumed by `StreamParserEngine` /
  `ConversationManager.captureAsNode()`.

  **Verified parse contract** (see `docs/research/briefs/opencode-deep/area-01-cli-run.md`,
  `area-02-tooluse.md`, `area-06-permissions.md`, `area-08-streaming.md`):
  - `--format json` emits **NDJSON** — one JSON object per line (NO array, NO envelope).
  - Each line has a top-level `type`; assistant content lives in `part.text` / `part.type`
    (NOT the legacy `message.parts` / `role` shape).
  - Event types: `step_start`, `text`, `reasoning` (only with `--thinking`), `tool_use`,
    `step_finish`, `error`.
  - `tool_use` → `tool-call` + `tool-result` blocks. `part.tool === 'invalid'` is a **silent
    permission denial** (run still exits 0) → `PERMISSION_DENIED` error block + `capability:failed`.
  - `sessionID` is captured from the first `step_start` and returned for multi-turn resume.

  **Why this priority**: The parse contract is what lets downstream engines treat agent
  output identically to provider output — no special-casing elsewhere.

  **Independent Test**: `tests/unit/engines/local-agent.test.ts` feeds a recorded `--format json`
  payload through `parseOpencodeJson()` and asserts text/tool/permission-denial/reasoning blocks
  and `cost:0` (8/8 passing).

  **Acceptance Scenarios**:

  1. **Given** a `--format json` stdout with a `text` event, **When** parsed, **Then** a `ContentBlock` of type `text` is produced.
  2. **Given** a `tool_use` with `part.tool === 'invalid'`, **When** parsed, **Then** a `PERMISSION_DENIED` error block is produced and `permissionDenied: true` + `capability:failed` emitted (even though exit code is 0).
  3. **Given** an agent `error` event or fatal CLI error (exit != 0), **When** parsed, **Then** an `error` ContentBlock is produced and a `capability:failed` event emitted.

---

### User Story 3 - Surface parity + event bus bridge (Priority: P3)

`cap:agent:run` is exported to CLI (`cliCommand`), UI (`ui`), API (`apiEndpoint`), and MCP
(`mcpToolName`) via the registry's `exportFor*` methods, and emits `capability:executed`
/ `capability:failed` on `CapabilityEventBus`.

**Why this priority**: Confirms the One-Entry-Point invariant — one capability, all surfaces.

**Independent Test**: `registry.exportForCli()` / `exportForApi()` / `exportForMcp()` include
`agent_run`; `CapabilityEventBus.snapshot()` shows a `capability:executed` entry after a run.

---

### Edge Cases

  - What happens when `opencode` binary is not on PATH? → Executor throws `EngineError` (not a silent hang); capability returns an `error` block.
  - What happens when the model slug is not one of the 4 verified free models? → Rejected before spawn (allow-list via `isModelAllowed`).
  - How does system handle a hung agent (no output)? → `timeoutMs` kill + `capability:failed`.
  - What happens on a silent permission denial (`tool:"invalid"`)? → `PERMISSION_DENIED` error block + `permissionDenied:true` + `capability:failed`, even though exit code is 0.
  - How does multi-turn work? → Resume via `-s/--session <id>` (returns same session ID, context retained). `--continue <id>` is a known trap (parses id as message → new session); do NOT use it.
  - `serve` mode? → `cap:agent:run` is the **CLI-run surface** (owned by AGENT1). The `opencode serve` HTTP surface is a separate concern (AGENT4/AGENT6) — different transport, no capability overlap. v1 wires only `run`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST seed a `local-agent` provider manifest `opencode` with the 4 verified Zen free models (`deepseek-v4-flash-free`, `hy3-free`, `mimo-v2.5-free`, `north-mini-code-free`).
- **FR-002**: System MUST register a `cap:agent:run` UnifiedCapability exposed on `cli`, `ui`, `workflow`, `mcp`, `api` surfaces.
- **FR-003**: `LocalAgentProviderExecutor` MUST spawn `opencode run --auto --model <allowed> --format json [--session <id>] "<prompt>"` and parse the NDJSON stdout to `ContentBlock[]` (text / tool-call / tool-result / reasoning / error blocks).
- **FR-004**: System MUST reject any model not in the verified allow-list via `EngineError` before spawning a process.
- **FR-008**: Executor MUST detect silent permission denials (`tool_use` with `part.tool === 'invalid'`) and surface `PERMISSION_DENIED` (exit code is 0 — do not rely on it).
- **FR-009**: Executor SHOULD support multi-turn resume via `-s/--session <id>` and return `sessionId` for the next turn.
- **FR-005**: System MUST emit `capability:executed` / `capability:failed` events on `CapabilityEventBus`.
- **FR-006**: System MUST NOT import `BunCdpClient` or use `ChromeGovernor` for `local-agent` (Governor Canon).
- **FR-007**: `LocalAgentProviderExecutor` MUST enforce a `timeoutMs` cap and surface a failure on timeout.

### Key Entities

- **LocalAgentProvider**: a `provider_type: 'local-agent'` manifest row (distinct from `llm`/CDP). `slug`, `models[]`, `auth_type: 'none'` (Zen free).
- **LocalAgentConfig**: runtime config — `binary: 'opencode'`, `defaultModel`, `timeoutMs`, `allowedModels[]`.
- **ContentBlock**: canonical output (`src/schema/streaming.ts` `ContentPart`) — the parse target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `cap:agent:run` with `opencode/deepseek-v4-flash-free` returns a non-empty `ContentBlock[]` text within 120s on this host.
- **SC-002**: Requests for `opencode/nemotron-3-ultra-free` are rejected with zero subprocess spawns.
- **SC-003**: All 4 free models pass the same dispatch path (one capability, 4 models).
- **SC-004**: `exportForCli/exportForApi/exportForMcp` each list `agent_run` (surface parity verified).

## Assumptions

- `opencode` CLI is installed and on PATH (verified 2026-07-19 via bun).
- Zen free models need no API key and cost 0 (verified).
- `nemotron-3-ultra-free` is excluded (timed out >5 min in test).
- Only one-shot `run` is wired in v1; `serve`/ACP are future scope.
- LocalAgentProviderExecutor does NOT extend the existing CDP `ProviderRegistrar` path — it uses a dedicated `LocalAgentStore` contract (per impl docs).
