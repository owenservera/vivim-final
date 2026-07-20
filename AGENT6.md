# AGENT6.md — Agentic Backbone (done) + OpenCode HTTP/SSE Backend Integration

**Agent:** #6 (Kilo) &nbsp;|&nbsp; **Scope:** (a) Agentic backbone data model — COMPLETE by other agents; (b) OpenCode `opencode serve` HTTP/SSE backend integration — NOT STARTED
**Status:** PAUSED for coordination (all agents paused per coordinator)
**Date:** 2026-07-19 &nbsp;|&nbsp; **Branch:** master (uncommitted working tree — do NOT commit without explicit ask)

---

## OBJECTIVE

Two parts:

1. **Agentic backbone data model** — the SOTA agentic system spine (agents/roles/governance/runs/steps/tools/objectives/beliefs/capabilities/builder) unified onto the universal Node graph. **This is already implemented by sibling agents** (see Status). My job here is to *own* it as the system architect and finish the one piece they left: the OpenCode backend.
2. **OpenCode integration as a long-lived HTTP/SSE backend** (`opencode serve`), not `opencode run`. Talk to it like a supervised Chrome slave: spawn once, HealthProbe `GET /global/health`, restart-with-backoff, consume `GET /event` SSE into the shared `EventRecord` outbox, and let the **Governor** own permission decisions programmatically. OpenCode is a **peer provider** (`providerId='opencode'`) reusing `ProviderSession`/`Conversation`/`ConversationMessage`/`StreamBlock` — NO parallel message tables.

---

## WHAT IS ALREADY DONE (verified 2026-07-19, by sibling agents — do NOT redo)

The entire agentic backbone from the plan exists in the tree:

- **Schemas**: `src/schema/agentic.ts` (all 10 `cap-store.*` Zod schemas + `actorRef` + `AGENTIC_EDGE`). Registered into `SchemaRegistry` in `src/schema/schemas.ts` (`registerAllSchemas` loops `AGENTIC_NODE_TYPES`).
- **Contract + impl**: `src/storage/contracts/agentic-store.ts` (full `AgenticStoreContract`, incl. agent chat-thread methods `startAgentConversation`/`appendAgentMessage`/`getAgentMessages`/`linkStepToMessage`) AND `src/storage/impl/agentic-store-impl.ts` implements **all 36 contract methods** (verified: every method present).
- **6 engines written**: `governance-engine.ts` (evaluateAllocation + endStrategy), `budget-engine.ts` (accrueCost/checkBudget), `objective-engine.ts` (agenda/sleep/wake), `belief-store.ts` (versioned), `capability-binder.ts` (bind + toposort), `agent-builder.ts` (human + agent led).
- **Prisma tables added**: `AgentBuilderRun`, `RunInbox`, `SlotBinding` (backbone) + `EventRecord`, `AgentSession`, `AgentPermissionDecision`, `AgentFileEdit`, `AgentDefinition` (OpenCode/event projections).
- **Durable event substrate EXISTS**: `src/engines/event-record-store.ts` (`EventRecord` hash-chained outbox, `source: 'opencode'|'browser_fleet'|'capability'`) — `CapabilityEventBus` already writes `EventRecord` when a store is attached. So my §6c "create EventRecord" item is DONE; I only need to *produce into it* from OpenCode.
- **Agent chat-thread surface DONE**: contract methods + `ConversationMessage`/`StreamBlock` reuse confirmed.
- **AGENT3 (spec 024) already consumes** `agenticStore.bindCapability(...)` and `AgentBuilderEngine` at boot (`server/index.ts:664-676`).

**Conclusion: the backbone (plan §1–§5, items 1–12) is complete. I own it but need not rebuild it.**

---

## WHAT IS MINE TO BUILD (genuine remaining scope — §6c items 13–14)

> Verified NOT present anywhere in `src`: no `opencode serve` supervisor, no `GET /event` SSE consumer, no `GET /doc` client, no permission-response loop.

### Files I own (new — no collisions expected)
- `src/engines/opencode-client.ts` — typed fetch wrapper + supervisor
- `src/engines/opencode-ingest.ts` — SSE → `EventRecord` → projections + Governor permission loop
- `src/engines/opencode-supervisor.ts` — spawn `opencode serve`, HealthProbe, restart-with-backoff (may fold into client)
- `tests/integration/opencode/` — integration tests for the 3 scenarios below

### What to build
1. **Supervisor** — `Bun.spawn(['opencode','serve','--port',port,'--hostname','127.0.0.1'])`; `OPENCODE_SERVER_PASSWORD` basic auth, loopback only. HealthProbe `GET /global/health` on interval; on failure, kill + restart-with-backoff. Idempotent exit-handler cleanup. Never per-call spawn/kill (the `opencode run` anti-pattern).
2. **Typed client** (generated off `GET /doc` OpenAPI 3.1 at boot, or hand-rolled thin wrapper): `POST /session`, `POST /session/:id/message` (block), `POST /session/:id/prompt_async` (204 fire-and-forget), `POST /session/:id/permissions/:permissionID`, `GET /event` (SSE), `GET /session/:id/diff`.
3. **Ingest** — consume `/event` SSE → write `EventRecord` (`source:'opencode'`, `providerSessionId`) → project into: `ConversationMessage`+`StreamBlock` (reuse `AgenticStoreContract.startAgentConversation`/`appendAgentMessage`), `AgentPermissionDecision`, `AgentFileEdit` (RFC-6902 patch from `/diff`). Idempotent replay (dedupe by `providerMessageId`/`providerPermissionId` unique keys).
4. **Governor permission loop** — on permission-request event, evaluate policy (deny tier>3 by default; `decidedBy: 'policy:auto-...'` or `human:<userId>`), respond via `POST /session/:id/permissions/:id`. Honor Governor Canon: one authority decides.
5. **Wire** `CapabilityEventBus` + `EventRecordStore` (already wired) — OpenCode just becomes another producer.

### Validation scenarios (add to plan §6c)
- S1: spawn serve → `POST /session` → `POST /session/:id/message` → assert `ConversationMessage` (role=assistant, `blocksJson` w/ tool_call) projected.
- S2: emit permission-request on `/event` → Governor auto-denies tier>3 → `AgentPermissionDecision` row written by policy.
- S3: `/session/:id/diff` → `AgentFileEdit` patch stored, replayable from `EventRecord`.

---

## FILES I OWN / DO NOT LET OTHERS EDIT WITHOUT SYNC
- `src/engines/opencode-client.ts` *(new)*
- `src/engines/opencode-ingest.ts` *(new)*
- `src/engines/opencode-supervisor.ts` *(new, or folded into client)*
- `tests/integration/opencode/` *(new)*
- May lightly edit `src/server/index.ts` (ADDITIVE boot wiring of supervisor, guarded by env) — coordinate with AGENT3 (owns that file's memory block).

---

## COLLISION NOTES (critical for coordination)
- **AGENT1** (spec 022 `cap:agent:run`) shells out to `opencode` **CLI** (`local-agent-executor.ts`). I use `opencode serve` (HTTP/SSE) — DIFFERENT surface. Do NOT touch `local-agent-executor.ts`, `capability-bootstrap.ts` seed fn, or `cap:agent:run`. My work is complementary (serve vs run), not overlapping.
- **AGENT2** owns `fleet-supervisor`/`chrome-governor` admission. I supervise `opencode serve` in a SEPARATE supervisor (not the Chrome fleet). No shared code.
- **AGENT3** (spec 024 memory) owns `src/server/index.ts` memory block + `AgentBuilderEngine` + `memory/`. I may add an ADDITIVE supervisor boot line only, with sync. Reuses `AgenticStoreContract` (already stable).
- **AGENT4** (sandbox audit) drives `cap:agent:run` for live tests — will benefit from my serve backend but must not depend on it; keep both paths independent.
- **`EventRecord` / `agentic-store-*` / `prisma/schema.prisma`** are DONE by others — do NOT re-migrate or rewrite. If I need a schema tweak, coordinate (likely none needed — `AgentSession`/`AgentPermissionDecision`/`AgentFileEdit`/`AgentDefinition` already exist).
- Do NOT create `AgentMessage`/`AgentMessagePart` — reuse `ConversationMessage`/`StreamBlock` (peer-provider decision, user-confirmed).

---

## KEY VERIFIED FACTS (avoid re-litigating)
- Backbone + EventRecord substrate already exist; don't rebuild. `EventRecordStore` is the single source of truth; OpenCode is a `source`-tagged producer.
- `opencode serve` (not `run`) is the integration point; skip `run --attach` (known "No context found" bug).
- Peer provider: `providerId='opencode'` on `ProviderSession`; messages → `ConversationMessage`+`StreamBlock`.
- Governor owns permission decisions (respond to `/event` programmatically), not `--auto`/frontmatter presets.
- Verified free models (AGENT1): `opencode/deepseek-v4-flash-free`, `opencode/hy3-free`, `opencode/mimo-v2.5-free`, `opencode/north-mini-code-free`.
- `devops gate` HANGS (>120s); use `bun run devops verify-cross-surface` instead. `tsc` not run unprompted per AGENTS.md.

---

## NEXT STEPS (post-coordination)
1. Confirm with coordinator that no other agent is taking the OpenCode serve backend (AGENT6 claim).
2. Scaffold `opencode-supervisor.ts` (spawn + HealthProbe + backoff).
3. Build `opencode-client.ts` typed wrapper off `GET /doc`.
4. Build `opencode-ingest.ts` (SSE → `EventRecord` → projections + Governor permission loop).
5. ADDITIVE boot wiring in `server/index.ts` (env-gated), synced with AGENT3.
6. Integration tests S1–S3.
7. `bun run lint` (Biome) on new files; coordinated typecheck only when all green.
8. Do NOT commit unless explicitly asked.

---

## STATUS SUMMARY
| Area | State |
|------|-------|
| Agentic backbone (schemas/contract/impl/6 engines/prisma) | Done by siblings — AGENT6 owns, no rebuild |
| EventRecord durable substrate | Done |
| Agent chat-thread surface | Done (contract + Conversation/Message reuse) |
| OpenCode `serve` supervisor | Not started (AGENT6) |
| OpenCode typed HTTP client | Not started (AGENT6) |
| OpenCode `/event` SSE ingest + projections | Not started (AGENT6) |
| Governor permission-response loop | Not started (AGENT6) |
