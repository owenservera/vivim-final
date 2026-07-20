# AGENT5 — Agentic Backbone Data Model + Agent Chat-Thread Surface

**Role:** Agent #5 in the coordinated vivim-final upgrade effort (all agents paused for coordination).
**Owner session scope:** Agentic backbone (Plan `1784415743937-agentic-backbone-data-model.md`) + Option C (agent chat-thread surface). Option D (OpenCode client) assessed but DEFERRED.
**Status:** ✅ Backbone complete & verified. ✅ Option C implemented & tested. ⏸ Option D blocked (research-gated).
**Last updated:** 2026-07-19

---

## OBJECTIVES

1. **Implement & verify the agentic backbone data model** (Plan `1784415743937-agentic-backbone-data-model.md`).
2. **Option C — Agent chat-thread surface:** let an `AgentBuilderRun` / agent produce a real conversation thread (reusing `Conversation` / `ConversationMessage` / `StreamBlock` / `ProviderSession`), so chat UI can render agent output natively.
3. **Option D — OpenCode client assessment:** evaluate whether to build `opencode-client.ts` / `opencode-ingest.ts`. **Deferred** — gated on research-only plan `1784416945191-opencode-deep-research-plan.md`; briefs in `docs/research/briefs/opencode-deep/` do not yet exist. NOT implemented.

---

## WHAT WAS DONE (this session)

### Backbone (verified, mostly pre-executed by prior session, errors fixed & exports added)
- 4 backbone Prisma tables present: `AgentBuilderRun`, `RunInbox`, `SlotBinding`, `EventRecord` (plus 4 OpenCode tables `AgentSession`, `AgentPermissionDecision`, `AgentFileEdit`, `AgentDefinition`).
- Present in fixture `tests/fixtures/node-store-test.db` too.
- `AgenticStoreImpl` (`src/storage/impl/agentic-store-impl.ts`) implements `AgenticStoreContract`.
- 6 engines exist & compile: `governance-engine.ts`, `budget-engine.ts`, `objective-engine.ts`, `belief-store.ts`, `capability-binder.ts`, `agent-builder.ts`.
- `event-record-store.ts` hash-chain logic present & correct.
- v1 `capability-event-bus.ts` mirrors events to durable store (do NOT touch `capability-event-bus-v2.ts`).
- **Fixed 5 backbone type errors:** 2 in `agentic-store-impl.ts` (`string | undefined` index access), 3 in `backbone.test.ts` (`unknown` / optional access).
- **Added barrel exports** in `src/index.ts` for all 6 engines + `AgenticStoreImpl` + `EventRecordStore` + `agentic.ts` helpers (`actorDid`, `parseActorDid`, `AGENTIC_EDGE`, `AGENTIC_NODE_TYPES`).
- **Wired into server** (`src/server/index.ts` ~650-680): `createServerWithEngines` instantiates `AgenticStoreImpl`, `BeliefStore`, `MemoryFabric`, `AgentBuilderEngine`; attaches `ctx.memoryFabric`, `ctx.agentBuilder`.

### Option C — Agent chat-thread surface (new work)
Contract `src/storage/contracts/agentic-store.ts` extended with:
- `startAgentConversation(runId, title?)`
- `appendAgentMessage(runId, role, text)`
- `getAgentMessages(runId)`
- `linkStepToMessage(runId, stepId, messageId)`

Implemented in `agentic-store-impl.ts`:
- Upserts an `agent:<id>` `ProviderDefinition` + `ProviderSession` + `Conversation` + `ConversationMessage` + `StreamBlock`.
- Causal link `agent_step.emitsNodeIds` to the conversation message node.
- `ensureAgentProviderSession()` helper keeps idempotent per-run session creation.

Test `tests/integration/agentic/backbone.test.ts` gained **scenario 9b** (agent chat thread).

### Verification
- `bun test tests/integration/agentic` → **16 pass, 0 fail, 56 expect calls**.
- Backbone files: **0 typecheck errors**. (74 pre-existing errors elsewhere are OUT OF SCOPE — see COLLISION NOTES.)

---

## KEY DECISIONS
- `src/storage/contracts/agentic-store.ts` is authoritative. OQ3 resolved by storing capability as `cap-store.tool` node tagged `capabilityKind` (no new schema type needed).
- Plan §10 chat-thread was net-new (not in contract) → implemented as Option C with 4 new contract methods reusing existing message/conversation tables.
- Option D explicitly NOT implemented (research-first invariant + plan's locked decisions).
- v1 bus only; v2 untouched.
- `BudgetExceededError` ctor is `(budget, used, limit)`; `checkBudget` maps `limit`→`budget`.

---

## COLLISION NOTES (for coordination)
- **Do NOT edit** `src/storage/impl/agentic-store-impl.ts` contract method *signatures* without syncing here (Option C added 4 methods — other agents' work may call them).
- **Pre-existing typecheck errors I did NOT touch** (other owners): `devops/`, `browser-automation`, `tests/e2e`, `tests/unit/devops`, e.g. `devops/agentic/context-probe.ts:67` duplicate identifier, `src/engines/capability-bootstrap.ts:657`, `src/engines/chrome-governor.ts:1157`.
- **Governor Canon:** backbone engines must NOT import CDP / `BunCdpClient` / `ChromeGovernor`. Keep it that way.
- `EventRecord` hash chain: `H(prevHash || payloadJson)`, `seq` monotonic per source, `prevHash` default `'GENESIS'`.
- `startRun` returns `{id, runId}`; `runId` === node id itself.

---

## NEXT STEPS
1. **(Blocked) Option D:** implement `opencode-client.ts` / `opencode-ingest.ts` ONLY after research briefs in `docs/research/briefs/opencode-deep/` exist and plan `1784416945191-opencode-deep-research-plan.md` is unlocked. Do not start until then.
2. **Cross-agent verify:** once other agents land their upgrades, re-run `bun test tests/integration/agentic` and a scoped typecheck on `src/storage` + `src/engines/{governance,budget,objective,belief-store,capability-binder,agent-builder,event-record-store}.ts` to confirm no contract drift.
3. **Barrel check:** if new backbone capabilities are added, keep `src/index.ts` exports in sync (other agents import via barrel).
4. **No commit** unless explicitly requested — paused for coordination.

---

## RELEVANT FILES
- `.kilo/plans/1784415743937-agentic-backbone-data-model.md` — source-of-truth plan.
- `.kilo/plans/1784416945191-opencode-deep-research-plan.md` — research-only gate for Option D.
- `src/storage/contracts/agentic-store.ts` — authoritative contract (Option C methods added).
- `src/storage/impl/agentic-store-impl.ts` — backbone store impl (+ chat-thread methods).
- `src/engines/{governance-engine,budget-engine,objective-engine,belief-store,capability-binder,agent-builder}.ts` — 6 backbone engines.
- `src/engines/event-record-store.ts` — durable hash-chained outbox.
- `src/engines/capability-event-bus.ts` — v1 bus (v2 untouched).
- `src/server/index.ts` — wires backbone into `createServerWithEngines`.
- `src/index.ts` — barrel exports.
- `tests/integration/agentic/backbone.test.ts` — 16 scenarios incl. `scenario 9b`.
- `prisma/schema.prisma` — backbone + OpenCode models (~lines 2896-3040).
- `tests/fixtures/node-store-test.db` — integration fixture (all tables present).
