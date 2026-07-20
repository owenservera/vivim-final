# vivim-final — Agentic Backbone Data Model (Implementation Plan)

## 0. Current State (verified 2026-07-19)

**Already done by the prior session — DO NOT redo:**
- `src/schema/agentic.ts` is fully written: `ActorRefSchema`/`actorDid`/`parseActorDid`,
  `AGENTIC_EDGE` vocabulary, and Zod schemas for all 10 agentic types
  (`AgentData`, `RoleData`, `GovernancePolicyData` + `GovernanceRoleBinding`, `AgentRunData`,
  `AgentStepData` with `callStatus` + `emitsNodeIds`, `ToolData`, `ObjectiveData` +
  `ObjectiveAgendaItem`, `AgentBeliefData`, `BuilderRunData`). Exports `AGENTIC_NODE_TYPES`
  and `agenticDataSchemas` map.
- `src/schema/node.ts` `NodeType` union **already includes** all 10 `cap-store.*` agentic types
  (`cap-store.agent` … `cap-store.builder_run`).

**NOT yet done — this is the actual work:**
- `registerAllSchemas()` in `src/schema/schemas.ts` does **NOT** register the agentic schemas
  into `SchemaRegistry` → `schemaRegistry.validate('cap-store.agent', data)` fails at runtime.
- No `AgenticStoreContract` (`src/storage/contracts/agentic-store.ts`).
- No Prisma tables: `AgentBuilderRun`, `RunInbox`, `SlotBinding` (legacy `AgentLoopRun` /
  `AgentStep` / `AgentDecisionLog` exist and stay read-only).
- No engines (governance, budget, objective, belief, capability-binder, agent-builder).
- No migration, no quickstart integration tests.

## 1. Design Summary

Unify all new primitives onto the universal Node graph as typed `cap-store.*` Node sub-types
(payload in `dataJson`, validated by Zod; edges in `edgesJson`). Harvested from pydantic-ai 2.0:
capability-as-data, three identity axes (`runId` ⊥ `conversationId` ⊥ `objectiveId`),
first-class cost budget (`UsageLimits`), `endStrategy` (early/graceful/exhaustive), durable
serializable checkpoints, mid-run inbox, deferred/approval tools, dynamic toolsets.

Two genuinely-new primitives the existing 150-model schema lacks: **`cap-store.objective`**
(cross-run intent, sleep/wake/re-plan) and **`cap-store.agent_belief`** (versioned mutable
world-model, distinct from FSRS curation memory). Plus **causal provenance**: an agent step
`emits` the node it produced via a typed edge.

Builders are a **separate subsystem** (`AgentBuilderRun`) that emits `cap-store.agent` /
`cap-store.agent_run` Nodes; agent-led recursion via `agent_step.actionType='spawn'`.

## 2. Backbone Entities (schemas already exist in `src/schema/agentic.ts`)

| Node type | Purpose |
|---|---|
| `cap-store.agent` | Agent as actor; reputation derived from run outcomes; `createdByActor` |
| `cap-store.role` | Governance slot; `constraintsJson{maxCostCents,maxTokens,allowBrowser,allowTools,maxSteps}` |
| `cap-store.governance_policy` | Multi-role allocation; `strategy`, `roles[]`, `endStrategy`, `costBudgetCents`, `reputationFloor` |
| `cap-store.agent_run` | Durable/resumable/forkable spine; `runId`/`conversationId`/`objectiveId`; `checkpointJson`; `budget` |
| `cap-store.agent_step` | Atomic work unit; `actor:actorRef`; `callStatus: ok|pending_human|deferred|error`; `emitsNodeIds[]` |
| `cap-store.tool` | Generated/registered tool; `sandboxJson` (deny-all default); `generatedByActor` |
| `cap-store.objective` | Cross-run intent; `agenda[]` (task/wait_for_event/human_check/sleep_until/review); `progress` |
| `cap-store.agent_belief` | Versioned mutable world-model; `ownerKind`; `retracted`; `sourceStepId?` |
| `cap-store.builder_run` | Agent construction (human_led / agent_led); emits `cap-store.agent` |

Edge vocabulary (`AGENTIC_EDGE`): `spawned`, `uses`, `plays`, `played_by`, `defines`, `governs`,
`child`, `step`, `invoked_in`, `version_of`, `emits`, `believes`, `pursues`, `subtask`, `built`.

## 3. New Relational Tables (Prisma — ADD only)

- `AgentBuilderRun` — build pipeline state (discover→infer→draft→validate→spawn); writes
  resulting `cap-store.agent` / `cap-store.agent_run` Nodes.
- `RunInbox` — mid-run task queue (`{ runId, priority:'asap'|'when_idle', contentJson, status }`).
- `SlotBinding` — audited UI↔agent/role binding (`{ slotId, componentId, boundAgentId?,
  boundRoleId?, boundByActor, active, auditJson }`) for hot-swappable UI.

## 4. Work Items (ordered, atomic)

1. **Register schemas** — edit `src/schema/schemas.ts` `registerAllSchemas()` to import
   `agenticDataSchemas` from `./agentic.js` and loop-register each `cap-store.*` agentic type
   into `schemaRegistry` (with `indexContent`/`embeddingText` per type, mirroring the
   `cap-store.memory` block). Verify `schemaRegistry.has('cap-store.agent') === true`.

2. **Contracts** — create `src/storage/contracts/agentic-store.ts` exporting
   `AgenticStoreContract` (composition note: methods persist via `NodeStoreContract`, which
   already provides `putNode/getNode/listNodes/putEdge/getOutgoingEdges/updateNode/
   getNodeAtVersion`). Contract methods:
   - agents: `putAgent`, `getAgent`, `listAgents`, `updateReputation(agentId, outcome)`
   - runs: `startRun(spec)`, `appendStep(runId, step)`, `checkpointRun(runId, state)`,
     `resumeRun(runId)`, `forkRun(runId, goalPatch)`, `enqueueTask(runId, task)`, `drainInbox(runId)`
   - budgets: `accrueCost(runId, cost)`, `checkBudget(runId, kind)`
   - tools: `putTool`, `invokeTool(toolId, input) -> toolCallId`, `putToolset`, `bindToolset`
   - governance: `putGovernancePolicy`, `evaluateAllocation(policyId, ctx) -> roleBindings`
   - roles: `putRole`, `assignRole(roleId, agentId)`
   - objectives: `putObjective`, `advanceAgenda(objectiveId)`, `sleepObjective(id, until)`
   - beliefs: `putBelief`, `retractBelief`, `getBeliefs(ownerKind, ownerId)`
   - capabilities: `putCapability`, `bindCapability(capId, runId)`
   - builder: `startBuilderRun(intent, mode)`, `spawnFromBuilder(builderRunId)`

 3. **Prisma migration** — add models to `prisma/schema.prisma`:
    - Backbone: `AgentBuilderRun`, `RunInbox`, `SlotBinding`.
    - OpenCode + event substrate: `EventRecord` (durable source-tagged outbox), `AgentSession`
      (supervision ext of `ProviderSession`), `AgentPermissionDecision`, `AgentFileEdit`,
      `AgentDefinition`.
    - Run `bunx prisma migrate dev`; fixture push
      `DATABASE_URL="file:./tests/fixtures/node-store-test.db" bunx prisma db push --accept-data-loss`.

 4. **GovernanceEngine** — `evaluateAllocation(policyId, ctx)`: round_robin cursor +
    `cost_aware` (pick min `avgCostCents` among candidates within `costBudgetCents`) +
    `reputationFloor` filter + `fallback_chain`; honor `endStrategy`
    (early/graceful/exhaustive) when resolving parallel tool calls / final output.

 5. **BudgetEngine** — `accrueCost` + `checkBudget` vs `UsageLimits`
    (`requestLimit`, `toolCallsLimit`, `inputTokensLimit`, `outputTokensLimit`,
    `totalTokensLimit`); raise `BudgetExceededError` (already in `src/errors.ts`, reused).

 6. **ToolRegistry + SandboxRunner wiring** — `putTool({kind:'generated'})` defaults to deny-all
    sandbox; `invokeTool` returns a `toolCallId`; toolsets are `cap-store.tool`-binding Nodes.

 7. **ObjectiveEngine** — agenda advance, `sleepObjective`/`wake`, cross-run pursuit; produces
    `cap-store.objective` Nodes + `pursues` edges.

 8. **BeliefStore** — `putBelief`/`retractBelief`/`getBeliefs`; each mutation bumps Node version
    (time-travelable via `updateNode`/`getNodeAtVersion`).

 9. **CapabilityBinder** — bind `cap-store.capability` Nodes to runs; toposort by `ordering`
    (`wraps`/`wrappedBy`/`requires`).

 10. **AgentBuilder subsystem** — `AgentBuilderRun` service: `startBuilderRun` + `spawnFromBuilder`
     (human-led emits agent; agent-led triggered by `agent_step.actionType='spawn'`).

 11. **SlotBinding** — UI hot-swap audit hook writing `SlotBinding` rows.

 12. **Agent chat-thread surface** — NO new message tables. Add `AgenticStoreContract` methods
     `startAgentConversation(actor, goal)` → `ProviderSession(providerId='agent:<id>')` +
     `Conversation` + `appendAgentMessage(...)` → `ConversationMessage`+`StreamBlock`; link
     causal `agent_step.emitsNodeIds` to the message node. Proves first-class agent thread.

 13. **OpenCode client + supervisor** — `src/engines/opencode-client.ts`: spawn `opencode serve`
     once, HealthProbe `GET /global/health` + backoff restart; typed fetch (session/message/
     prompt_async/permissions/`/event` SSE/`/doc`). Basic auth via `OPENCODE_SERVER_PASSWORD`,
     loopback-bound.

 14. **OpenCode ingest + Governor permission loop** — `src/engines/opencode-ingest.ts`: SSE →
     `EventRecord` (hash-chained, `source:'opencode'`) → project into `ConversationMessage`/
     `StreamBlock`/`AgentPermissionDecision`/`AgentFileEdit`; Governor listens for permission
     events and responds via `POST /session/:id/permissions/:id`. Extend `CapabilityEventBus`
     to also write `EventRecord`.

 15. **Back-compat** — one-way sync view `AgentLoopRun` → `cap-store.agent_run` (read-only post-transition).

 16. **Quickstart integration tests** — `tests/integration/agentic/` covering the 11 scenarios in §6/§6b/§6c.

## 5. Cross-Cutting Rules (invariants)

- **Actor uniformity**: `actorRef={kind:'user'|'agent',id}`; `authorDid = kind:id`.
- **Three identity axes** never overloaded: `runId` (one execution) ⊥ `conversationId`
  (one thread) ⊥ `objectiveId` (one pursuit across runs).
- **Cost is first-class**; `BudgetExceededError` raised before/after calls.
- **Durable by default**: `checkpointJson`, `RunInbox`, `capability.configJson` are serializable
  (no runtime closures) — satisfies pydantic-ai `durable_exec` rule so runs resume across restarts.
- **Add, never rewrite** the ~150 existing models. `AgentLoopRun`/`AgentStep` stay read-only.
- Generated `cap-store.tool` defaults to deny-all; `SandboxRunner` enforces.

## 6. Validation (quickstart scenarios → integration tests)

1. Human-led spawn: `startBuilderRun({intent},'human_led')` → `cap-store.agent` → `startRun`
   (single-role, `endStrategy:'graceful'`) → `appendStep(llm_call)` → `checkpointRun` →
   `resumeRun` (proves durable resume + 3-axis ids + schemaRegistry validation).
2. Multi-role governance: `round_robin` rotates `roleBindings` across 3 `startRun` calls; then
   `cost_aware` picks lowest-`avgCostCents` within `costBudgetCents`.
3. Tool generation + deferred approval: `putTool({kind:'generated'})` → `invokeTool` step with
   `callStatus='pending_human'` → HITL resolves → step completes (causal `invoked_in` edge).
4. Agent-led recursion: `agent_run` step `actionType='spawn'` → `startBuilderRun(...,'agent_led')`
   → child `cap-store.agent` + child `agent_run`.
5. Objective across runs: `putObjective({agenda:[task,sleep_until,review]})` → run #1 does `task`,
   `sleepObjective`; run #2 `advanceAgenda` → `review` → `succeeded`.
6. Capability-as-data: bind `cap-store.capability{kind:'budget'}` to a run → `checkBudget` raises
   `BudgetExceededError`.
7. Causal provenance walk: `cap-store.memory` → `emits` → `agent_step` → `agent_run` →
   `governed_by` → `governance_policy` → `defines` → `role` → `played_by` → `agent` → `pursues` →
   `objective`.
8. Time-travel: `getNodeAtVersion(agentRunId, 1)` vs current → `forkRun`.

Run: `bun test tests/integration/agentic` + `bun run typecheck` (only when all items complete;
coordinate with human before mid-task typecheck per AGENTS.md).

## 6b. First-Class Agent Chat-Thread Surface (NEW — added to plan)

An agent (or a human driving an agent) needs a real conversational thread, not just
`agent_step` records. **Do NOT create new message tables** — the repo already has the
full surface and it maps 1:1 onto OpenCode's part model:

| Need | Existing model (reuse) |
|---|---|
| Thread | `Conversation` (`providerSessionId`, `providerId`, `source`) |
| Message | `ConversationMessage` (`role`, `blocksJson`, `model`, `sequenceIndex`, `parentMessageId`) |
| Multipart | `StreamBlock` (text / tool_call / tool_result / file / reasoning — same types OpenCode emits) |
| Session | `ProviderSession` (`providerId`, `accountId`, `contextJson`, `state`) |
| Session lineage | `ProviderSession.parent`/fork via `contextJson` |

**Design**: an agent's chat history is a `Conversation` whose `providerSessionId` points at a
`ProviderSession` with `providerId='agent:<agentId>'` (or `providerId='opencode'`, see §10).
`authorDid` = `actorDid(actor)` so the same lens queries "messages by user:X" and
"messages by agent:Y". `agent_step.emitsNodeIds` links causal steps to the `ConversationMessage`
node they produced. No schema duplication; one query lens for human + agent + provider threads.

## 6c. OpenCode Integration — HTTP/SSE Backend (NEW — added to plan)

**Decisions locked (2026-07-19):**
- **Skip `opencode run`** entirely (CLI wrapper + known `run --attach` "No context found"
  bug). Talk to **`opencode serve`** as a long-lived HTTP/SSE backend, supervised like a
  Chrome slave (HealthProbe `GET /global/health`, restart-with-backoff).
- **Peer provider** (user-confirmed): OpenCode = `providerId='opencode'` reusing
  `ProviderSession`/`Conversation`/`ConversationMessage`/`StreamBlock`. NO parallel
  `AgentMessage`/`AgentMessagePart` tables (they'd duplicate `ConversationMessage`/`StreamBlock`).
- **Mirror + audit, never write OpenCode's DB**: VIVIM store is populated asynchronously by
  consuming `GET /event` SSE. OpenCode's SQLite stays single-writer/ephemeral.
- **Governor owns permission decisions**: listen on `/event` for permission-request events,
  respond via `POST /session/:id/permissions/:permissionID` programmatically (not `--auto` /
  agent frontmatter presets). Matches Governor Canon (one authority decides).
- `OPENCODE_SERVER_PASSWORD` basic auth, loopback-bound. Thin typed fetch client generated off
  `GET /doc` (OpenAPI 3.1) — no off-the-shelf JS SDK.

### Reconciliation note (deviations from the pasted schema — verified against actual code)
1. **No `AgentMessage`/`AgentMessagePart`** — dropped; reuse `ConversationMessage`+`StreamBlock`.
2. **No existing durable event substrate** — the pasted "hash-chained outbox" does NOT exist;
   `CapabilityEventBus` is in-memory/transient and there is no `Event`/`Outbox` table. To honor
   the *intent* (single source of truth, no dual-tracking) we add **one minimal durable
   `EventRecord` outbox** (source-tagged) that OpenCode + browser fleet + capability layer all
   write to. This is the only new "event log"; it is the shared substrate, not a parallel one.
3. **No `riskTier` capability column** — capabilities use `planTier`; the real sensitivity scale
   is `securityLevel` (Int) on Node. OpenCode `AgentPermissionDecision.riskTier` becomes a local
   `Int` (1-5) mapped onto `securityLevel` semantics; document the mapping.
4. **No canonical JSON Patch helper** — `AgentFileEdit.patch` stored as RFC-6902 JSON Patch
   (new, simple convention); `beforeHash`/`afterHash` from file content.
5. **`Prisma-vs-VersionManager`** question: OpenCode tables are **read-model projections** derived
   by replaying `EventRecord`; `AgentDefinition.version` is a plain `Int` (bump on edit), NOT the
   Node version chain. Settled as: these tables are projections, `EventRecord` is source of truth.

### New Prisma tables (ADD only)
- `EventRecord` — durable outbox: `{ id, source(String), entityType?, entityId?, providerSessionId?, type(String), payloadJson, seq(Int), hash(String), createdAt }`. `source` ∈
  `{'opencode','browser_fleet','capability', ...}`. Hash-chained (`hash` = H(prevHash||payload)).
- `AgentSession` — OpenCode supervision extension of `ProviderSession`: `{ id PK, providerSessionId @unique (opencode's), providerId @default("opencode"), parentSessionId? (fork), agentName, model, projectPath, status, createdAt, updatedAt }`; relation `ProviderSession` (1:1 optional) + self `Fork`.
- `AgentPermissionDecision` — governance audit: `{ id, agentSessionId, providerPermissionId @unique, toolName, riskTier(Int), requestedAt, respondedAt?, decision? ('allow'|'deny'|'allow_always'), decidedBy, payloadJson }`.
- `AgentFileEdit` — filesystem truth from `/session/:id/diff`: `{ id, agentSessionId, messageId?, filePath, patchJson (RFC-6902), beforeHash?, afterHash?, createdAt }`.
- `AgentDefinition` — versioned agent/permission presets as data: `{ id, name @unique, mode ('all'|'primary'|'subagent'), permissionsJson, model, systemPrompt?, version @default(1), createdAt }`.

### New engine / client
- `src/engines/opencode-client.ts` — typed fetch wrapper (sessions, message, prompt_async,
  permissions, `/event` SSE consumer, `/doc` parse). HealthProbe + backoff supervisor.
- `src/engines/opencode-ingest.ts` — SSE → `EventRecord` → project into `ConversationMessage`/
  `StreamBlock`/`AgentPermissionDecision`/`AgentFileEdit`; Governor permission-response loop.
- Extend `EventRecord` writer into `CapabilityEventBus` (emit to both in-memory bus + durable table).

### Validation scenarios (add to §6)
9. OpenCode peer session: spawn `opencode serve`, `POST /session`, `POST /session/:id/message`,
   assert a `ConversationMessage` (role=assistant, `blocksJson` with tool_call) is projected.
10. Permission governance: emit a permission-request on `/event` → Governor auto-denies tier>3
    → `POST /session/:id/permissions/:id` → `AgentPermissionDecision` row written by policy.
11. File edit truth: `/session/:id/diff` → `AgentFileEdit` patch stored; replayable from `EventRecord`.

## 7. Risks / Open Questions

- **R1 query perf**: universal Node + json payloads. Mitigate: DB indexes on `type+conversationId`,
  `type+objectiveId`; materialized `RunInbox`/`SlotBinding`.
- **R2 migration**: ADD only; legacy models read-only.
- **R3 sandbox safety**: generated tool deny-all default + `SandboxRunner` enforcement.
- **R4 durable serialization**: closure-free `checkpointJson`/`configJson`.
- **OQ1** governance DSL vs JSON+eval — v1 JSON config + `evaluateAllocation`; DSL later.
- **OQ2** agent auth — v1 local actors only; external auth later.
- **R5 OpenCode coupling**: SSE schema drift between `opencode serve` versions → thin client
  generated from `GET /doc` at boot; fail-closed on unknown event types (write to `EventRecord`,
  skip projection). Never block the supervisor on a bad event.
- **R6 single-writer discipline**: VIVIM never writes OpenCode's SQLite; ingest is read-only SSE.
- **R7 EventRecord hash chain**: `seq` monotonic per `source`; hash = H(prevHash||payload).
  Replay must be idempotent (dedupe by `providerPermissionId`/`providerMessageId` unique keys).

## 8. Source-of-truth files

- `src/schema/agentic.ts` (exists) — all Zod schemas, `actorRef`, edge vocab. **Edit only to fix bugs.**
- `src/schema/schemas.ts` (edit §4.1) — register the 10 agentic types.
- `src/storage/contracts/agentic-store.ts` (new) — `AgenticStoreContract`.
- `prisma/schema.prisma` (edit §4.3) — add `AgentBuilderRun`, `RunInbox`, `SlotBinding`,
  `EventRecord`, `AgentSession`, `AgentPermissionDecision`, `AgentFileEdit`, `AgentDefinition`.
- `src/engines/{governance,budget,objective,belief,capability-binder,agent-builder}.ts` (new).
- `src/engines/opencode-client.ts` + `src/engines/opencode-ingest.ts` (new) — HTTP/SSE backend.
- `src/engines/capability-event-bus.ts` (edit §14) — also write `EventRecord`.
- `tests/integration/agentic/` (new) — 11 quickstart scenarios (§6 + §6b + §6c).
