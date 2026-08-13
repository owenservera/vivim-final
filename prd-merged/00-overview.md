# VIVIM-FINAL Enhanced PRD & Implementation Plans

**Status:** Truth-Grounded  
**Date:** 2026-08-13  
**Scope:** Merge of intelligence-pack-acu-dcb-storage + COMPLETE UPGRADE PACKAGE  
**Grounding:** Verified against live source tree (`src/`, `prisma/`, `frontend/`)

---

## Executive Summary

This document set provides clean, truth-grounded Product Requirements Documents (PRDs) and implementation plans for enhancing vivim-final with capabilities from the intelligence pack and upgrade package. 

**Key Finding:** Roughly 60% of proposed features already exist in vivim-final under different names. The highest-value work is implementing the ~8 genuinely missing capabilities in the repo's own style, not porting the pack wholesale.

**Implementation Strategy:** Phased approach targeting maximal value/effort ratio, reusing existing infrastructure (engines, contracts, patterns).

---

## Document Structure

| Document | Purpose | Scope |
|----------|---------|-------|
| **00-overview.md** | This file | Executive summary and navigation |
| **01-message-deduplication.md** | Message identity dedup | M1: SHA256-based message deduplication |
| **02-message-metadata.md** | Pin/archive/readStatus | M5+M6: Message metadata + CRUD APIs |
| **03-collections-system.md** | Collections system | M2: Collection management |
| **04-lifecycle-compaction.md** | TTL + compaction | M3+M4: Lifecycle management + database compaction |
| **05-fsrs-scheduler.md** | FSRS-6 review scheduler | M8: Spaced repetition review scheduling |
| **06-frontend-enhancements.md** | Frontend UI | M7: Pin/archive/collection UI components |

---

## Current State Analysis

### Already Implemented (Do NOT Re-implement)

| Capability | Location | Evidence |
|------------|----------|----------|
| DCB profiles (8 profiles) | `src/engines/dcb-profile.ts` | All 8 profiles + layer matrix |
| 5-stage context assembly | `src/engines/context-assembly.ts` | DETECT→RECALL→RANK→BUDGET→INJECT pipeline |
| Budget decay over time | `src/engines/cortex-budget.ts` | Decay logic present |
| Recency-decay scoring | `src/engines/dcb-projector.ts` | `recencyDecay(secs)` |
| ACU-provenance fields on Node | `prisma/schema.prisma` line 767 | `contentHash`, `version`, `state`, `securityLevel`, etc. |
| Node capture on every message | `src/engines/conversation-manager.ts::captureAsNode` | Forks edges, sets metadata |
| Message → ContentUnit decomposition | `src/engines/content-unit-decomposer.ts` | Called at conversation-manager.ts:593, 950 |
| Memory-as-Node with FSRS-6 initial state | `src/engines/memory-engine.ts::recordMemory` | Emits Nodes with FSRS-6 fields |
| Memory consolidation + decay | `src/engines/memory-engine.ts` lines 478–514 | `decayDays: 30`, `decayFactor: 0.9` |
| Entity extraction / links / mentions | `prisma/schema.prisma` lines 2015, 2034, 2666, 2684 | Tables exist |
| Topic / project organization | `prisma/schema.prisma` lines 2080, 2092, 2104 | Tables + organizer engine |
| Content hashing / dedup key derivation | `src/ids.ts` | SHA-256 content hash + FNV-1a |
| Storage relocation (WAL, move, backup) | `src/engines/backup-scheduler.ts` | Relocation engine + routes |
| Memory persistence + access control | `prisma/schema.prisma` lines 2704, 2721 | Tables exist |

### Missing Capabilities (The Genuine Gap)

| ID | Capability | Status | Priority |
|----|------------|--------|----------|
| M1 | Message identity dedup (SHA256) | Missing | High |
| M2 | Collections system | Missing | Medium |
| M3 | TTL/lifecycle on ConversationMessage & Node | Missing | Medium |
| M4 | Compaction/vacuum engine | Missing | Medium |
| M5 | Pin/archive/readStatus on ConversationMessage | Missing | Medium |
| M6 | Update APIs for messages/nodes | Missing | Medium |
| M7 | Frontend pin/archive/collection UI | Missing | Low |
| M8 | FSRS-6 review scheduler | Partial | Medium |

---

## Recommended Implementation Order

Ordered by value/effort and sequenced to reuse existing infrastructure.

### Phase 1: Foundation (M1) - **Week 1**
**Goal:** Message identity deduplication  
**Value:** Highest immediate value (idempotency)  
**Effort:** Small  
**Schema:** Add `providerMessageId String?` + `identityHash String? @unique` to `ConversationMessage`  
**Code:** Compute identity hash via `src/ids.ts` SHA-256 at write time in `conversation-manager.ts`  
**API:** Upsert instead of duplicate on re-send

### Phase 2: Message Metadata (M5+M6) - **Week 2**
**Goal:** Pin/archive/readStatus + CRUD APIs  
**Value:** High value for message management  
**Effort:** Medium  
**Schema:** Add `isPinned Int`, `isArchived Int`, `readStatus String` to `ConversationMessage`  
**Code:** Extend `node-router.ts` / `conversation-router.ts` with `PATCH /api/conversations/:id/messages/:mid`  
**Engine:** Extend `ConversationStore` contract (no new engine needed)

### Phase 3: Collections System (M2) - **Week 3-4**
**Goal:** Collection management  
**Value:** Medium value for organization  
**Effort:** Medium  
**Schema:** New `Collection` + `CollectionItem` models  
**Code:** New `collection-engine.ts`; `GET/POST/PATCH/DELETE /api/collections` routes  
**Integration:** Wire into catalog/UI slots

### Phase 4: Lifecycle + Compaction (M3+M4) - **Week 5-6**
**Goal:** TTL lifecycle + database compaction  
**Value:** Medium value for storage optimization  
**Effort:** Medium-Large  
**Schema:** Add `expiresAt BigInt?`, `isEphemeral Int`, `ttlSeconds Int?` to `ConversationMessage` and `Node`  
**Code:** New `lifecycle-engine.ts` for sweeping expired rows and triggering `VACUUM`-aware compaction  
**Integration:** Register as boot service; expose `POST /api/storage/compact`

### Phase 5: FSRS-6 Scheduler (M8) - **Week 7**
**Goal:** Spaced repetition review scheduling  
**Value:** Medium value for memory optimization  
**Effort:** Medium  
**Schema:** Add `dueAt BigInt`/`reviewCount Int` to Memory-related Node metadata  
**Code:** Compute next interval in `memory-engine.ts` retrieval path (not a new engine)  
**API:** Surface "due memories" via `memory-router.ts` `GET /api/memory/due`

### Phase 6: Frontend (M7) - **Week 8**
**Goal:** Pin/archive/collection UI components  
**Value:** Low value (depends on backend)  
**Effort:** Medium  
**Code:** Pin/archive buttons + collections panel wired through capability slots  
**Dependency:** Requires M2 (collections) + M5 (message metadata)

---

## Convention Compliance

All implementations MUST follow vivim-final conventions:

| Convention | Source |
|------------|--------|
| Schema changes via `bunx prisma db push` | `AGENTS.md` (Database) |
| SchemaMeta-backed `MigrationRunner` for data migrations | `src/storage/migration/` |
| Bun native HTTP (not Express) | `src/server/*-router.ts` |
| Composition + explicit wiring in bootstrap | `src/server/bootstrap-engines.ts` |
| Store Contract pattern (engines never touch `impl/`) | `src/storage/contracts/` |
| ULID `newId()` for IDs | `src/ids.ts` |
| BigInt-millis timestamps | Throughout codebase |
| `CapStoreError` hierarchy | `src/errors.ts` |
| pino `getLogger` | `src/lib/logger.ts` |
| `catchDebug` swallow-guarding | `src/lib/catch-logger.ts` |
| `.js` import extensions | Throughout codebase |
| `@/*` path aliases | `tsconfig.json` |

---

## Success Criteria

### Phase 1 (M1)
- [ ] Message identity hashing prevents duplicate messages
- [ ] Upsert logic works correctly for re-sent messages
- [ ] No regression in existing message creation

### Phase 2 (M5+M6)
- [ ] Pin/archive/readStatus fields persist correctly
- [ ] PATCH APIs update message metadata
- [ ] No regression in existing message retrieval

### Phase 3 (M2)
- [ ] Collections can be created/updated/deleted
- [ ] Messages can be added/removed from collections
- [ ] Collection queries return correct results

### Phase 4 (M3+M4)
- [ ] TTL sweep removes expired entries
- [ ] Compaction reduces database size
- [ ] No data loss during compaction

### Phase 5 (M8)
- [ ] FSRS-6 algorithm produces valid schedules
- [ ] Due memories are collected correctly
- [ ] Review intervals are computed accurately

### Phase 6 (M7)
- [ ] Pin/archive buttons work in UI
- [ ] Collections panel displays correctly
- [ ] UI operations trigger correct API calls

---

## Risk Mitigation

### Technical Risks
- **Schema migration failure:** Pre-migration backups, rollback scripts, test on staging
- **Performance degradation:** Performance testing, feature flags, monitoring
- **Data loss during migration:** Full backup, transaction-based migration, validation

### Integration Risks
- **Breaking existing APIs:** All changes additive, backward compatibility maintained
- **Memory engine incompatibility:** Adapter pattern, gradual migration, dual-write
- **Context assembly disruption:** Feature flags, parallel pipelines, manual review

---

## Next Steps

1. Review Phase 1 (M1) PRD: `01-message-deduplication.md`
2. Approve implementation plan for Phase 1
3. Begin Phase 1 implementation
4. Repeat for subsequent phases

---

## References

- `AGENTS.md` - Project instructions and conventions
- `intelligence-pack-acu-dcb-storage/GAP_ANALYSIS_VS_REAL_CODE.md` - Detailed gap analysis
- `intelligence-pack-acu-dcb-storage/INTEGRATION_STRATEGY_ACU_DCB.md` - Integration strategy
- `context-pack-md/# VIVIM-FINAL — COMPLETE UPGRADE PACKAGE.md` - Upgrade package details
