# Research: Local-Agent OpenCode Provider (Phase 0)

**Feature**: `022-local-agent-opencode` | **Date**: 2026-07-19

All NEEDS CLARIFICATION from the spec are resolved below. The single source of truth is the
empirical test performed on this host (see `docs/research/evidence/opencode-agentic/notes.md`).

## R-1: Which models are usable? (was NEEDS CLARIFICATION)

**Decision**: Exactly 4 Zen free models, verified by live execution:
`opencode/deepseek-v4-flash-free`, `opencode/hy3-free`, `opencode/mimo-v2.5-free`,
`opencode/north-mini-code-free`.

**Rationale**: These returned text with exit code 0 and `tokens.cost:0` in real runs.
`opencode/nemotron-3-ultra-free` produced no output in 5 minutes → excluded.

**Alternatives considered**: Paid models (`anthropic/claude-sonnet-4`, `deepseek/deepseek-v4-flash`)
require API keys — out of scope per user directive (Zen free only).

## R-2: How to invoke OpenCode headlessly? (was NEEDS CLARIFICATION)

**Decision**: `opencode run --auto --model <id> --format json [--session <id>] "<prompt>"`.

**Rationale**: Verified non-interactive, zero-key, parseable NDJSON stream. `--auto` auto-approves
non-denied tool calls; `--format json` emits `step_start`/`text`/`step_finish` events.
Multi-turn resume uses `-s/--session <id>` (returns the same session ID with context retained).
`--continue <id>` is a trap (parses `id` as the message → brand-new session); never use it.

**Alternatives considered**: `serve` + HTTP (`POST /session/:id/message`) — separate `opencode serve`
surface owned by other agents (AGENT4/AGENT6); out of scope for `cap:agent:run`. `acp` (stdio
nd-JSON) — good embed contract but heavier to manage from a spawned process in v1.

## R-3: What is the parse contract? (was NEEDS CLARIFICATION)

**Decision** (VERIFIED against opencode v1.17.15): `--format json` emits **NDJSON** (one JSON
object per line, no array/envelope). Each line has a top-level `type`; assistant content lives in
`part.text` / `part.type` — NOT the legacy `message.parts` / `role` shape. Map to `ContentBlock`
(`src/schema/streaming.ts` `ContentPart`):
- `type:'text'` → `{type:'text', text: part.text}`
- `type:'reasoning'` (only with `--thinking`) → `{type:'reasoning', text: part.text}`
- `type:'tool_use'` → `{type:'tool-call', toolCallId, toolName, input}` + `{type:'tool-result', toolCallId, output}`; `part.tool === 'invalid'` → **silent permission denial** → `{type:'error', code:'PERMISSION_DENIED'}`
- `type:'step_start'` → `{type:'step-start'}`; capture `part.sessionID` for resume
- `type:'step_finish'` → terminal; read `part.tokens.{input,output,reasoning,cache}` + `part.cost`
- `type:'error'` (or fatal CLI error, exit != 0) → `{type:'error', message, code:'AGENT_FAILED'}`

**Rationale**: `ContentBlock = ContentPart` is the canonical layer-1 part and the parse target of
`StreamParserEngine` + `ConversationManager.captureAsNode()`. No special type needed. The parser
verified by `tests/unit/engines/local-agent.test.ts` (8/8). See `docs/research/briefs/opencode-deep/`.

## R-4: Where does the capability live? (was NEEDS CLARIFICATION / governed by invariants)

**Decision**: One `cap:agent:run` UnifiedCapability registered in `capability-bootstrap.ts`
`registerDefaultCapabilities` (or a sibling `registerLocalAgentCapabilities`). Exposed on all 5
surfaces via `makeCapability`.

**Rationale**: Satisfies One Entry Point invariant — every operation is a UnifiedCapability.

## R-5: Does this touch the Governor Canon?

**Decision**: No. `LocalAgentProviderExecutor` shells `opencode` via `Bun.spawn`. It imports no
`BunCdpClient` and never calls `ChromeGovernor`. The `provider_type: 'local-agent'` is a distinct
enum value from `'llm'` (CDP).

**Rationale**: Preserves the architectural boundary; local-agent is an LLM-API caller, not a web UI.

## R-6: Storage shape?

**Decision**: Dedicated `LocalAgentStore` contract (not the CDP `ProviderStore`). The `opencode`
provider + 4 free-model rows + config (`timeoutMs`, `allowedModels`, `binary`, `defaultModel`) are
seeded idempotently at boot by `seedLocalAgentProvider()` in `capability-bootstrap.ts` (which calls
`LocalAgentStore.upsertAgentProvider`). Reads `provider_type='local-agent'` rows from the existing
`ProviderDefinition`/`ProviderModel`/`ProviderConfig` Prisma models — no separate `seeds/providers`
file, no new migration.

**Rationale**: Local-agent reuses the DB but owns a store contract so the CDP seed path stays
untouched.

## Consolidated decisions

| # | Decision | Key |
|---|----------|-----|
| R-1 | 4 verified free models; nemotron excluded | allow-list |
| R-2 | `opencode run --auto --model <id> --format json [-s <sessionId>]` | spawn |
| R-3 | NDJSON events → `ContentBlock[]` (`ContentPart`); `tool:"invalid"` = silent perm denial | parse |
| R-4 | one `cap:agent:run` capability, all surfaces | registry |
| R-5 | no CDP/ChromeGovernor; `Bun.spawn` only | canon |
| R-6 | dedicated `LocalAgentStore` contract, seeded at boot | storage |
