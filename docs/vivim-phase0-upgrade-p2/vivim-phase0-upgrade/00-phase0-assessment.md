# Phase 0 — Surgical Gap Assessment & Implementation Plan

> **Status:** READY FOR IMPLEMENTATION | **Date:** 2026-08-02
> **Author:** Vivim Architecture Team | **Version:** 1.0

---

## 1. Executive Summary

The Vivim codebase has evolved significantly beyond the original Phase 14-20 upgrade design. An assessment of all 27 engine files (11,182 lines) reveals that **most engines are already implemented with real code**, not stubs. The original upgrade docs (merged-design-v2/upgrade/) were written when the codebase was largely stub-based. Today, the gap is narrow and surgical.

**Phase 0** is therefore a **precision gap-close** operation — not a ground-up build. It targets the 9 specific stub methods, 2 missing DB-backed features, 3 missing server routes, and 2 missing schema models that prevent the full system from being production-ready.

---

## 2. Current State Assessment

### 2.1 Engine Inventory (27 files, 11,182 lines)

| Engine | Lines | Status | Stub Methods |
|--------|-------|--------|--------------|
| chrome-governor.ts | 1,390 | ✅ COMPLETE | None |
| autonomous-execution.ts | 1,459 | ✅ COMPLETE | None |
| conversation-manager.ts | 1,056 | ✅ COMPLETE | None |
| context-assembly.ts | 617 | ⚠️ PARTIAL | `recall()` → empty `conversation_history` layer |
| workflow-engine.ts | 560 | ✅ COMPLETE | None |
| provider-mux.ts | 551 | ✅ COMPLETE | None |
| stream-parser.ts | 554 | ✅ COMPLETE | None |
| memory-engine.ts | 664 | ⚠️ PARTIAL | 6 methods: `getTopics()`, `getProjects()`, `recordEntity()`, `recordDecision()`, `recordPattern()`, `assignTopic()` |
| situation-detector.ts | 409 | ✅ COMPLETE | None |
| capability-event-bus.ts | 322 | ✅ COMPLETE | None |
| cdp-transport.ts | 331 | ✅ COMPLETE | None |
| conversation-router.ts | 369 | ✅ COMPLETE | None |
| knowledge-ingestion.ts | 328 | ✅ COMPLETE | None |
| harness-runtime.ts | 295 | ⚠️ PARTIAL | `evaluateCondition()` (partial), `precondition` node (no-op) |
| router.ts | 205 | ✅ COMPLETE | None |
| unified-registry.ts | 213 | ✅ COMPLETE | None |
| knowledge-extractor.ts | 247 | ✅ COMPLETE | None |
| execution-policy.ts | 233 | ✅ COMPLETE | None |
| export.ts | 192 | ⚠️ PARTIAL | `importJson()` counts but doesn't write |
| telemetry-audit.ts | 169 | ✅ COMPLETE | None |
| sync.ts | 173 | ✅ COMPLETE | None |
| agentic-loop.ts | 222 | ✅ COMPLETE | None |
| plugin-hot-reload.ts | 136 | ✅ COMPLETE | None |
| airgap.ts | 131 | ✅ COMPLETE | None |
| semantic-search.ts | 110 | ⚠️ PARTIAL | `reindexAll()` (no-op), `searchHybrid()` (delegates to `search()`) |
| encryption.ts | 109 | ✅ COMPLETE | None |
| ids.ts | 51 | ✅ COMPLETE | None |

### 2.2 Schema Gap Analysis

The Prisma schema (2,002 lines) already contains:

- **L0:** SchemaMeta, MigrationLog ✅
- **L1:** Provider Knowledge Graph (9 models) ✅
- **L2:** Trace (TraceEntry) ✅
- **L3:** Conversations (Conversation, ConversationMessage, StreamBlock) ✅
- **L4:** Sessions (ProviderSession) ✅
- **L5:** Manifest Versioning (3 models) ✅
- **L6:** Capabilities (5 models) ✅
- **L7:** Telemetry (4 models) ✅
- **L8:** Memory (EpisodicMemory, SemanticMemory, ProceduralRule) ✅
- **L9:** Macros (CapabilityMacro) ✅
- **L10:** Routing (RouteSpec, RouteTarget, RouteRequest, RouteEvent) ✅
- **L11:** Health (5 models) ✅
- **L12:** Learning (LearningEvent, TransferPattern) ✅

**Missing from the upgrade design:**

| Model | Design Doc | Status | Priority |
|-------|-----------|--------|----------|
| `Entity` | 05 (Memory) | ❌ MISSING | P1 |
| `EntityMention` | 05 (Memory) | ❌ MISSING | P1 |
| `DecisionRecord` | 05 (Memory) | ❌ MISSING | P1 |
| `PatternExtract` | 05 (Memory) | ❌ MISSING | P1 |
| `Topic` | 05 (Memory) | ❌ MISSING | P1 |
| `Project` | 05 (Memory) | ❌ MISSING | P1 |
| `ConversationTopic` | 05 (Memory) | ❌ MISSING | P1 |
| `UserPreference` | 05 (Memory) | ❌ MISSING | P1 |
| `ImportJob` | 05 (Memory) | ❌ MISSING | P1 |
| `MemoryEmbedding` | 05 (Memory) | ❌ MISSING | P1 |
| `MuxSession` | 06 (Muxing) | ❌ MISSING | P2 |
| `MuxResponse` | 06 (Muxing) | ❌ MISSING | P2 |
| `RoutingPreference` | 06 (Muxing) | ❌ MISSING | P2 |
| `ContextLayer` | 07 (Context) | ❌ MISSING | P2 |
| `SituationLog` | 07 (Context) | ❌ MISSING | P2 |
| `AutonomousTask` | 08 (Autonomous) | ❌ MISSING | P2 |
| `AutonomousStep` | 08 (Autonomous) | ❌ MISSING | P2 |
| `HitlGate` | 08 (Autonomous) | ❌ MISSING | P2 |
| `SyncPeer` | 09 (Sovereign) | ❌ MISSING | P3 |
| `SyncLog` | 09 (Sovereign) | ❌ MISSING | P3 |
| `NetworkCallRecord` | 09 (Sovereign) | ❌ MISSING | P3 |

### 2.3 Server Route Gap Analysis

**Existing routes** (conversation-router.ts): providers, conversations, messages, capabilities, fleet, session, config, health, mirror, sandbox — all implemented.

**Missing from the upgrade design:**

| Route Group | Endpoints | Priority |
|-------------|-----------|----------|
| `/api/knowledge/*` | 12 endpoints (ingest, search, entities, decisions, topics, export) | P1 |
| `/api/context/*` | 2 endpoints (assemble, situation) | P2 |
| `/api/route/*` | 6 endpoints (auto, mux, fanout, cost-report, preferences) | P2 |
| `/api/autonomous/*` | 8 endpoints (execute, status, cancel, replay, gates) | P2 |
| `/api/export/*` | 3 endpoints (full, conversations, memory) | P3 |
| `/api/airgap/*` | 3 endpoints (status, enable, disable) | P3 |
| `/api/sync/*` | 5 endpoints (peers, pair, confirm, now, revoke) | P3 |
| `/api/audit/*` | 1 endpoint (network) | P3 |
| `/api/workspace/*` | 3 endpoints (mode, panels) | P3 |
| `/api/memory/*` | 5 endpoints (graph, timeline, stats, curated, edit) | P3 |
| `/api/plugins/*` | 4 endpoints (list, install, remove, reload) | P3 |

---

## 3. Phase 0 Definition

Phase 0 is the **minimum viable upgrade** that closes all P1 gaps and sets the foundation for P2/P3. It is designed to be:

1. **Non-breaking** — no existing APIs or engines change their signatures
2. **Future-proof** — schema and store contracts anticipate all P2/P3 models
3. **Verifiable** — each unit has a test contract that can be run immediately

### 3.1 Phase 0 Scope

| Unit | Name | What It Does | Depends On |
|------|------|-------------|------------|
| 0.1 | Schema: Memory Intelligence Tables | Add 10 new Prisma models (Entity, EntityMention, DecisionRecord, PatternExtract, Topic, Project, ConversationTopic, UserPreference, ImportJob, MemoryEmbedding) | None |
| 0.2 | Store: Memory Intelligence | Implement store methods for all 10 new models | 0.1 |
| 0.3 | MemoryEngine: Complete 10-Type | Wire `recordEntity()`, `recordDecision()`, `recordPattern()`, `getTopics()`, `getProjects()`, `assignTopic()` to real DB storage | 0.2 |
| 0.4 | ContextAssembly: Complete RECALL | Wire `conversation_history` layer to real conversation store query | 0.2 |
| 0.5 | SemanticSearch: Complete | Implement `reindexAll()` and `searchHybrid()` with real hybrid logic | 0.2 |
| 0.6 | HarnessRuntime: Complete Preconditions | Implement `evaluateCondition()` for all condition types and `precondition` node execution | None |
| 0.7 | ExportEngine: Complete Import | Wire `importJson()` to actually write rows back to DB | 0.1 |
| 0.8 | Server Routes: Knowledge API | Add 12 knowledge endpoints to server | 0.3, 0.5 |
| 0.9 | Seed Data: Memory Intelligence | Seed data for Entity, Topic, Project, UserPreference | 0.1 |
| 0.10 | Migration Script | Generate and test Prisma migration for all new models | 0.1 |

### 3.2 What Phase 0 Does NOT Include

These are deferred to Phase 1+ (P2/P3) but are architecturally accommodated:

- MuxSession/MuxResponse/RoutingPreference tables (Phase 1)
- AutonomousTask/Step/HitlGate tables (Phase 1)
- ContextLayer/SituationLog tables (Phase 1)
- SyncPeer/SyncLog/NetworkCallRecord tables (Phase 2)
- All P2/P3 server routes (Phase 1/2)
- Workspace modes UI (Phase 2)
- Plugin marketplace (Phase 2)

---

## 4. Dependency Graph

```
0.1 (Schema) ─────────────────────────────────────┐
  │                                                │
  ├→ 0.2 (Store) ─┬→ 0.3 (MemoryEngine) ─→ 0.8 (Knowledge API)
  │               ├→ 0.4 (ContextAssembly)         │
  │               └→ 0.5 (SemanticSearch) ─────────┘
  │
  ├→ 0.7 (ExportEngine Import)
  ├→ 0.9 (Seed Data)
  └→ 0.10 (Migration Script)

0.6 (HarnessRuntime) — independent, can run in parallel
```

### Execution Order

```
Wave A (parallel): 0.1, 0.6
Wave B (parallel): 0.2, 0.9, 0.10
Wave C (parallel): 0.3, 0.4, 0.5, 0.7
Wave D: 0.8
```

Total estimated effort: **~3-4 days** for a single developer.

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Schema migration breaks existing data | Low | High | All new models are additive; no column changes to existing tables |
| MemoryEngine stub methods have callers that depend on `[]` returns | Medium | Medium | Add feature flag `memoryV2: true` to gate new behavior; callers can migrate incrementally |
| `reindexAll()` on large datasets causes performance issues | Medium | Low | Run in batches of 100; add progress callback; rate-limit to 10 req/s |
| `searchHybrid()` SQL LIKE scan is slow on large tables | Low | Medium | Use FTS5 virtual table for keyword search; fallback to LIKE for small datasets |
| Import job conflicts with concurrent conversation writes | Low | Medium | Use SQLite WAL mode (already configured) + optimistic locking on ImportJob |

---

## 6. Success Criteria

Phase 0 is complete when:

1. **All 10 new Prisma models** exist and migration applies cleanly
2. **All 6 MemoryEngine stub methods** now read/write to real DB tables
3. **ContextAssembly RECALL** returns populated `conversation_history` layer
4. **SemanticSearch** `reindexAll()` and `searchHybrid()` work with real data
5. **HarnessRuntime** `evaluateCondition()` handles all condition types
6. **ExportEngine** `importJson()` writes rows back to DB
7. **12 knowledge API endpoints** return correct responses
8. **Seed data** populates at least 3 entities, 2 topics, 1 project
9. **All existing tests** still pass (no regressions)
10. **New test contracts** pass for each unit

---

## 7. Future-Proofing Decisions

These decisions in Phase 0 ensure smooth Phase 1/2 upgrades:

1. **Schema namespaces** — New models use `@@map("memory_entity")` prefix pattern so Phase 1 mux/autonomous tables can use `mux_*` / `autonomous_*` prefixes without collision
2. **Store interface** — All store methods return `Promise<T>` (async) even if current impl is sync, so Phase 1 can swap to PostgreSQL without signature changes
3. **Event bus events** — All new events follow the `{type: 'domain:action', ...}` pattern, matching the existing CapabilityEventBus contract
4. **ID generation** — All new rows use `newId()` from `ids.ts` (ULID), not auto-increment or UUIDv4
5. **Encryption awareness** — `MemoryEmbedding.vector` column is `String` (base64-encoded Float32Array) rather than `Bytes`, so the EncryptionEngine can encrypt it transparently in Phase 2
6. **Soft delete** — All new models include `isDeleted Int @default(0)` for future trash/restore functionality
7. **Timestamps** — All new models use `BigInt` for `createdAt`/`updatedAt` (epoch millis), matching existing convention
