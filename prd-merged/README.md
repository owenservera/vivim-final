# VIVIM-FINAL PRD & Implementation Plans - README

**Status:** Complete  
**Date:** 2026-08-13  
**Location:** `prd-merged/`

---

## Overview

This directory contains clean, truth-grounded Product Requirements Documents (PRDs) and implementation plans for enhancing vivim-final with capabilities from the intelligence pack and upgrade package.

**Key Finding:** Roughly 60% of proposed features already exist in vivim-final under different names. These documents focus on implementing the ~8 genuinely missing capabilities in the repo's own style.

---

## Document Structure

| Document | Purpose | Phase |
|----------|---------|-------|
| **00-overview.md** | Executive summary and navigation | - |
| **01-message-deduplication.md** | Message identity dedup (M1) | 1 |
| **02-message-metadata.md** | Pin/archive/readStatus (M5+M6) | 2 |
| **03-collections-system.md** | Collections system (M2) | 3 |
| **04-lifecycle-compaction.md** | TTL + compaction (M3+M4) | 4 |
| **05-fsrs-scheduler.md** | FSRS-6 review scheduler (M8) | 5 |
| **06-frontend-enhancements.md** | Frontend UI (M7) | 6 |

---

## Implementation Phases

### Phase 1: Message Identity Deduplication (M1) - Week 1
**Goal:** SHA256-based message deduplication  
**Value:** Highest immediate value (idempotency)  
**Effort:** Small

**Key Changes:**
- Add `providerMessageId` and `identityHash` to `ConversationMessage`
- Implement identity hashing via `src/ids.ts`
- Upsert logic in `conversation-manager.ts`

### Phase 2: Message Metadata (M5+M6) - Week 2
**Goal:** Pin/archive/readStatus + CRUD APIs  
**Value:** High value for message management  
**Effort:** Medium

**Key Changes:**
- Add `isPinned`, `isArchived`, `readStatus` to `ConversationMessage`
- Extend `ConversationStore` contract
- Add PATCH APIs for metadata updates

### Phase 3: Collections System (M2) - Week 3-4
**Goal:** Collection management  
**Value:** Medium value for organization  
**Effort:** Medium

**Key Changes:**
- Create `Collection` and `CollectionItem` models
- Implement `CollectionEngine`
- Add collection CRUD APIs

### Phase 4: Lifecycle + Compaction (M3+M4) - Week 5-6
**Goal:** TTL lifecycle + database compaction  
**Value:** Medium value for storage optimization  
**Effort:** Medium-Large

**Key Changes:**
- Add TTL fields to `ConversationMessage` and `Node`
- Implement `LifecycleEngine` for TTL sweeps
- Implement `CompactionManager` for SQLite VACUUM
- Add `BackupManager` for pre-migration backups

### Phase 5: FSRS-6 Scheduler (M8) - Week 7
**Goal:** Spaced repetition review scheduling  
**Value:** Medium value for memory optimization  
**Effort:** Medium

**Key Changes:**
- Implement FSRS-6 algorithm in `FsrsScheduler`
- Add due memory collection to `MemoryEngine`
- Add review APIs

### Phase 6: Frontend (M7) - Week 8
**Goal:** Pin/archive/collection UI components  
**Value:** Low value (depends on backend)  
**Effort:** Medium

**Key Changes:**
- Add pin/archive buttons to message cards
- Create collections panel UI
- Implement collection management dialogs
- Integrate with backend APIs

---

## Convention Compliance

All implementations MUST follow vivim-final conventions:

| Convention | Source |
|------------|--------|
| Schema changes via `bunx prisma db push` | `AGENTS.md` (Database) |
| SchemaMeta-backed `MigrationRunner` | `src/storage/migration/` |
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

## Already Implemented (Do NOT Re-implement)

| Capability | Location | Evidence |
|------------|----------|----------|
| DCB profiles (8 profiles) | `src/engines/dcb-profile.ts` | All 8 profiles + layer matrix |
| 5-stage context assembly | `src/engines/context-assembly.ts` | DETECT→RECALL→RANK→BUDGET→INJECT |
| Budget decay over time | `src/engines/cortex-budget.ts` | Decay logic present |
| Recency-decay scoring | `src/engines/dcb-projector.ts` | `recencyDecay(secs)` |
| ACU-provenance fields on Node | `prisma/schema.prisma` line 767 | ContentHash, version, state, etc. |
| Node capture on every message | `src/engines/conversation-manager.ts::captureAsNode` | Forks edges, sets metadata |
| Message → ContentUnit decomposition | `src/engines/content-unit-decomposer.ts` | Called at conversation-manager.ts:593, 950 |
| Memory-as-Node with FSRS-6 initial state | `src/engines/memory-engine.ts::recordMemory` | Emits Nodes with FSRS-6 fields |
| Memory consolidation + decay | `src/engines/memory-engine.ts` lines 478–514 | decayDays: 30, decayFactor: 0.9 |
| Entity extraction / links / mentions | `prisma/schema.prisma` lines 2015, 2034, 2666, 2684 | Tables exist |
| Topic / project organization | `prisma/schema.prisma` lines 2080, 2092, 2104 | Tables + organizer engine |
| Content hashing / dedup key derivation | `src/ids.ts` | SHA-256 content hash + FNV-1a |
| Storage relocation (WAL, move, backup) | `src/engines/backup-scheduler.ts` | Relocation engine + routes |
| Memory persistence + access control | `prisma/schema.prisma` lines 2704, 2721 | Tables exist |

---

## Missing Capabilities (The Genuine Gap)

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
