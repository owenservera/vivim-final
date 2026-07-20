# AGENT6 HELPER — OpenCode ↔ vivim Full Integration

**Role:** Agent #6 (coordination plan `.kilo/plans/1784479856654-agent-coordination-plan.md`).
**Mission:** Fully enable OpenCode as a **local-process model harness** inside vivim — client, ingest, and supervisor — on top of the substrate AGENT5 already built.
**Status:** 🟢 GO. Backbone + EventRecord substrate confirmed present by AGENT5. Do NOT rebuild them.
**Last updated:** 2026-07-19

---

## 0. TL;DR (read this first)
- AGENT5 finished the **foundation**: all 4 OpenCode Prisma tables exist, the agentic backbone is wired, and the agent chat-thread surface (Option C) is live.
- Your job: build the **3 new files** that connect vivim to a running `opencode serve` process, pull its sessions/permissions/edits into those tables, and supervise the process.
- **Don't rebuild the backbone.** Don't re-migrate the schema. Don't touch `AgenticStoreImpl` contract signatures.
- This is **additive** and **off by default** (local-first principle — see §7). Sync your one boot-wire line with AGENT3 (who owns the memory block in `server/index.ts`).
- `opencode-client.ts` / `opencode-ingest.ts` do **NOT** yet exist — that is your real scope.

---

## 1. WHAT "OpenCode as a local model harness" means here
Per the human's direction: OpenCode runs as a **local `serve` process on your machine** — not a website, not a direct provider API like ChatGPT/Gemini. The model behind it may be a cloud API, but the *harness* (process, session, permission, file-edit tracking) is local and lands in vivim's local DB. That fits vivim's local-first model.

AGENT1 already owns `cap:agent:run` (the `opencode run` one-shot CLI surface). **You own the persistent `opencode serve` surface** — a different transport, no overlap. AGENT4 tests AGENT1's `cap:agent:run`; you are independent of both except you both touch OpenCode.

---

## 2. WHAT ALREADY EXISTS (verified — reuse, don't rebuild)

### 2.1 Prisma tables (`prisma/schema.prisma:2967-3037`) — ALL PRESENT
- `AgentSession` — `id, providerSessionId (unique), providerId (default "opencode"), parentSessionId, agentName, model, projectPath, status`. Relations: `parentSession`/`childSessions` (fork tree), `permissionDecisions`, `fileEdits`. Index `idx_as_session`.
- `AgentPermissionDecision` — `id, agentSessionId (FK cascade), providerPermissionId (unique), toolName, riskTier (1-5 → Node.securityLevel), requestedAt, respondedAt?, decision (allow|deny|allow_always), decidedBy?, payloadJson`. Index `idx_apd_session`.
- `AgentFileEdit` — `id, agentSessionId (FK cascade), messageId?, filePath, patchJson (RFC-6902 JSON Patch), beforeHash?, afterHash?`. Index `idx_afe_session`.
- `AgentDefinition` — `id, name (unique), mode (all|primary|subagent), permissionsJson, model?, systemPrompt?, version`. Index `idx_ad_name`.

> These are the **landing tables**. Your ingest writes into them. No migration needed.

### 2.2 Agentic backbone (AGENT5 — DONE)
- `AgenticStoreImpl` (`src/storage/impl/agentic-store-impl.ts`) implements `AgenticStoreContract`.
- 6 engines present: `governance-engine.ts`, `budget-engine.ts`, `objective-engine.ts`, `belief-store.ts`, `capability-binder.ts`, `agent-builder.ts`.
- `event-record-store.ts` — durable hash-chained outbox (`EventRecord`). This is your substrate for durable event capture.
- Wired in `src/server/index.ts:650-688` (MemoryFabric + AgentBuilderEngine). **Already boots.**

### 2.3 Agent chat-thread surface (AGENT5 Option C — LIVE)
Contract `src/storage/contracts/agentic-store.ts:215-239`:
```ts
startAgentConversation(actor, goal, opts?: {title?, agentId?})
  → { providerSessionId, conversationId }
appendAgentMessage(conversationId, msg: {role, text, blocks?, model?, authorDid?, stepId?})
  → { id }
getAgentMessages(conversationId, opts?: {limit?}) → unknown[]
linkStepToMessage(stepId, messageId) → void
```
Implemented in `agentic-store-impl.ts`. Reuses `ProviderSession`/`Conversation`/`ConversationMessage`/`StreamBlock`. **Use these for rendering an OpenCode session as a vivim chat thread** — don't invent a new message table.

### 2.4 Local-agent precedent (AGENT1 — reuse patterns, don't duplicate)
- `src/engines/local-agent/local-agent-executor.ts` — one-shot `opencode run` via `Bun.spawn`. **Governor Canon: must NOT import `ChromeGovernor`/`BunCdpClient`.** Parses output to `ContentBlock[]` via `StreamParserEngine` (`src/schema/streaming.ts`).
- `src/storage/impl/local-agent-store-impl.ts` — local-agent store.
- `LocalAgentProviderExecutor` already instantiated in `server/index.ts:616-621`.
> Your `opencode serve` client is a **different surface**; mirror AGENT1's spawn/parser discipline but don't collide with `cap:agent:run`.

---

## 3. YOUR DELIVERABLES (3 new files + tests)

### 3.1 `src/engines/opencode/opencode-client.ts`  ← NEW
- Connects to a **running** `opencode serve` (default `127.0.0.1`, port configurable; basic-auth via `OPENCODE_SERVER_PASSWORD`/`OPENCODE_SERVER_USERNAME`).
- Talks the `serve` HTTP API. Research plan area #4 enumerates endpoints: `POST /session`, `POST /session/:id/message`, `GET /event` (SSE), `POST /session/:id/prompt_async`. Get the live OpenAPI from `GET /doc` when implementing.
- Responsibilities: start/attach a session, send a prompt, subscribe to the SSE `/event` stream, map events → `ContentBlock[]` (reuse `StreamParserEngine` like AGENT1).
- **Readiness race**: `serve` may not be ready immediately — poll `/doc` or health until 200 before first call (research plan area #4).
- **Security guardrail**: bind `127.0.0.1` only; require password; **never** pass `--mdns`/`--cors *` (flips hostname to `0.0.0.0` — network exposure). Keep this localhost + password.

### 3.2 `src/engines/opencode/opencode-ingest.ts`  ← NEW
- Subscribes to the client's event stream and **ingests into the 4 landing tables** (§2.1):
  - session start → `AgentSession` (providerId=`opencode`, providerSessionId from serve).
  - tool/permission events → `AgentPermissionDecision` (map risk tier → `Node.securityLevel`).
  - diff/file events → `AgentFileEdit` (RFC-6902 `patchJson`, before/after hash).
  - message/step events → `appendAgentMessage(...)` (Option C) so the session renders as a vivim chat thread; link via `linkStepToMessage`.
  - durable capture → `EventRecord` (hash chain) via `EventRecordStore` so nothing is lost on restart.
- Peer provider id is **`opencode`** (matches `AgentSession.providerId` default). Do NOT reuse AGENT1's `cap:agent:run` path.

### 3.3 `src/engines/opencode/opencode-supervisor.ts`  ← NEW
- Supervises the `opencode serve` **subprocess** (separate supervisor from the Chrome fleet — it is NOT CDP/ChromeGovernor).
- Spawns `opencode serve --port <p> --hostname 127.0.0.1` with `OPENCODE_SERVER_PASSWORD` set; waits for readiness; restarts on crash (bounded retries); clean shutdown on `SIGTERM`.
- Exposes a handle so `opencode-client.ts` can reach the live port.
- **Default OFF.** Only starts when explicitly enabled (env flag or capability), keeping local-first intact.

### 3.4 `tests/integration/opencode/`  ← NEW
- `S1` — client connects to a mock/real `serve`, creates session, receives events, ingests into `AgentSession`/`AgentPermissionDecision`/`AgentFileEdit`.
- `S2` — ingest renders an OpenCode session as a vivim chat thread via Option C (`startAgentConversation`/`appendAgentMessage`/`getAgentMessages`).
- `S3` — supervisor boots `opencode serve`, readiness wait, clean shutdown.
- Validation gate (coordination plan line 44): `bun test tests/integration/opencode` → S1/S2/S3 pass.

---

## 4. RESEARCH YOU MUST CONSULT FIRST (research-first invariant)
The deep-research plan `.kilo/plans/1784416945191-opencode-deep-research-plan.md` is **research-only**. Before writing client code, read it — it defines the 10 verified areas you need:
- **#1** `--format json` event grammar (maps to `ContentBlock[]`).
- **#2** tool-use loop (gates permission/decision ingestion).
- **#4** `serve` HTTP API + auth + readiness (your client surface).
- **#5** ACP stdio (decide run vs acp vs serve — you picked serve).
- **#6** permission model (`allow|ask|deny`) — headless resolution under `--auto`.
- **#8** streaming / SSE framing (your `/event` parser).
- **#9** error/exit semantics (`EngineError` → `capability:failed`).

If the briefs in `docs/research/briefs/opencode-deep/` **do not exist yet**, that is expected — the research plan was never executed. You may need to either (a) do the minimal verification captures yourself (research plan T1–T12) in a **throwaway `--dir` scratch**, or (b) implement conservatively against the verified CLI facts already in the plan header (v1.17.15, free models, `--auto`, localhost serve). **Do not mutate repo-root `opencode.json`.**

---

## 5. COLLISION RULES (critical — reiterated from coordination plan)
- **`cap:agent:run` = AGENT1 only.** You use the separate `opencode serve` surface. No overlap.
- **`server/index.ts`**: AGENT3 owns the memory block (lines ~650-688). You may add **ONE additive supervisor boot line** — must sync with AGENT3 before editing. Do not restructure their block.
- **`agentic-store-*` / `prisma/schema.prisma` = AGENT5 done.** Nobody re-migrates. If you think you need a schema field, first ask — the 4 tables likely already cover it.
- **Governor Canon**: only `ChromeGovernor` touches CDP. Your supervisor manages `opencode serve`, a separate process. Zero CDP.
- **No new message tables**: reuse `ConversationMessage`/`StreamBlock` (Option C).
- **`EventRecord` hash chain** (`event-record-store.ts`): `H(prevHash || payloadJson)`, `seq` monotonic per source. Use it for durable ingest.

---

## 6. VALIDATION GATES (in order — coordination plan lines 40-45)
1. `bun test tests/integration/opencode` → S1/S2/S3 pass. **(yours)**
2. `bun test tests/integration/agentic` → 16 pass. **(re-confirm after you land — AGENT5's suite must stay green)**
3. `bun build src/server/index.ts` → exit 0 (runtime import check for your additive boot wiring).
4. `bun run devops verify-cross-surface` → 3548/3548 (after AGENT3 FR-05; you are NOT responsible for this number, but don't break it).
- **Do NOT run full `tsc`** unless the human asks. Trust `bun build` (esbuild strips types). Pre-existing errors elsewhere are out of scope.

---

## 7. LOCAL-FIRST GUARDRAIL (human's explicit concern)
- OpenCode is treated as a **local-process harness** (local `serve`, data lands in local DB). This is compatible with local-first.
- Your supervisor + client must be **OFF by default**. Enabling requires an explicit flag/capability.
- Never make vivim *depend* on OpenCode being up to boot or to serve other providers. It is an additive, opt-in surface.
- If you ever need a default-on behavior, STOP and ask the human — that would break local-first.

---

## 8. ANTI-WASTE CHECKLIST (do this, not that)
| DO | DON'T |
|----|-------|
| Reuse the 4 existing Prisma tables | Re-migrate schema or add new tables |
| Use Option C chat methods for thread rendering | Invent a new message table |
| Mirror AGENT1's `Bun.spawn` + `StreamParserEngine` discipline | Import `ChromeGovernor`/`BunCdpClient` (Governor Canon) |
| Bind `127.0.0.1` + password for `serve` | Use `--mdns`/`--cors *` (0.0.0.0 exposure) |
| Add ONE additive boot line, synced with AGENT3 | Restructure the memory block |
| Keep supervisor default-OFF | Make OpenCode required to boot |
| Test in throwaway `--dir` scratch | Mutate repo-root `opencode.json` |
| Verify against research plan areas #1/#4/#8 | Infer wire format from doc-derived inventories |

---

## 9. RELEVANT FILES / REFERENCES
- `.kilo/plans/1784479856654-agent-coordination-plan.md` — your execution order (step 5) + collision rules.
- `.kilo/plans/1784416945191-opencode-deep-research-plan.md` — research-only protocol truth (10 areas; T1–T12 tasks).
- `prisma/schema.prisma:2967-3037` — the 4 landing tables (verified present).
- `src/storage/contracts/agentic-store.ts:215-239` — Option C chat-thread contract (live).
- `src/storage/impl/agentic-store-impl.ts` — backbone store (do not change signatures).
- `src/engines/event-record-store.ts` — durable hash-chained outbox (your ingest substrate).
- `src/engines/local-agent/local-agent-executor.ts` — AGENT1 precedent (spawn/parser discipline).
- `src/server/index.ts:599-688` — autonomous + memory-fabric wiring (your additive line goes here, synced w/ AGENT3).
- `src/engines/agentic/*` — 6 backbone engines (reference only).
- `AGENT5.md` — foundation status (backbone + Option C verified complete).
- `tests/integration/agentic/backbone.test.ts` — pattern reference for your `tests/integration/opencode/`.

## 10. HANDOFF
When done: report S1/S2/S3 pass, the additive boot line location, and confirm default-OFF + localhost-only. **Do NOT commit** unless the human explicitly asks.
