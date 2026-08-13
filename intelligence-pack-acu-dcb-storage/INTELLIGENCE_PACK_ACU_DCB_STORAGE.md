# Intelligence Pack: ACU, DCB, and Storage Systems

**Source:** `vivim-app-og/vivim-app/edge-pwa`  
**Target:** `vivim-final`  
**Extracted:** High-value code patterns for atomic chat units, dynamic context bundles, and storage systems  
**Date:** 2026-08-13

---

## Executive Summary

This intelligence pack extracts high-value code patterns from the edge-pwa repository focusing on three core systems:

1. **Atomic Chat Units (ACU)** - Granular, reusable conversation building blocks
2. **Dynamic Context Bundles (DCB)** - Intelligent context assembly with layered composition
3. **Storage & Data Math** - Deduplication, lifecycle management, and relevance algorithms

These systems provide a sophisticated foundation for context management, memory systems, and data persistence that can be adapted to the vivim-final architecture.

---

## 1. Atomic Chat Units (ACU)

### Core Concept

ACUs represent atomic, reusable units of conversation content that can be composed, tagged, and managed across different contexts. They provide fine-grained control over conversation artifacts.

### Key Data Structures

```rust
// From: backend/src/types.rs (lines 705-723)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACUMetadata {
    pub tags: Vec<String>,
    #[serde(rename = "collectionIds")]
    pub collection_ids: Vec<String>,
    #[serde(rename = "isPinned")]
    pub is_pinned: bool,
    #[serde(rename = "isArchived")]
    pub is_archived: bool,
    #[serde(rename = "readStatus")]
    pub read_status: String,
    pub priority: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(rename = "customFields", skip_serializing_if = "Option::is_none")]
    pub custom_fields: Option<HashMap<String, String>>,
}
```

### Batch Operations

```rust
// From: backend/src/types.rs (lines 727-745)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOperation {
    #[serde(rename = "type")]
    pub op_type: String,
    #[serde(rename = "acuIds")]
    pub acu_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionState {
    #[serde(rename = "selectedIds")]
    pub selected_ids: Vec<String>,
    #[serde(rename = "isSelectMode")]
    pub is_select_mode: bool,
    #[serde(rename = "lastSelectedId", skip_serializing_if = "Option::is_none")]
    pub last_selected_id: Option<String>,
}
```

### Integration Points for vivim-final

- **Current State:** vivim-final has conversation/message storage but lacks granular ACU concepts
- **Adaptation Strategy:** Extract ACU patterns from message parts and conversation metadata
- **Recommended Location:** `src/domain/types.ts` - add ACU-related types extending current domain model

---

## 2. Dynamic Context Bundles (DCB)

### Core Concept

DCBs provide intelligent, layered context assembly that dynamically composes relevant information based on situation, profile, and budget constraints. This is the most sophisticated system in the source repo.

### Key Architecture

```rust
// From: backend/src/cortex/dcb/mod.rs (lines 176-186)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicContextBundle {
    pub id: BundleId,
    pub profile: DcbProfile,
    pub scenario: Option<ScenarioId>,
    pub project_id: Option<ProjectId>,
    pub layers: Vec<LayerItem>,
    pub total_tokens: usize,
    pub budget: usize,
    pub model_target: Option<String>,
    pub created_at: String,
}
```

### DCB Profiles

```rust
// From: backend/src/cortex/dcb/mod.rs (lines 102-113)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DcbProfile {
    Seed,           // Minimal context for new conversations
    Reunion,        // Re-engagement with past context
    Convergence,    // Deep context synthesis
    Continuum,      // Continuous context flow
    Handoff,        // Cross-session transfer
    Probe,          // Exploratory context
    DeepResearch,   // Maximum context depth
    DecisionBrief,  // Focused decision support
}
```

### Layer System

```rust
// From: backend/src/cortex/dcb/mod.rs (lines 161-173)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerItem {
    pub layer: LayerType,
    pub text: String,
    pub provenance: Provenance,
    pub confidence: f64,
    pub recency_secs: u64,
    pub token_cost: usize,
    pub included: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub blocks: Vec<ContentBlock>,
}
```

### Layer Types

```rust
// From cortex/budget.rs (inferred from composer.rs usage)
pub enum LayerType {
    L0Identity,        // Core user identity
    L1GlobalPrefs,     // Global preferences
    L2Topic,          // Topic-specific context
    L3Entity,         // Entity relationships
    LpProjectState,   // Project state (provider-specific)
    LdDecisions,      // Decision history
    L4Conversation,   // Active conversation context
    L5JitContext,     // Just-in-time context
    L6RecentHistory,  // Recent conversation history
    L7UserQuery,      // Current user query
}
```

### Provenance Tracking

```rust
// From: backend/src/cortex/dcb/mod.rs (lines 115-135)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProvenanceSource {
    Identity,
    Prefs,
    Conversation,
    Project,
    Decision,
    Retrieval,
    Entity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provenance {
    pub source: ProvenanceSource,
    pub conv_id: Option<ConvId>,
    pub provider: Option<Provider>,
    pub account_id: Option<AccountId>,
    pub timestamp: Option<String>,
    pub label: String,
}
```

### Content Blocks (Structured Content)

```rust
// From: backend/src/cortex/dcb/mod.rs (lines 137-159)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    Image {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        alt: Option<String>,
    },
    Code {
        language: String,
        content: String,
    },
    Reference {
        id: String,
        label: String,
    },
}
```

### Context Engine

```rust
// From: backend/src/cortex/dcb/mod.rs (lines 197-704)
pub struct ContextEngine {
    pub(crate) lcg: Arc<LcgStore>,
    pub(crate) cfg: Arc<ConfigResolver>,
    cards: RwLock<CardStore>,
    build_status: Arc<RwLock<BuildStatus>>,
    cancel: Arc<std::sync::atomic::AtomicBool>,
    pub(crate) ingest_tx: Option<tokio::sync::mpsc::UnboundedSender<ConvId>>,
    pub(crate) ingest_count: std::sync::atomic::AtomicU64,
}
```

### Key Methods

- `compose()` - Main composition method with profile-based layer selection
- `compose_for_moment()` - Situation-aware composition
- `ingest_conversation()` - Live conversation ingestion
- `recompose_cards()` - Refresh cached context cards
- `snapshot_stats()` - Transparency into LCG snapshot state

### Integration Points for vivim-final

- **Current State:** vivim-final has `context-assembly.ts` but lacks DCB sophistication
- **Adaptation Strategy:** 
  1. Port DCB profile system to `src/engines/context-assembly.ts`
  2. Implement layer builders for existing vivim-final context sources
  3. Add provenance tracking to current context assembly
  4. Integrate with existing memory engine for L0/L1 layers
- **Recommended Location:** `src/engines/dcb/` - new module for DCB system

---

## 3. Memory Engine with FSRS-6

### Core Concept

Sophisticated memory system with cognitive science classification, FSRS-6 spaced repetition, and relevance decay algorithms.

### Memory Types (Cognitive Science Classification)

```rust
// From: backend/src/memory_engine.rs (lines 14-29)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum MemoryType {
    #[default]
    Episodic,      // Personal experiences/events
    Semantic,      // General knowledge/facts
    Procedural,    // How-to knowledge
    Factual,       // Verifiable facts
    Preference,    // User preferences
    Identity,      // Self-concept
    Relationship,  // Social connections
    Goal,          // Objectives/targets
    Project,       // Work projects
    Custom,        // User-defined types
}
```

### Memory Structure

```rust
// From: backend/src/memory_engine.rs (lines 73-163)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Memory {
    pub id: String,
    pub account_id: String,
    pub content: String,
    pub summary: Option<String>,
    pub memory_type: MemoryType,
    pub category: String,
    pub subcategory: Option<String>,
    pub tags: Vec<String>,
    pub importance: f64,           // 0.0-1.0 static importance
    pub relevance: f64,           // 0.0-1.0 dynamic relevance (decays)
    pub source_conversation_ids: Vec<String>,
    pub source_message_ids: Vec<String>,
    pub occurred_at: Option<String>,
    pub valid_from: Option<String>,
    pub valid_until: Option<String>,
    pub is_pinned: bool,           // Never decays
    pub is_active: bool,
    pub is_archived: bool,
    pub consolidation_status: ConsolidationStatus,
    pub access_count: u64,
    pub last_accessed_at: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
    
    // FSRS-6 spaced repetition fields
    pub stability: f64,            // Days to 90% retention
    pub difficulty: f64,           // 0-1 difficulty
    pub due_date: String,          // Next review date
    pub last_review: Option<String>,
    pub review_count: u32,
    pub fsrs_state: FsrsState,
}
```

### Relevance Decay Algorithm

```rust
// From: backend/src/memory_engine.rs (lines 816-846)
fn calculate_relevance(
    base_relevance: f64,
    access_count: u64,
    last_accessed_at: Option<&str>,
    is_pinned: bool,
) -> f64 {
    if is_pinned {
        return 1.0;
    }

    let mut relevance = base_relevance;

    // Boost for frequent access (max 0.2)
    let access_boost = (0.2_f64).min(access_count as f64 * 0.02);
    relevance += access_boost;

    // Decay for non-access over time (half-life of 30 days)
    if let Some(last_accessed) = last_accessed_at {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(last_accessed) {
            let now = chrono::Utc::now();
            let days_since_access = (now.timestamp_millis() - dt.timestamp_millis()) as f64
                / (1000.0 * 60.0 * 60.0 * 24.0);
            let decay_factor = 0.5_f64.powf(days_since_access / 30.0);
            relevance *= 0.5 + 0.5 * decay_factor;
        }
    }

    relevance.clamp(0.0, 1.0)
}
```

### FSRS-6 Spaced Repetition

```rust
// From: backend/src/memory_engine.rs (lines 859-912)
// Key equations:
//   Retrievability: R = exp(ln(0.9) * elapsed / stability)
//   New stability: S' = S * exp(0.9 * difficulty_factor * retrievability * rating_bonus)

pub fn fsrs_apply_review(mem: &Memory, rating: u8, now: &chrono::DateTime<chrono::Utc>) -> Memory {
    // Rating scale: 1=Again, 2=Hard, 3=Good, 4=Easy
    // Updates stability, difficulty, due_date based on performance
}
```

### Integration Points for vivim-final

- **Current State:** vivim-final has `memory-engine.ts` but lacks FSRS-6 and cognitive classification
- **Adaptation Strategy:**
  1. Add MemoryType enum to existing memory system
  2. Implement relevance decay algorithm
  3. Add FSRS-6 spaced repetition scheduling
  4. Extend memory schema with FSRS fields
- **Recommended Location:** `src/engines/memory-engine.ts` - extend existing implementation

---

## 4. Storage Layer Patterns

### Deduplication System

```rust
// From: backend/src/storage/dedup.rs (lines 4-32)
pub fn message_identity(
    provider: &str,
    account: &str,
    conv_id: &str,
    role: &str,
    content: &str,
    provider_msg_id: Option<&str>,
) -> String {
    let mut h = Sha256::new();
    h.update(provider.as_bytes());
    h.update(b"\0");
    h.update(account.as_bytes());
    h.update(b"\0");
    h.update(conv_id.as_bytes());
    h.update(b"\0");
    match provider_msg_id {
        Some(id) if !id.is_empty() => {
            h.update(b"id\0");
            h.update(id.as_bytes());
        }
        _ => {
            h.update(b"rc\0");
            h.update(role.as_bytes());
            h.update(b"\0");
            h.update(content.as_bytes());
        }
    }
    hex::encode(h.finalize())
}
```

### Upsert with Source Merging

```rust
// From: backend/src/storage/dedup.rs (lines 42-104)
pub fn upsert_message(
    db: &VivimDB,
    provider: &str,
    account: &str,
    conv_id: &str,
    role: &str,
    content: &str,
    provider_msg_id: Option<&str>,
    sources: &[String],
) -> anyhow::Result<(UpsertOutcome, String)> {
    // Returns Inserted, Merged, or Unchanged
    // Merges source lists when duplicate detected
}
```

### Storage Operations (Compaction & Purge)

```rust
// From: backend/src/storage/ops.rs (lines 68-113)
pub fn purge(base: &str, domain: &str, tree: &str) -> Result<()> {
    // Delete every key under tree: prefix
    // Two-pass: read to collect, then write to delete
}

pub fn compact(base: &str, domain: &str) -> Result<()> {
    // Copy-compaction: rewrite DB to reclaim free pages
    // Creates backup, then atomically swaps
}
```

### Lifecycle Management (TTL)

```rust
// From: backend/src/storage/lifecycle.rs (lines 5-13)
const TRACES_TTL_HOURS: i64 = 48;
const SESSIONS_TTL_HOURS: i64 = 6;
const SYNC_HISTORY_TTL_DAYS: i64 = 30;
const OBSERVATORY_TRAFFIC_TTL_DAYS: i64 = 7;
const OBSERVATORY_TRAFFIC_MAX: usize = 2000;
```

```rust
// From: backend/src/storage/lifecycle.rs (lines 35-74)
fn sweep(db: &VivimDB, tree: &str, cutoff: DateTime<Utc>) -> Result<usize> {
    // Delete entries older than cutoff
}

fn sweep_cap(db: &VivimDB, tree: &str, max: usize) -> Result<usize> {
    // Keep only newest max entries, delete rest
}
```

### Integration Points for vivim-final

- **Current State:** vivim-final has Prisma-based storage but lacks dedup/compaction
- **Adaptation Strategy:**
  1. Add message identity hashing to conversation storage
  2. Implement upsert logic for message deduplication
  3. Add TTL-based cleanup jobs
  4. Implement compaction for SQLite databases
- **Recommended Location:** `src/storage/impl/` - add deduplication and lifecycle modules

---

## 5. Context Bundle Compiler

### Core Concept

Pre-compiled, version-cached markdown context assets that can be invalidated and recompiled on demand.

### Bundle Structure

```rust
// From: backend/src/cortex/bundle.rs (lines 10-24)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextBundle {
    pub id: String,
    pub user_id: String,
    pub bundle_type: String, // "identity_core" | "global_prefs" | "topic" | "entity" | "conversation"
    pub topic_profile_id: Option<String>,
    pub entity_profile_id: Option<String>,
    pub conversation_id: Option<String>,
    pub persona_id: Option<String>,
    pub compiled_prompt: String, // Formatted Markdown
    pub token_count: usize,
    pub version: usize,
    pub is_dirty: bool,
    pub compiled_at: String,
}
```

### Lazy Recompilation

```rust
// From: backend/src/cortex/bundle.rs (lines 36-64)
pub fn get_bundle(
    &self,
    account_id: &str,
    bundle_type: &str,
    ref_id: Option<&str>,
) -> Result<Option<ContextBundle>> {
    // Returns cached bundle if not dirty
    // Recompiles if dirty flag set
    // Compiles new bundle if missing
}
```

### Bundle Types

- **identity_core** - User profile and core identity
- **global_prefs** - Formatting and tone preferences
- **topic** - Domain-specific knowledge
- **entity** - Project/agent/client summaries
- **conversation** - Conversation arc and decisions

### Integration Points for vivim-final

- **Current State:** vivim-final lacks pre-compiled context caching
- **Adaptation Strategy:**
  1. Implement bundle compiler for identity/preferences
  2. Add dirty flagging system
  3. Integrate with DCB layer system
- **Recommended Location:** `src/engines/context-bundle-compiler.ts` - new module

---

## 6. Cap-Store Storage Patterns

### Core Concept

Comprehensive SQLite-based storage with migration system, backup strategy, and modular method attachment.

### Database Interface

```typescript
// From: cap-store/src/storage/db.ts (lines 101-418)
export interface CapStoreDb {
  close(): void;
  migrate(): { applied: string[]; currentVersion: number };
  raw(): Database;
  
  // Taxonomy, Bindings, Programs, Holes, Endpoints, Patterns, Outcomes
  upsertTaxonomy(t: TaxonomyGlobal): TaxonomyGlobal;
  upsertBinding(b: ProviderBinding): ProviderBinding;
  upsertProgram(p: ActionProgram): ActionProgram;
  // ... extensive CRUD methods
}
```

### Migration with Backup

```typescript
// From: cap-store/src/storage/db.ts (lines 573-608)
function createPreMigrationBackup(dbPath: string, version: number): string {
  // Creates timestamped backup
  // Keeps last 5 backups, prunes older ones
  // Returns backup path
}
```

### Method Attachment Pattern

```typescript
// From: cap-store/src/storage/db.ts (lines 12-22)
import {
  attachProviderMethods, attachStrategyMethods, attachRuleMethods,
  attachLearningMethods, attachBindingEventMethods,
  // ... many more attachments
} from './v02.js';
```

### Integration Points for vivim-final

- **Current State:** vivim-final has basic Prisma storage but lacks migration backups
- **Adaptation Strategy:**
  1. Add pre-migration backup system
  2. Implement method attachment pattern for extensibility
  3. Add comprehensive migration tracking
- **Recommended Location:** `src/storage/migration/` - add backup system

---

## 7. Data Math Algorithms

### Token Estimation

```rust
// From: backend/src/cortex/dcb/mod.rs (lines 12-14)
pub fn estimate_tokens(s: &str) -> usize {
    s.len().div_ceil(4)  // ~4 chars per token
}
```

### Recency Decay

```rust
// From: backend/src/cortex/dcb/composer.rs (lines 557-559)
fn recency_decay(secs: u64) -> f64 {
    (-(secs as f64) / (7.0 * 86400.0)).exp()  // 7-day half-life
}
```

### Freshness Computation

```rust
// From: backend/src/cortex/dcb/mod.rs (lines 84-100)
pub fn compute_freshness(
    composed_against: u64,
    current_version: u64,
    updated_at: &str,
) -> cards::CardFreshness {
    // Live: composed within last 60 seconds
    // Fresh: composed against current version
    // Stale: snapshot advanced since composition
}
```

### Integration Points for vivim-final

- **Current State:** vivim-final has basic token counting
- **Adaptation Strategy:**
  1. Add recency decay to context scoring
  2. Implement freshness tracking for cached data
  3. Add token estimation to all content processing
- **Recommended Location:** `src/lib/data-math.ts` - new utility module

---

## 8. Cross-Reference Analysis

### Architecture Mapping

| Edge-PWA Component | vivim-final Equivalent | Gap Analysis |
|-------------------|----------------------|-------------|
| DCB System | context-assembly.ts | DCB has 8-layer system vs simpler assembly |
| Memory Engine | memory-engine.ts | FSRS-6 and cognitive classification missing |
| Storage Dedup | None | No message deduplication system |
| Bundle Compiler | None | No pre-compiled context caching |
| Cap-Store DB | storage/db.ts | Missing migration backups |
| LCG Store | None | No local context graph |

### Priority Recommendations

**High Priority (Immediate Value):**
1. **DCB Layer System** - Enhance context assembly with profile-based composition
2. **Memory Classification** - Add cognitive science types to memory engine
3. **Deduplication** - Implement message identity hashing

**Medium Priority (Strategic Value):**
4. **FSRS-6 Spaced Repetition** - Add to memory system for long-term retention
5. **Bundle Compiler** - Pre-compile identity/preferences contexts
6. **Relevance Decay** - Add time-based scoring to all relevance calculations

**Low Priority (Optimization):**
7. **Storage Compaction** - Add SQLite compaction for long-running instances
8. **Migration Backups** - Add safety net for schema changes
9. **Content Blocks** - Add structured content to message parts

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Add MemoryType enum to memory-engine.ts
- [ ] Implement message identity hashing
- [ ] Add basic DCB profile enum
- [ ] Create data-math utility module

### Phase 2: Core Systems (Week 3-4)
- [ ] Port DCB layer system to context-assembly.ts
- [ ] Implement relevance decay algorithm
- [ ] Add bundle compiler for identity contexts
- [ ] Create deduplication upsert logic

### Phase 3: Advanced Features (Week 5-6)
- [ ] Implement FSRS-6 spaced repetition
- [ ] Add provenance tracking to context assembly
- [ ] Implement storage lifecycle management
- [ ] Add migration backup system

### Phase 4: Integration (Week 7-8)
- [ ] Integrate DCB with existing conversation system
- [ ] Add ACU metadata to message parts
- [ ] Implement content block system
- [ ] Add comprehensive testing

---

## 10. Code Extraction Guide

### Direct Port (Minimal Changes)

These files can be ported with minimal adaptation:

1. **storage/dedup.rs** → `src/storage/dedup.ts`
   - Convert Rust to TypeScript
   - Replace SHA256 with Node.js crypto
   - Keep algorithm intact

2. **cortex/bundle.rs** → `src/engines/bundle-compiler.ts`
   - Direct port of compilation logic
   - Adapt to Prisma instead of VivimDB
   - Keep bundle structure

### Algorithm Port (Core Logic)

Extract core algorithms and adapt to vivim-final patterns:

1. **memory_engine.rs relevance decay** → `src/engines/memory-engine.ts`
   - Port calculate_relevance function
   - Integrate with existing memory scoring
   - Add time-based decay to current system

2. **dcb/composer.rs layer builders** → `src/engines/context-assembly.ts`
   - Extract layer building logic
   - Adapt to vivim-final data sources
   - Keep profile-based selection

### Architectural Adaptation

These require significant adaptation to vivim-final architecture:

1. **DCB System** → New `src/engines/dcb/` module
   - Port core ContextEngine structure
   - Adapt to Prisma storage
   - Integrate with existing engines

2. **Cap-Store DB** → Enhance `src/storage/db.ts`
   - Add migration backup system
   - Implement method attachment pattern
   - Keep existing Prisma interface

---

## 11. Testing Strategy

### Unit Tests

Extract and adapt test patterns from source:

```rust
// From: backend/src/storage/dedup.rs (lines 116-147)
#[cfg(test)]
mod tests {
    #[test]
    fn message_identity_stable() {
        let id1 = message_identity("gemini", "user@g.com", "conv1", "user", "hello", None);
        let id2 = message_identity("gemini", "user@g.com", "conv1", "user", "hello", None);
        assert_eq!(id1, id2);
    }
}
```

### Integration Tests

Test DCB composition with vivim-final data:

```typescript
// Test DCB profile selection
// Test layer building with real conversations
// Test token budget enforcement
// Test freshness computation
```

### Performance Tests

Benchmark critical algorithms:

- Message identity hashing (target: <1ms per message)
- DCB composition (target: <100ms per bundle)
- Relevance decay calculation (target: <0.1ms per memory)
- Bundle compilation (target: <50ms per bundle)

---

## 12. Risk Assessment

### Technical Risks

1. **Schema Mismatch** - vivim-final Prisma schema may not support DCB fields
   - **Mitigation:** Add migration path for new fields
   - **Priority:** High

2. **Performance Impact** - DCB composition may add latency
   - **Mitigation:** Implement aggressive caching
   - **Priority:** Medium

3. **Data Migration** - Existing conversations lack ACU/DCB metadata
   - **Mitigation:** Backfill with default values
   - **Priority:** Low

### Integration Risks

1. **Breaking Changes** - Memory engine changes may affect existing code
   - **Mitigation:** Add backward compatibility layer
   - **Priority:** High

2. **Storage Complexity** - Deduplication adds write overhead
   - **Mitigation:** Batch deduplication operations
   - **Priority:** Medium

---

## 13. Success Metrics

### Quantitative Metrics

- **DCB Adoption:** % of conversations using DCB profiles
- **Memory Classification:** % of memories with cognitive types
- **Deduplication Rate:** % of messages deduplicated
- **Bundle Cache Hit Rate:** % of bundle requests served from cache
- **Relevance Decay Impact:** % improvement in memory relevance scoring

### Qualitative Metrics

- **Context Quality:** User feedback on context relevance
- **System Performance:** Latency measurements for DCB composition
- **Data Consistency:** Reduction in duplicate content
- **Developer Experience:** Ease of extending DCB profiles

---

## 14. Conclusion

This intelligence pack provides a comprehensive extraction of high-value code patterns from the edge-pwa repository. The DCB system, memory engine with FSRS-6, and storage patterns represent sophisticated approaches to context management and data persistence that can significantly enhance vivim-final's capabilities.

**Recommended Next Steps:**
1. Review this pack with the vivim-final team
2. Prioritize features based on current roadmap
3. Begin with Phase 1 foundation work
4. Establish testing strategy before implementation
5. Create feature branches for each major component

**Estimated Effort:**
- Phase 1: 2 weeks (1 developer)
- Phase 2: 2 weeks (1-2 developers)
- Phase 3: 2 weeks (2 developers)
- Phase 4: 2 weeks (2 developers)
- **Total:** 8 weeks for full implementation

---

## Appendix A: File Inventory

### Source Files Analyzed

1. `backend/src/memory_engine.rs` (1010 lines)
2. `backend/src/types.rs` (908 lines)
3. `backend/src/storage/dedup.rs` (148 lines)
4. `backend/src/storage/ops.rs` (166 lines)
5. `backend/src/storage/lifecycle.rs` (112 lines)
6. `backend/src/cortex/mod.rs` (408 lines)
7. `backend/src/cortex/bundle.rs` (192 lines)
8. `backend/src/cortex/dcb/mod.rs` (845 lines)
9. `backend/src/cortex/dcb/composer.rs` (653 lines)
10. `cap-store/src/storage/db.ts` (1105 lines)

### Target Files for Modification

1. `src/engines/memory-engine.ts`
2. `src/engines/context-assembly.ts`
3. `src/storage/db.ts`
4. `src/domain/types.ts`
5. `src/lib/data-math.ts` (new)
6. `src/storage/dedup.ts` (new)
7. `src/engines/bundle-compiler.ts` (new)
8. `src/engines/dcb/` (new module)

---

## Appendix B: Glossary

- **ACU** - Atomic Chat Unit: Granular, reusable conversation building block
- **DCB** - Dynamic Context Bundle: Intelligent, layered context assembly
- **FSRS-6** - Free Spaced Repetition Scheduler v6: Algorithm for optimal review scheduling
- **LCG** - Local Context Graph: Knowledge graph of local context
- **TTL** - Time To Live: Expiration policy for stored data
- **Provenance** - Source tracking for data origin and lineage
- **Freshness** - Measure of how up-to-date cached data is
- **Relevance Decay** - Time-based reduction in content relevance score
- **Layer** - Hierarchical context component (L0-L7)
- **Profile** - DCB composition strategy (Seed, Reunion, etc.)

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-13  
**Status:** Ready for Review  
