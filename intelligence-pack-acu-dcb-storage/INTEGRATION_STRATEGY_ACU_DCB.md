# Deep Integration Strategy: ACU, DCB, and Storage Systems

**Target:** vivim-final  
**Source:** edge-pwa intelligence pack  
**Date:** 2026-08-13  
**Status:** Strategic Assessment

---

## Executive Summary

This document provides a deep integration assessment and implementation strategy for incorporating ACU (Atomic Chat Units), DCB (Dynamic Context Bundles), and advanced storage patterns from edge-pwa into vivim-final.

**Key Finding:** vivim-final has strong foundational systems (memory-engine, context-assembly, Prisma storage) that can be enhanced with edge-pwa's sophisticated patterns. The integration is **highly feasible** with minimal architectural disruption.

**Integration Complexity:** Medium  
**Estimated Effort:** 6-8 weeks  
**Risk Level:** Low-Medium (mitigable with phased approach)

---

## 1. Architecture Mapping

### 1.1 Memory Engine Integration

| Edge-PWA Feature | vivim-Final Current State | Integration Approach |
|-----------------|--------------------------|---------------------|
| **MemoryType Enum** (10 cognitive types) | Basic episodic/semantic/procedural | **Enhancement**: Add enum to existing memory system |
| **FSRS-6 Spaced Repetition** | Fields exist in `recordMemory()` but no algorithm | **Implementation**: Add FSRS-6 review scheduling logic |
| **Relevance Decay** (30-day half-life) | No decay algorithm | **Implementation**: Add time-based decay to relevance scoring |
| **ConsolidationStatus** | Basic consolidation in `consolidate()` | **Enhancement**: Add status tracking to memory lifecycle |
| **Memory Snippets** | No snippet system | **New Feature**: Add snippet extraction for context retrieval |

**Current vivim-final Memory Engine:**
- Has `EpisodicMemory`, `SemanticMemory`, `ProceduralRule` stores
- `recordMemory()` already includes FSRS-6 fields (`stability`, `difficulty`, `dueDate`, `fsrsState`)
- Has consolidation logic (`dedupe`, `decay`, `promote`, `prune`)
- Lacks cognitive classification and FSRS-6 algorithm implementation

**Integration Path:**
1. Add `MemoryType` enum to `memory-engine.ts`
2. Implement FSRS-6 review scheduling algorithm
3. Add relevance decay to memory scoring
4. Extend consolidation with status tracking
5. Add memory snippet extraction for context retrieval

### 1.2 Context Assembly Integration

| Edge-PWA Feature | vivim-Final Current State | Integration Approach |
|-----------------|--------------------------|---------------------|
| **DCB Profiles** (8 profiles) | TaskType-based priorities (9 types) | **Mapping**: Map DCB profiles to existing TaskTypes |
| **8-Layer System** (L0-L7) | 7-layer system (identity, preferences, topic, entity, conversation_history, recent_episodes, project_state) | **Alignment**: Add missing layers (L5 JIT, L6 Recent History split) |
| **Provenance Tracking** | Basic sources array | **Enhancement**: Add structured provenance with source types |
| **Content Blocks** (Text, Image, Code, Reference) | Basic text content | **Enhancement**: Add structured content to message blocks |
| **Freshness Computation** | No freshness tracking | **New Feature**: Add freshness to cached layers |
| **Budget Allocation** | Task-type percentage allocation | **Enhancement**: Add profile-based allocation overrides |
| **Bundle Compiler** | No pre-compiled caching | **New Feature**: Add bundle compiler for identity/preferences |

**Current vivim-final Context Assembly:**
- 5-stage pipeline: DETECT → RECALL → RANK → BUDGET → INJECT
- 7 context layers with task-type priorities
- Budget allocation per task type (percentage-based)
- Predictive pre-warming with usage patterns
- Relevance-based truncation with embeddings
- No DCB profiles, no provenance tracking, no bundle compiler

**Integration Path:**
1. Add `DcbProfile` enum mapped to existing `TaskType`
2. Extend layer system to match DCB 8-layer structure
3. Add structured provenance to `ContextLayer`
4. Add content block types to message system
5. Implement freshness computation for cached layers
6. Add bundle compiler for pre-compiled identity/preferences
7. Enhance budget allocation with profile-based overrides

### 1.3 Storage Integration

| Edge-PWA Feature | vivim-Final Current State | Integration Approach |
|-----------------|--------------------------|---------------------|
| **Message Deduplication** (SHA256 identity) | No deduplication | **New Feature**: Add message identity hashing |
| **Storage Compaction** | No compaction | **New Feature**: Add SQLite compaction for long-running instances |
| **Lifecycle Management** (TTL) | No TTL-based cleanup | **New Feature**: Add TTL-based sweep jobs |
| **Migration Backups** | No backup system | **Enhancement**: Add pre-migration backups |
| **Method Attachment** | Direct Prisma methods | **Enhancement**: Consider modular method attachment pattern |

**Current vivim-final Storage:**
- Prisma ORM with 196 models in single schema
- SQLite database with WAL mode
- No deduplication, no compaction, no TTL
- Basic migration system without backups
- Direct method access through `CapStoreDb`

**Integration Path:**
1. Add message identity hashing to conversation message creation
2. Implement upsert logic for message deduplication
3. Add TTL-based cleanup jobs for trace entries and sessions
4. Implement SQLite compaction for database maintenance
5. Add pre-migration backup system
6. Consider modular method attachment for extensibility

### 1.4 ACU Integration

| Edge-PWA Feature | vivim-Final Current State | Integration Approach |
|-----------------|--------------------------|---------------------|
| **ACUMetadata** (tags, collections, pinning) | No ACU concept | **New Feature**: Add ACU metadata to message parts |
| **Batch Operations** | No batch operations | **New Feature**: Add batch operation system for ACU management |
| **Selection State** | No selection state | **New Feature**: Add selection state for UI operations |

**Current vivim-final Domain:**
- Basic domain types (Slave, Provider, Account, etc.)
- No ACU concept, no granular conversation building blocks
- Message system has `blocksJson` but no ACU metadata

**Integration Path:**
1. Add `ACUMetadata` type to `domain/types.ts`
2. Extend `ConversationMessage` with ACU metadata fields
3. Add batch operation system for ACU management
4. Add selection state for UI operations

---

## 2. Dependency Analysis

### 2.1 Schema Dependencies

**Required Schema Changes:**

```prisma
// Add to ConversationMessage model
model ConversationMessage {
  // ... existing fields ...
  
  // ACU metadata
  acuTagsJson String @default("[]") @map("acu_tags_json")
  acuCollectionIdsJson String @default("[]") @map("acu_collection_ids_json")
  acuIsPinned Int @default(0) @map("acu_is_pinned")
  acuIsArchived Int @default(0) @map("acu_is_archived")
  acuReadStatus String @default("unread") @map("acu_read_status")
  acuPriority String @default("normal") @map("acu_priority")
  acuNotes String? @map("acu_notes")
  acuCustomFieldsJson String @default("{}") @map("acu_custom_fields_json")
  
  // DCB freshness
  dcbFreshness String @default("unknown") @map("dcb_freshness")
  dcbComposedAgainstVersion Int @default(0) @map("dcb_composed_against_version")
  
  // Message identity for deduplication
  messageIdentityHash String? @map("message_identity_hash")
  
  @@index([messageIdentityHash], map: "idx_cm_identity")
  @@map("conversation_message")
}

// Add to ContextAssemblyStore (if not exists)
model ContextLayerCache {
  id String @id
  conversationId String @map("conversation_id")
  layerName String @map("layer_name")
  bundleType String @map("bundle_type")
  content String
  tokenCount Int @map("token_count")
  version Int @default(1)
  isDirty Int @default(0) @map("is_dirty")
  composedAt BigInt @map("composed_at")
  createdAt BigInt @map("created_at")
  updatedAt BigInt @map("updated_at")
  
  @@unique([conversationId, layerName, bundleType])
  @@index([conversationId], map: "idx_clc_conv")
  @@map("context_layer_cache")
}

// Add TTL fields for lifecycle management
model TraceEntry {
  // ... existing fields ...
  ttlExpiresAt BigInt? @map("ttl_expires_at")
  
  @@index([ttlExpiresAt], map: "idx_te_ttl")
  @@map("trace_entry")
}
```

**Migration Strategy:**
1. Add new fields with default values (non-breaking)
2. Create indexes for performance
3. Backfill existing data with default ACU metadata
4. Deploy in phased manner (schema change → data migration → feature rollout)

### 2.2 Code Dependencies

**New Dependencies:**
- `crypto` module for SHA256 hashing (Node.js built-in, no external dep)
- No new external dependencies required

**Existing Dependencies to Leverage:**
- `@prisma/client` - already in use
- Existing `CapabilityEventBus` - for memory events
- Existing `SemanticSearchEngine` - for DCB topic layer
- Existing `SituationDetector` - for DCB profile selection

**Breaking Changes:**
- None - all changes are additive
- Existing APIs remain backward compatible

### 2.3 Integration Dependencies

**Cross-Component Dependencies:**

1. **Memory Engine → Context Assembly**
   - Memory snippets needed for DCB L2 topic layer
   - Relevance decay affects context layer ranking
   - FSRS-6 due dates influence memory retrieval priority

2. **Context Assembly → Storage**
   - Bundle compiler requires storage for cached bundles
   - Freshness computation requires version tracking
   - Provenance tracking requires storage of layer sources

3. **Storage → Deduplication**
   - Message identity hashing requires conversation message access
   - Upsert logic requires message storage access

4. **ACU → Message System**
   - ACU metadata requires message part extension
   - Batch operations require message storage access

---

## 3. Conflict Analysis

### 3.1 Architectural Conflicts

**Conflict 1: Layer System Mismatch**
- **Issue:** vivim-final has 7 layers, edge-pwa has 8 layers
- **Resolution:** Extend vivim-final to 8 layers (add L5 JIT context, split L6)
- **Impact:** Low - additive change, existing layers preserved

**Conflict 2: TaskType vs DcbProfile**
- **Issue:** vivim-final uses TaskType (9 types), edge-pwa uses DcbProfile (8 profiles)
- **Resolution:** Create mapping between TaskType and DcbProfile, use DcbProfile internally
- **Impact:** Low - mapping layer, no breaking changes

**Conflict 3: Memory Storage Approach**
- **Issue:** vivim-final uses separate stores (episodic/semantic/procedural), edge-pwa uses unified Memory struct
- **Resolution:** Keep vivim-final's separate stores for now, add MemoryType enum for classification
- **Impact:** Low - additive classification, no structural changes

### 3.2 Data Model Conflicts

**Conflict 1: Message Block Structure**
- **Issue:** vivim-final has `blocksJson` as array, edge-pwa has structured ContentBlock enum
- **Resolution:** Extend vivim-final blocks to support structured content (backward compatible)
- **Impact:** Low - additive to existing structure

**Conflict 2: Context Layer Storage**
- **Issue:** vivim-final stores layers per conversation, edge-pwa stores bundles per user/bundleType
- **Resolution:** Hybrid approach - keep per-conversation caching, add per-user bundle compiler
- **Impact:** Medium - requires new storage table but preserves existing caching

### 3.3 Performance Conflicts

**Conflict 1: Deduplication Overhead**
- **Issue:** SHA256 hashing adds write overhead
- **Resolution:** Batch hashing operations, cache hashes for recent messages
- **Impact:** Low - mitigable with batching

**Conflict 2: Bundle Compilation Latency**
- **Issue:** Bundle compilation adds latency on first access
- **Resolution:** Lazy compilation with background pre-warming
- **Impact:** Low - mitigable with caching and pre-warming

**Conflict 3: Relevance Decay Computation**
- **Issue:** Time-based decay computation adds query overhead
- **Resolution:** Pre-compute and cache relevance scores, refresh periodically
- **Impact:** Low - mitigable with caching

---

## 4. Implementation Strategy

### 4.1 Phased Implementation Plan

#### Phase 1: Foundation (Week 1-2)
**Goal:** Add core types and basic infrastructure

**Tasks:**
1. Add `MemoryType` enum to `memory-engine.ts`
2. Add `DcbProfile` enum to `context-assembly.ts`
3. Add `ACUMetadata` type to `domain/types.ts`
4. Add `ContentBlock` enum to message system
5. Add `Provenance` type to context assembly
6. Implement message identity hashing function
7. Add basic data-math utilities (token estimation, recency decay)

**Deliverables:**
- Core type definitions
- Utility functions
- No breaking changes

**Success Criteria:**
- All types compile without errors
- Unit tests pass for new utilities
- No regression in existing tests

#### Phase 2: Memory Engine Enhancement (Week 3-4)
**Goal:** Add FSRS-6 and relevance decay to memory system

**Tasks:**
1. Implement FSRS-6 review scheduling algorithm
2. Add relevance decay calculation to memory scoring
3. Extend consolidation with status tracking
4. Add memory snippet extraction
5. Integrate MemoryType into existing memory operations
6. Add FSRS-6 review scheduling job

**Deliverables:**
- Enhanced memory engine with FSRS-6
- Relevance decay implementation
- Memory snippet system

**Success Criteria:**
- FSRS-6 algorithm produces valid schedules
- Relevance decay scores correlate with time
- Memory snippets extract correctly
- Consolidation tracks status

#### Phase 3: Context Assembly Enhancement (Week 5-6)
**Goal:** Add DCB profiles, provenance, and bundle compiler

**Tasks:**
1. Map DcbProfile to existing TaskType
2. Extend layer system to 8 layers
3. Add structured provenance to ContextLayer
4. Implement bundle compiler for identity/preferences
5. Add freshness computation to cached layers
6. Enhance budget allocation with profile-based overrides
7. Add content block support to message system

**Deliverables:**
- DCB profile system
- Bundle compiler
- Enhanced context assembly

**Success Criteria:**
- DCB profiles map correctly to TaskTypes
- Bundle compiler produces valid bundles
- Freshness computation works correctly
- Context assembly uses new layer system

#### Phase 4: Storage Enhancement (Week 7-8)
**Goal:** Add deduplication, lifecycle management, and backups

**Tasks:**
1. Implement message upsert with deduplication
2. Add TTL-based cleanup jobs
3. Implement SQLite compaction
4. Add pre-migration backup system
5. Add schema migration for new fields
6. Backfill existing data with ACU metadata

**Deliverables:**
- Deduplication system
- Lifecycle management
- Backup system
- Schema migration

**Success Criteria:**
- Deduplication prevents duplicate messages
- TTL cleanup removes expired entries
- Compaction reduces database size
- Backups restore correctly

### 4.2 Rollout Strategy

**Canary Deployment:**
1. Deploy to development environment first
2. Run integration tests with synthetic data
3. Deploy to staging with production data backup
4. Monitor performance metrics for 1 week
5. Gradual rollout to production (10% → 50% → 100%)

**Feature Flags:**
```typescript
const FEATURES = {
  ACU_METADATA: process.env.FEATURE_ACU_METADATA === 'true',
  DCB_PROFILES: process.env.FEATURE_DCB_PROFILES === 'true',
  FSRS_6: process.env.FEATURE_FSRS_6 === 'true',
  DEDUPLICATION: process.env.FEATURE_DEDUPLICATION === 'true',
  BUNDLE_COMPILER: process.env.FEATURE_BUNDLE_COMPILER === 'true',
}
```

**Rollback Plan:**
- Feature flags allow instant rollback
- Schema changes are additive (safe to rollback)
- Data migration is reversible (backup before migration)

### 4.3 Testing Strategy

**Unit Tests:**
- MemoryType enum values
- FSRS-6 algorithm correctness
- Relevance decay calculation
- Message identity hashing
- Bundle compilation logic
- Freshness computation

**Integration Tests:**
- Memory engine with FSRS-6
- Context assembly with DCB profiles
- Deduplication with message upsert
- Bundle compiler with storage
- TTL cleanup jobs

**Performance Tests:**
- Message identity hashing (<1ms per message)
- DCB composition (<100ms per bundle)
- Relevance decay calculation (<0.1ms per memory)
- Bundle compilation (<50ms per bundle)
- Deduplication upsert (<10ms per message)

**Regression Tests:**
- Existing memory engine functionality
- Existing context assembly pipeline
- Existing storage operations
- Existing conversation/message flows

---

## 5. Risk Mitigation

### 5.1 Technical Risks

**Risk 1: Schema Migration Failure**
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - Pre-migration backups
  - Rollback script ready
  - Test migration on staging first
  - Phased rollout with monitoring

**Risk 2: Performance Degradation**
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Performance testing before rollout
  - Feature flags for gradual rollout
  - Monitoring and alerting
  - Optimization iterations

**Risk 3: Data Loss During Migration**
- **Likelihood:** Low
- **Impact:** Critical
- **Mitigation:**
  - Full database backup before migration
  - Transaction-based migration
  - Data validation after migration
  - Rollback capability

**Risk 4: FSRS-6 Algorithm Incorrectness**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Algorithm validation against reference implementation
  - Unit tests with known inputs/outputs
  - A/B testing with existing system
  - Manual review of early schedules

### 5.2 Integration Risks

**Risk 1: Breaking Existing APIs**
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - All changes are additive
  - Backward compatibility maintained
  - Deprecation warnings for old APIs
  - Comprehensive regression testing

**Risk 2: Memory Engine Incompatibility**
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Adapter pattern for integration
  - Gradual migration of memory data
  - Dual-write during transition
  - Validation of data consistency

**Risk 3: Context Assembly Pipeline Disruption**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Feature flags for new pipeline
  - Parallel old/new pipeline during transition
  - Performance comparison
  - Manual review of assembled contexts

### 5.3 Operational Risks

**Risk 1: Increased Storage Requirements**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:**
  - Storage capacity planning
  - TTL-based cleanup
  - Compaction jobs
  - Monitoring and alerting

**Risk 2: Increased CPU Usage**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:**
  - Performance optimization
  - Batching of operations
  - Background job scheduling
  - Resource monitoring

**Risk 3: Deployment Complexity**
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Automated deployment pipeline
  - Rollback automation
  - Deployment documentation
  - Runbook for issues

---

## 6. Success Metrics

### 6.1 Quantitative Metrics

**Memory Engine:**
- FSRS-6 adoption rate: % of memories with scheduled reviews
- Relevance decay impact: % improvement in memory relevance scoring
- Memory snippet usage: % of context assemblies using snippets
- Consolidation efficiency: % reduction in duplicate memories

**Context Assembly:**
- DCB profile adoption: % of conversations using DCB profiles
- Bundle cache hit rate: % of bundle requests served from cache
- Freshness accuracy: % of cached bundles with correct freshness
- Provenance coverage: % of layers with structured provenance

**Storage:**
- Deduplication rate: % of messages deduplicated
- TTL cleanup efficiency: % of expired entries removed
- Compaction savings: % reduction in database size
- Backup success rate: % of successful backups

### 6.2 Qualitative Metrics

**User Experience:**
- Context quality feedback
- Memory relevance feedback
- System responsiveness
- Error rates

**Developer Experience:**
- API usability
- Documentation quality
- Debugging capability
- Extension ease

**Operational:**
- Deployment success rate
- Rollback frequency
- Incident response time
- System stability

---

## 7. Resource Requirements

### 7.1 Development Resources

**Phase 1 (Foundation):**
- 1 developer, 2 weeks
- Skills: TypeScript, Prisma, basic algorithms

**Phase 2 (Memory Engine):**
- 1 developer, 2 weeks
- Skills: TypeScript, algorithms, cognitive science concepts

**Phase 3 (Context Assembly):**
- 1-2 developers, 2 weeks
- Skills: TypeScript, context systems, caching strategies

**Phase 4 (Storage):**
- 1-2 developers, 2 weeks
- Skills: TypeScript, SQLite, database operations

**Total:** 6-8 weeks, 1-2 developers

### 7.2 Infrastructure Resources

**Development:**
- Development environment with SQLite
- Staging environment with production data copy
- CI/CD pipeline for automated testing

**Production:**
- No additional infrastructure required
- Existing SQLite database sufficient
- Monitoring and alerting for new metrics

### 7.3 Testing Resources

**Test Data:**
- Synthetic test data for unit tests
- Production data copy for integration tests
- Edge case data for performance tests

**Test Environment:**
- Dedicated test database
- Automated test runner
- Performance testing tools

---

## 8. Timeline

### 8.1 Detailed Timeline

**Week 1-2: Foundation**
- Day 1-3: Add core types (MemoryType, DcbProfile, ACUMetadata)
- Day 4-5: Add utility functions (hashing, decay, token estimation)
- Day 6-7: Unit tests for new utilities
- Day 8-10: Integration testing with existing code
- Day 11-14: Documentation and review

**Week 3-4: Memory Engine**
- Day 15-18: Implement FSRS-6 algorithm
- Day 19-20: Add relevance decay
- Day 21-22: Extend consolidation with status tracking
- Day 23-24: Add memory snippet extraction
- Day 25-28: Testing and optimization

**Week 5-6: Context Assembly**
- Day 29-31: Map DcbProfile to TaskType
- Day 32-33: Extend layer system
- Day 34-35: Add provenance tracking
- Day 36-37: Implement bundle compiler
- Day 38-42: Testing and integration

**Week 7-8: Storage**
- Day 43-45: Implement deduplication
- Day 46-47: Add TTL cleanup
- Day 48-49: Implement compaction
- Day 50-51: Add backup system
- Day 52-56: Schema migration and rollout

### 8.2 Milestones

**Milestone 1 (Week 2): Foundation Complete**
- All core types defined
- Utility functions implemented
- Unit tests passing

**Milestone 2 (Week 4): Memory Engine Enhanced**
- FSRS-6 algorithm working
- Relevance decay implemented
- Memory snippets functional

**Milestone 3 (Week 6): Context Assembly Enhanced**
- DCB profiles integrated
- Bundle compiler working
- Provenance tracking active

**Milestone 4 (Week 8): Storage Enhanced**
- Deduplication active
- Lifecycle management working
- Backup system operational

**Milestone 5 (Week 9): Production Ready**
- All features tested
- Documentation complete
- Rollout plan approved

---

## 9. Conclusion

This integration strategy provides a comprehensive, phased approach to incorporating ACU, DCB, and advanced storage patterns from edge-pwa into vivim-final. The integration is **highly feasible** with minimal architectural disruption and can be completed in **6-8 weeks** with **1-2 developers**.

**Key Success Factors:**
1. Phased implementation with feature flags
2. Comprehensive testing at each phase
3. Performance monitoring and optimization
4. Rollback capability at each stage
5. Clear documentation and communication

**Recommended Next Steps:**
1. Review and approve this strategy
2. Allocate development resources
3. Set up development and staging environments
4. Begin Phase 1 implementation
5. Establish weekly progress reviews

**Expected Outcomes:**
- Enhanced memory system with cognitive classification and FSRS-6
- Sophisticated context assembly with DCB profiles and bundle caching
- Robust storage with deduplication and lifecycle management
- Improved system performance and user experience
- Foundation for future enhancements

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-13  
**Status:** Ready for Review  
