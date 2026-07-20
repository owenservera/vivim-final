# Hermes → vivim-final Memory Harvest Strategy

> **Status:** Design / Pre-implementation
> **Scope:** Harvest agentic-memory-system patterns from `NousResearch/hermes-agent`
> (cloned at `.clones/hermes-agent`) and wire them into vivim-final, grounded in
> the **real** vivim substrate (Node-layer v2 + BeliefStore + KnowledgeExtractor
> + CrossConversationSynthesis + SemanticSearch + MemoryCuratedStore).
> **Date:** 2026-07-19

---

## 0. Purpose & Ground Truth

vivim-final already has a deeper memory substrate than Hermes in some respects
(Node-layer v2 with version chains, ACU provenance, BeliefStore world-model,
KnowledgeExtractor fact/entity/decision extraction). What Hermes has that vivim
**lacks** is *operational discipline around memory*: cache-stable injection,
streaming context scrubbing, background-serialized sync with bounded drain,
the one-backend guard, and a provenance-rich write-bridge.

This document is the harvest plan. It does **not** propose replacing vivim's
Node graph with Hermes's file-backed model. It proposes porting Hermes's
*operational invariants* onto vivim's existing contracts.

### 0.1 Vivim truth map (verified files)

| Vivim capability | File | What it already provides |
|---|---|---|
| Universal node store + time travel | `src/storage/contracts/node-store.ts` | `putNode`, `updateNode` (bumps `version`), `getNodeAtVersion`, `getNodeHistory`, `putEdge`/`getOutgoingEdges`/`getIncomingEdges`, ACU fields (`contentHash`, `state`, `securityLevel`, `authorDid`, `signature`, `aclJson`, `qualityJson`, `validFrom`/`validUntil`, `parentVersion`) |
| Versioned mutable world-model | `src/engines/belief-store.ts` | `putBelief`/`updateBelief`/`retract`, `BELIEVES` edge, `getNodeHistory` time travel |
| Fact / entity / decision extraction | `src/storage/contracts/knowledge-extractor-store.ts` | `createEntity`, `createEntityMention`, `createDecision`, `createPattern`, `findEntityByName` |
| Cross-conversation synthesis | `src/storage/contracts/cross-conversation-synthesis-store.ts` | `getFactsForConversation`, `getDecisionsForConversation`, `getEntitiesForConversation` |
| Semantic / vector recall | `src/storage/contracts/semantic-search-store.ts` | `upsertEmbedding`, `searchByEmbedding(threshold, limit)` |
| Curated memory (pin/hide/merge) | `src/storage/contracts/memory-curated-store.ts` | `upsert`, `setPinned`, `setVerified`, `list` |
| Capability injection (current) | `src/engines/capability-snapshot.ts`, `src/engines/context-assembly.ts` | boot snapshot + context assembly |

### 0.2 Hermes source map (verified files)

| Hermes pattern | File | LOC |
|---|---|---|
| `MemoryProvider` ABC (extension contract) | `agent/memory_provider.py` | 315 |
| `MemoryManager` (orchestrator) | `agent/memory_manager.py` | 1231 |
| Built-in `memory` tool (frozen snapshot) | `tools/memory_tool.py` | 1152 |
| Provider plugins | `plugins/memory/{honcho,mem0,supermemory,byterover,hindsight,holographic,openviking,retaindb}/` | — |

---

## 1. Key Decisions (the "what we accept / reject" ledger)

| # | Decision | Rationale | Grounded in |
|---|---|---|---|
| D1 | **Do NOT adopt Hermes's file-backed `MEMORY.md`/`USER.md` model.** vivim's Node graph is the single source of truth. | vivim already has `captureAsNode()` + `recordMemory()`; re-introducing flat files would fork the source of truth and break ACU provenance. | `node-store.ts` ACU fields |
| D2 | **Adopt the `MemoryProvider` ABC as a `MemoryBackend` interface** in TypeScript, scoped to external backends only. Built-in Node-graph memory is the always-on "builtin" backend. | Hermes proved one stable contract beats N bespoke integrations; vivim's Store-Contracts invariant already forbids engines touching `impl/`. | `AGENTS.md` Store Contracts invariant; `memory_provider.py` |
| D3 | **Enforce the one-external-backend guard** (`addBackend` rejects a 2nd external). | Prevents tool-schema bloat + conflicting writes. Maps to vivim's "Governor Canon / Store Contracts" single-source discipline. | `memory_manager.py:394` `add_provider` |
| D4 | **Adopt cache-stable injection (frozen snapshot).** Capability/context assembly must inject memory once at session start; mid-session writes persist to Node graph but DO NOT rebuild the injected prefix until next session (or explicit `--now`). | Hermes's "prompt caching is sacred" invariant; vivim's `context-assembly.ts` already assembles context — add a stable snapshot boundary. | `memory_tool.py:11-14`; AGENTS.md cache rule |
| D5 | **Adopt `StreamingContextScrubber`** to sanitize streamed memory blocks at chunk boundaries before they hit UI slots. | Memory injected into the chat stream must never leak raw `<memory-context>` fence to the user. vivim's frontend slots (`chat.actionBar` etc.) have no such guard today. | `memory_manager.py:172` `StreamingContextScrubber` |
| D6 | **Adopt background single-worker FIFO sync + bounded drain shutdown** for all external-backend writes. | A wedged Mem0/Hindsight call must never stall a vivim turn (Hermes observed 298s hangs). vivim runs sync inline today. | `memory_manager.py:688` `_submit_background` |
| D7 | **Adopt the `on_memory_write` provenance bridge** — mirror built-in Node-graph memory writes to external backends with metadata (`writeOrigin`, `executionContext`, `sessionId`, `platform`, `toolName`). | vivim's `recordMemory()` emits `cap-store.memory` Nodes but doesn't fan out to a provider graph with provenance. | `memory_manager.py:1009` `on_memory_write` |
| D8 | **Adopt `bank_id_template` scoping** (`{profile}/{workspace}/{user}/{session}`) for external-backend isolation. | vivim is multi-profile; capabilities must not cross-contaminate memory banks. | `plugins/memory/hindsight/README.md` `bank_id_template` |
| D9 | **Reject new in-tree backends.** External memory backends ship as standalone modules discovered at runtime, never hardcoded in core engines. | Matches Hermes May-2026 policy + vivim's "plugins live in own dir / widen generic surface" rule. | `AGENTS.md` Plugins policy |
| D10 | **Adopt skill-scaffolding stripping** before memory writes — recover the user's actual instruction, not the expanded skill body. | vivim's NLCL/capability system expands skills into prompts; feeding that verbatim pollutes memory. | `memory_manager.py:497` `_strip_skill_scaffolding` |

---

## 2. Target Architecture (vivim-wired)

```
┌─────────────────────────────────────────────────────────────────┐
│  AIAgent-equivalent (conversation-manager.ts / agentic-loop.ts)   │
└───────────────┬─────────────────────────────────────────────────┘
                │  sync_turn / prefetch / on_session_end
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  MemoryOrchestrator  (NEW: src/engines/memory-orchestrator.ts)    │
│  - registerBackend()  (one external + builtin NodeBackend)        │
│  - prefetchAll(query)  → injected via context-assembly (frozen)   │
│  - syncAll(turn)       → single-worker FIFO executor (D6)         │
│  - notifyMemoryWrite() → provenance bridge (D7)                   │
│  - scrubStream()       → StreamingContextScrubber (D5)            │
│  - shutdownAll()       → bounded drain (D6)                        │
└───┬───────────────────────────┬─────────────────────────────────┘
    │                            │
    ▼                            ▼
┌──────────────────┐   ┌──────────────────────────────────────────┐
│ NodeBackend       │   │ ExternalBackend (MemoryBackend interface) │
│ (builtin, always) │   │ mem0 / hindsight / honcho / custom        │
│                  │   │ - isolated by bank_id_template (D8)        │
│ writes to:       │   │ - discovered at runtime (D9)               │
│  NodeStore        │   │                                            │
│  BeliefStore      │   └──────────────────────────────────────────┘
│  KnowledgeExtractor│
│  SemanticSearch   │
│  MemoryCuratedStore│
└──────────────────┘
```

**Difference from Hermes:** vivim has *no separate builtin file store*. The
"builtin" backend IS the Node graph. So `NodeBackend` wraps `node-store.ts` +
`belief-store.ts` + `knowledge-extractor-store.ts` + `semantic-search-store.ts`
behind the same `MemoryBackend` interface, making it the canonical first
provider. External backends are optional add-ons.

---

## 3. The `MemoryBackend` Interface (port of `MemoryProvider`)

```ts
// src/engines/memory/memory-backend.ts
export interface MemoryBackend {
  readonly name: string                 // 'node' | 'mem0' | 'hindsight' | ...

  isAvailable(): boolean               // config + deps only, NO network
  initialize(sessionId: string, ctx: BackendInitContext): Promise<void>
  systemPromptBlock(): string          // static text for context assembly
  prefetch(query: string, opts: { sessionId: string }): Promise<string>
  queuePrefetch(query: string, opts: { sessionId: string }): void
  syncTurn(args: {
    userContent: string
    assistantContent: string
    sessionId: string
    messages?: unknown[]
  }): void
  getToolSchemas(): ToolSchema[]        // OpenAI function-calling format
  handleToolCall(name: string, args: Record<string, unknown>): Promise<string>

  // optional hooks
  onTurnStart?(turn: number, message: string): void
  onSessionEnd?(messages: unknown[]): void
  onSessionSwitch?(next: { sessionId: string; parentSessionId?: string; reset?: boolean; rewound?: boolean }): void
  onPreCompress?(messages: unknown[]): string
  onMemoryWrite?(action: 'add' | 'replace' | 'remove', target: string, content: string, metadata?: Record<string, unknown>): void
  backupPaths?(): string[]
  shutdown(): void
}

export interface BackendInitContext {
  hermesHome: string                    // → vivim: getHermesHome() equivalent / dataDir
  profile: string
  workspace: string
  platform: string
  userId?: string
  agentContext: 'primary' | 'subagent' | 'cron' | 'flush'
}
```

Reserved core-tool-name rejection (D3 analogue): `MemoryOrchestrator` drops any
backend tool whose name collides with a vivim `UnifiedCapability` slug.

---

## 4. Methods / Implementation Plan

### Phase A — Orchestrator skeleton (no external backend yet)
**Files:** `src/engines/memory/memory-orchestrator.ts`, `memory-backend.ts`
1. Port `normalizeToolSchema` (handles already-wrapped OpenAI entries) — `memory_manager.py:50`.
2. Port `addBackend` with one-external guard (D3) — `memory_manager.py:394`.
3. Port `buildSystemPrompt` fan-out — `memory_manager.py:476`.
4. Wire `NodeBackend` as the builtin (wraps existing stores).

### Phase B — Cache-stable injection (D4)
**Files:** `src/engines/context-assembly.ts`, `memory-orchestrator.ts`
1. `MemoryOrchestrator.snapshotForSession(sessionId)` builds the frozen memory
   block once at session start (calls `prefetchAll` + reads pinned `cap-store.memory`
   Nodes via `MemoryCuratedStore`).
2. `context-assembly.ts` injects the snapshot as a stable prefix. Mid-session
   `NodeBackend.syncTurn` writes to Node graph but does NOT rebuild the prefix.
3. Deferred-invalidation rule (from AGENTS.md): memory-affecting slash commands
   default to next-session; opt-in `--now` rebuilds.

### Phase C — Streaming scrubber (D5)
**Files:** `src/engines/memory/streaming-context-scrubber.ts`
1. Port `StreamingContextScrubber` state machine verbatim (chunk-boundary safe,
   holds partial `<memory-context>` tails). `memory_manager.py:172`.
2. Integrate into the harness-executor / frontend slot render path so streamed
   memory blocks are stripped before UI display.

### Phase D — Background serialized sync + bounded drain (D6)
**Files:** `src/engines/memory/background-sync.ts`
1. Port single-worker `DaemonThreadPoolExecutor` (daemon, max_workers=1) — FIFO
   so turn N lands before N+1. `memory_manager.py:726`.
2. Port `_SYNC_DRAIN_TIMEOUT_S = 5.0` + `_EXTERNAL_PREFETCH_TIMEOUT_S = 8.0`.
3. Port `shutdownAll` bounded drain that abandons wedged work and reports
   `abandoned_writes`/`abandoned_prefetches`. `memory_manager.py:1134`.

### Phase E — Provenance write-bridge (D7)
**Files:** `src/engines/memory/orchestrator.ts` `notifyMemoryWrite`
1. Port `notify_memory_tool_write` gating (success + not staged). `memory_manager.py:1045`.
2. Build metadata `{ writeOrigin, executionContext, sessionId, parentSessionId, platform, toolName, oldText? }`.
3. Fan out to external backends' `onMemoryWrite`. Hook into `recordMemory()` in
   `MemoryEngine` so every `cap-store.memory` Node emission mirrors out.

### Phase F — Skill-scaffolding stripping (D10)
**Files:** `src/engines/memory/orchestrator.ts` `_stripSkillScaffolding`
1. Port `extract_user_instruction_from_skill_message` analogue — recover user
   instruction from expanded NLCL/capability prompt before feeding memory.

### Phase G — External backend isolation + discovery (D8, D9)
**Files:** `src/engines/memory/backends/*`, discovery in `capability-bootstrap.ts`
1. `bank_id_template` scoping → backend resolves bank from `{profile,workspace,user,session}`.
2. Discovery: external backends register via the existing plugin/discovery path,
   never hardcoded. First real backend to port as reference: **hindsight**
   (knowledge-graph + entity resolution maps cleanly onto vivim's
   `knowledge-extractor-store.ts`).

### Phase H — Session-rotation ordering (from Hermes #16454 fix)
**Files:** `src/engines/memory/orchestrator.ts` `commitSessionBoundaryAsync`
1. Port: `onSessionEnd` (LLM extraction) strictly BEFORE `onSessionSwitch`
   rebinding, as one FIFO task. `memory_manager.py:867`.

---

## 5. Tests (grounded, behavior-not-snapshot)

Per AGENTS.md, tests assert *invariants*, never frozen values. Target files:

| Test | Asserts |
|---|---|
| `tests/unit/engines/memory/orchestrator.test.ts` | registering a 2nd external backend is rejected (D3); builtin `node` always coexists |
| `tests/unit/engines/memory/streaming-scrubber.test.ts` | a `<memory-context>` split across 2 deltas is fully stripped; unterminated span at EOF is dropped |
| `tests/unit/engines/memory/background-sync.test.ts` | a backend whose `syncTurn` sleeps 30s does NOT block `syncAll` return; shutdown drains ≤ 5s then abandons |
| `tests/unit/engines/memory/notify-bridge.test.ts` | a `staged:true` memory result is NOT mirrored; `success:false` is NOT mirrored; provenance metadata carries `sessionId` |
| `tests/unit/engines/memory/snapshot.test.ts` | mid-session `syncTurn` does NOT change the frozen injected block (cache-stable, D4) |
| `tests/integration/engines/memory/node-backend.test.ts` | `NodeBackend.syncTurn` writes a `cap-store.memory` Node + `BELIEVES` edge + embedding, all via Store Contracts (no `impl/`) |

All tests use the existing fixture DB pattern (`DATABASE_URL=file:./tests/fixtures/node-store-test.db`).

---

## 6. Risks & Guardrails

| Risk | Guard |
|---|---|
| External backend wedges the turn | D6 background FIFO + daemon threads + 5s drain |
| Memory leaks to UI via streamed fences | D5 `StreamingContextScrubber` on every slot render path |
| Two backends fight over writes | D3 one-external guard at `addBackend` |
| Cache invalidation mid-session spikes cost | D4 frozen snapshot; `--now` opt-in only |
| Provenance provenance lost on mirror | D7 gating + metadata schema |
| Backend pollutes core toolset | reserved capability-slug collision drop |
| In-tree backend creep | D9 standalone-module policy, enforced in review |

---

## 7. Out-of-Scope (explicit non-goals)

- Replacing the Node graph with files (rejected, D1).
- Porting Hermes's `honcho` dialectic Q&A or `mem0` cloud specifics — those are
  backend *implementations*, pluggable later under the interface.
- Changing the ACU provenance model — we extend it, we don't rewrite it.

---

## 8. Suggested Execution Order

```
A (skeleton + NodeBackend)  →  B (cache-stable)  →  C (scrubber)
   →  D (bg sync)  →  E (bridge)  →  F (skill strip)
      →  H (session rotation)  →  G (external backend + hindsight ref port)
```

Each phase is independently shippable and test-covered. Phases A–F require no
external dependency and deliver the majority of the operational-value harvest.
Phase G is where a real second backend lands, proving the interface end-to-end.
