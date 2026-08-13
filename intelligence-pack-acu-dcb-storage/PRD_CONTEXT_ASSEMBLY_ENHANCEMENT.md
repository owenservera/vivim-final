# PRD: Context Assembly Enhancement - DCB Profiles and Bundle Compiler

**Product:** vivim-final Context Assembly Engine  
**Source:** edge-pwa backend/src/cortex/dcb/, backend/src/cortex/budget.rs, backend/src/cortex/bundle.rs  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13

---

## 1. Executive Summary

This PRD details the enhancement of the vivim-final context assembly engine with Dynamic Context Bundle (DCB) profiles, sophisticated budget allocation algorithms, and a bundle compiler for pre-compiled context caching. These enhancements will transform the context assembly from a simple 5-stage pipeline to an intelligent, profile-driven system that optimizes context composition for different conversation scenarios.

**Key Deliverables:**
- DCB profile system with 8 profile types
- 8-layer context system (L0-L7) with profile-based activation
- 4-phase budget allocation algorithm with pressure signals
- Bundle compiler for pre-compiled identity/preferences contexts
- Freshness computation for cached context layers
- Structured provenance tracking

**Estimated Effort:** 2 weeks  
**Risk Level:** Low (additive changes, well-defined algorithms)

---

## 2. Background

### 2.1 Current State

vivim-final context assembly has:
- 5-stage pipeline: DETECT → RECALL → RANK → BUDGET → INJECT
- 7 context layers with task-type priorities
- Budget allocation per task type (percentage-based)
- Predictive pre-warming with usage patterns
- Relevance-based truncation with embeddings
- No DCB profiles, no bundle compiler, no provenance tracking

### 2.2 Problem Statement

The current context assembly lacks:
1. **Profile-Based Composition:** No intelligent context profiles for different scenarios
2. **Sophisticated Budget Allocation:** Simple percentage-based allocation without pressure signals
3. **Pre-Compiled Caching:** No bundle compiler for identity/preferences contexts
4. **Freshness Tracking:** No freshness computation for cached layers
5. **Structured Provenance:** Basic sources array without structured tracking

### 2.3 Solution Overview

Implement DCB profile system, 4-phase budget allocation, and bundle compiler from edge-pwa to create an intelligent context assembly system that:
- Selects appropriate context profiles based on conversation scenario
- Allocates budget using sophisticated 4-phase algorithm with pressure signals
- Pre-compiles and caches identity/preferences contexts
- Tracks freshness of cached layers
- Maintains structured provenance for all context items

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: DCB Profile System

**FR-1.1:** Implement DcbProfile enum with 8 profile types:
- Seed (minimal context for new conversations)
- Reunion (re-engagement with past context)
- Convergence (deep context synthesis)
- Continuum (continuous context flow)
- Handoff (cross-session transfer)
- Probe (exploratory context)
- DeepResearch (maximum context depth)
- DecisionBrief (focused decision support)

**FR-1.2:** Implement profile-to-layer activation matrix:
```
Seed: [L0Identity, L1GlobalPrefs, L7UserQuery]
Reunion: [L0Identity, L1GlobalPrefs, L2Topic, L3Entity, L5JitContext, L7UserQuery]
Convergence: [L0Identity, L1GlobalPrefs, L2Topic, L3Entity, L5JitContext, L6RecentHistory, L7UserQuery]
Continuum: [L0Identity, L1GlobalPrefs, L2Topic, L3Entity, LpProjectState, LdDecisions, L4Conversation, L6RecentHistory, L7UserQuery]
Handoff: [L0Identity, L3Entity, LpProjectState, LdDecisions, L4Conversation, L6RecentHistory, L7UserQuery]
Probe: [L0Identity, L1GlobalPrefs, L2Topic, L3Entity, L5JitContext, L7UserQuery]
DeepResearch: [L0Identity, L1GlobalPrefs, L2Topic, L3Entity, LpProjectState, L5JitContext, L6RecentHistory, L7UserQuery]
DecisionBrief: [L0Identity, L1GlobalPrefs, L3Entity, LpProjectState, LdDecisions, L7UserQuery]
```

**FR-1.3:** Map existing TaskType to DcbProfile:
```
coding → DeepResearch
writing → Continuum
researching → DeepResearch
debugging → Convergence
planning → DecisionBrief
learning → Probe
reviewing → Convergence
designing → Continuum
data_analysis → DeepResearch
general → Seed
```

**FR-1.4:** Implement profile selection based on conversation state:
- New conversation → Seed
- Returning conversation → Reunion
- Active project → Continuum
- Decision context → DecisionBrief
- Research context → DeepResearch

#### FR-2: 8-Layer Context System

**FR-2.1:** Extend layer system from 7 to 8 layers:
- L0Identity (user profile and core identity)
- L1GlobalPrefs (formatting and tone preferences)
- L2Topic (topic-specific context)
- L3Entity (entity relationships)
- LpProjectState (project state)
- LdDecisions (decision history)
- L4Conversation (active conversation context)
- L5JitContext (just-in-time context)
- L6RecentHistory (recent conversation history)
- L7UserQuery (current user query)

**FR-2.2:** Implement layer builders for each layer type
**FR-2.3:** Add L5JitContext builder for real-time context injection
**FR-2.4:** Split L6RecentHistory from L4Conversation for better granularity

#### FR-3: 4-Phase Budget Allocation Algorithm

**FR-3.1:** Implement default layer configs with min/ideal/max tokens:
```
L0Identity: min=200, ideal=1000, max=2500, priority=2, elasticity=0.3
L1GlobalPrefs: min=100, ideal=500, max=1500, priority=3, elasticity=0.5
L2Topic: min=500, ideal=3000, max=8000, priority=3, elasticity=0.8
L3Entity: min=200, ideal=1500, max=4000, priority=4, elasticity=0.7
LpProjectState: min=200, ideal=1500, max=4000, priority=4, elasticity=0.7
LdDecisions: min=150, ideal=1000, max=3000, priority=4, elasticity=0.6
L4Conversation: min=1000, ideal=6000, max=16000, priority=1, elasticity=0.9
L5JitContext: min=300, ideal=2000, max=6000, priority=1, elasticity=0.6
L6RecentHistory: min=500, ideal=4000, max=12000, priority=1, elasticity=0.8
L7UserQuery: min=300, ideal=1000, max=4000, priority=0, elasticity=0.0
```

**FR-3.2:** Implement depth mode adjustments:
```
Deep: min×1.2, ideal×1.3, max×1.5
Compact: min×0.7, ideal×0.6, max×0.5
Standard: no adjustment
```

**FR-3.3:** Implement 4-phase allocation algorithm:

**Phase 1:** Allocate minimum tokens to all layers
```
sum_min = Σ layer.min_tokens
if budget <= sum_min: goto Phase 4
else: allocate min_tokens to all layers
remaining = budget - sum_min
```

**Phase 2:** Proportional build-up to ideal
```
room_to_ideal = Σ (layer.ideal_tokens - layer.min_tokens)
if room_to_ideal > 0 and remaining > 0:
    allocated_extra = min(remaining, room_to_ideal)
    for each layer:
        share = allocated_extra × (layer.room / room_to_ideal)
        layer.allocated_tokens += share
    remaining -= allocated_extra
```

**Phase 3:** Priority overflow to max
```
for each priority level (ascending):
    group_room = Σ (layer.max_tokens - layer.current_tokens)
    if group_room > 0 and remaining > 0:
        allocated_group_extra = min(remaining, group_room)
        for each layer in group:
            share = allocated_group_extra × (layer.room / group_room)
            layer.allocated_tokens += share
        remaining -= allocated_group_extra
```

**Phase 4:** Cut-to-fit deficit recovery
```
if budget <= sum_min:
    # Protect fixed layers (L7, then L0)
    allocate L7UserQuery.min_tokens
    allocate L0Identity.min_tokens
    # Allocate remaining by priority (ascending)
    for each layer (sorted by priority ascending):
        allocate layer.min_tokens (if budget remains)
```

**FR-3.4:** Implement pressure signal adjustments:
```
if conversation_pressure:
    L2Topic: ideal×0.6, max×0.6
if entity_count > 20:
    L3Entity: ideal×1.5, max×1.5
if message_history_ratio > 3.0:
    L6RecentHistory: ideal×0.5, max×0.5
```

**FR-3.5:** Implement item packing algorithm:
```
# Fixed layers first (L0, L7)
for layer in [L0Identity, L7UserQuery]:
    sort items by score descending
    add items while budget allows

# Other layers by priority
for layer in other_layers (sorted by priority):
    sort items by score descending
    cap = depth_mode specific (Deep=max, Compact=min, Standard=ideal)
    add items while budget allows and layer cap not exceeded
```

#### FR-4: Bundle Compiler

**FR-4.1:** Implement ContextBundle structure:
```typescript
interface ContextBundle {
  id: string
  userId: string
  bundleType: "identity_core" | "global_prefs" | "topic" | "entity" | "conversation"
  topicProfileId?: string
  entityProfileId?: string
  conversationId?: string
  personaId?: string
  compiledPrompt: string  // Formatted Markdown
  tokenCount: number
  version: number
  isDirty: boolean
  compiledAt: string
}
```

**FR-4.2:** Implement bundle types:
- identity_core (user profile and core identity)
- global_prefs (formatting and tone preferences)
- topic (domain-specific knowledge)
- entity (project/agent/client summaries)
- conversation (conversation arc and decisions)

**FR-4.3:** Implement lazy recompilation:
```
get_bundle(account_id, bundle_type, ref_id):
    key = f"{account_id}:{bundle_type}:{ref_id}"
    existing = db.get("context_bundles", key)
    
    if existing and not existing.is_dirty:
        return existing
    
    if existing and existing.is_dirty:
        compiled = compile(bundle_type, ref_id, existing.version + 1)
        db.put(key, compiled)
        return compiled
    
    compiled = compile(bundle_type, ref_id, 1)
    db.put(key, compiled)
    return compiled
```

**FR-4.4:** Implement bundle invalidation:
```
invalidate_bundle(account_id, bundle_type, ref_id):
    key = f"{account_id}:{bundle_type}:{ref_id}"
    existing = db.get("context_bundles", key)
    if existing:
        existing.is_dirty = true
        db.put(key, existing)
```

**FR-4.5:** Implement bundle compilation for each type:
- identity_core: Fetch high-importance memories (importance ≥ 0.8)
- global_prefs: Static formatting preferences
- topic: Domain-specific context compilation
- entity: Entity summary compilation
- conversation: Recent messages + arc summary + decisions

#### FR-5: Freshness Computation

**FR-5.1:** Implement CardFreshness enum:
```typescript
enum CardFreshness {
  Live,      // Composed within last 60 seconds
  Fresh,     // Composed against current version
  Stale,     // Composed against old version
}
```

**FR-5.2:** Implement freshness computation:
```
compute_freshness(composed_against_version, current_version, updated_at):
    age = now - updated_at
    if age < LIVE_WINDOW_SECS (60):
        return Live
    
    if composed_against_version < current_version:
        return Stale
    
    return Fresh
```

**FR-5.3:** Add freshness to cached context layers
**FR-5.4:** Implement version tracking for snapshot-based freshness

#### FR-6: Structured Provenance

**FR-6.1:** Implement ProvenanceSource enum:
```typescript
enum ProvenanceSource {
  Identity,
  Prefs,
  Conversation,
  Project,
  Decision,
  Retrieval,
  Entity,
}
```

**FR-6.2:** Implement Provenance structure:
```typescript
interface Provenance {
  source: ProvenanceSource
  convId?: string
  provider?: string
  accountId?: string
  timestamp?: string
  label: string
}
```

**FR-6.3:** Add provenance to ContextLayer
**FR-6.4:** Track provenance for all context items

#### FR-7: Recency Decay

**FR-7.1:** Implement recency decay for layer items:
```
recency_decay(secs):
    return exp(-secs / (7 × 86400))  # 7-day half-life
```

**FR-7.2:** Apply recency decay to layer item scoring:
```
item_score = item.confidence × recency_decay(item.recency_secs)
```

### 3.2 Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** DCB composition latency < 100ms per bundle
**NFR-1.2:** Budget allocation latency < 10ms
**NFR-1.3:** Bundle compilation latency < 50ms per bundle
**NFR-1.4:** Freshness computation < 1ms per layer

#### NFR-2: Accuracy

**NFR-2.1:** Budget allocation must respect budget constraint
**NFR-2.2:** Layer activation must match profile matrix
**NFR-2.3:** Freshness computation must be deterministic

#### NFR-3: Reliability

**NFR-3.1:** Bundle compiler must handle missing data gracefully
**NFR-3.2:** Budget allocation must handle edge cases (zero budget, etc.)
**NFR-3.3:** Freshness computation must handle invalid timestamps

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible
**NFR-4.2:** Existing 7-layer system must continue to work
**NFR-4.3:** API changes must be additive

---

## 4. Technical Design

### 4.1 Data Model Changes

#### 4.1.1 DcbProfile Enum

```typescript
// src/engines/context-assembly.ts

export enum DcbProfile {
  Seed = 'Seed',
  Reunion = 'Reunion',
  Convergence = 'Convergence',
  Continuum = 'Continuum',
  Handoff = 'Handoff',
  Probe = 'Probe',
  DeepResearch = 'DeepResearch',
  DecisionBrief = 'DecisionBrief',
}
```

#### 4.1.2 LayerType Enum

```typescript
export enum LayerType {
  L0Identity = 'L0Identity',
  L1GlobalPrefs = 'L1GlobalPrefs',
  L2Topic = 'L2Topic',
  L3Entity = 'L3Entity',
  LpProjectState = 'LpProjectState',
  LdDecisions = 'LdDecisions',
  L4Conversation = 'L4Conversation',
  L5JitContext = 'L5JitContext',
  L6RecentHistory = 'L6RecentHistory',
  L7UserQuery = 'L7UserQuery',
}
```

#### 4.1.3 Profile Layer Matrix

```typescript
const PROFILE_LAYERS: Record<DcbProfile, LayerType[]> = {
  [DcbProfile.Seed]: [
    LayerType.L0Identity,
    LayerType.L1GlobalPrefs,
    LayerType.L7UserQuery,
  ],
  [DcbProfile.Reunion]: [
    LayerType.L0Identity,
    LayerType.L1GlobalPrefs,
    LayerType.L2Topic,
    LayerType.L3Entity,
    LayerType.L5JitContext,
    LayerType.L7UserQuery,
  ],
  [DcbProfile.Convergence]: [
    LayerType.L0Identity,
    LayerType.L1GlobalPrefs,
    LayerType.L2Topic,
    LayerType.L3Entity,
    LayerType.L5JitContext,
    LayerType.L6RecentHistory,
    LayerType.L7UserQuery,
  ],
  [DcbProfile.Continuum]: [
    LayerType.L0Identity,
    LayerType.L1GlobalPrefs,
    LayerType.L2Topic,
    LayerType.L3Entity,
    LayerType.LpProjectState,
    LayerType.LdDecisions,
    LayerType.L4Conversation,
    LayerType.L6RecentHistory,
    LayerType.L7UserQuery,
  ],
  [DcbProfile.Handoff]: [
    LayerType.L0Identity,
    LayerType.L3Entity,
    LayerType.LpProjectState,
    LayerType.LdDecisions,
    LayerType.L4Conversation,
    LayerType.L6RecentHistory,
    LayerType.L7UserQuery,
  ],
  [DcbProfile.Probe]: [
    LayerType.L0Identity,
    LayerType.L1GlobalPrefs,
    LayerType.L2Topic,
    LayerType.L3Entity,
    LayerType.L5JitContext,
    LayerType.L7UserQuery,
  ],
  [DcbProfile.DeepResearch]: [
    LayerType.L0Identity,
    LayerType.L1GlobalPrefs,
    LayerType.L2Topic,
    LayerType.L3Entity,
    LayerType.LpProjectState,
    LayerType.L5JitContext,
    LayerType.L6RecentHistory,
    LayerType.L7UserQuery,
  ],
  [DcbProfile.DecisionBrief]: [
    LayerType.L0Identity,
    LayerType.L1GlobalPrefs,
    LayerType.L3Entity,
    LayerType.LpProjectState,
    LayerType.LdDecisions,
    LayerType.L7UserQuery,
  ],
};
```

#### 4.1.4 TaskType to DcbProfile Mapping

```typescript
const TASK_TYPE_TO_DCB_PROFILE: Record<TaskType, DcbProfile> = {
  coding: DcbProfile.DeepResearch,
  writing: DcbProfile.Continuum,
  researching: DcbProfile.DeepResearch,
  debugging: DcbProfile.Convergence,
  planning: DcbProfile.DecisionBrief,
  learning: DcbProfile.Probe,
  reviewing: DcbProfile.Convergence,
  designing: DcbProfile.Continuum,
  data_analysis: DcbProfile.DeepResearch,
  general: DcbProfile.Seed,
};
```

### 4.2 Algorithm Implementation

#### 4.2.1 4-Phase Budget Allocation

```typescript
// src/engines/budget-allocator.ts

interface BudgetConfig {
  layer: LayerType
  minTokens: number
  idealTokens: number
  maxTokens: number
  priority: number
  elasticity: number
}

interface LayerAllocation {
  layer: LayerType
  allocatedTokens: number
}

enum DepthMode {
  Standard,
  Deep,
  Compact,
}

class BudgetAllocator {
  static DEFAULT_CONFIGS: BudgetConfig[] = [
    {
      layer: LayerType.L0Identity,
      minTokens: 200,
      idealTokens: 1000,
      maxTokens: 2500,
      priority: 2,
      elasticity: 0.3,
    },
    {
      layer: LayerType.L1GlobalPrefs,
      minTokens: 100,
      idealTokens: 500,
      maxTokens: 1500,
      priority: 3,
      elasticity: 0.5,
    },
    {
      layer: LayerType.L2Topic,
      minTokens: 500,
      idealTokens: 3000,
      maxTokens: 8000,
      priority: 3,
      elasticity: 0.8,
    },
    {
      layer: LayerType.L3Entity,
      minTokens: 200,
      idealTokens: 1500,
      maxTokens: 4000,
      priority: 4,
      elasticity: 0.7,
    },
    {
      layer: LayerType.LpProjectState,
      minTokens: 200,
      idealTokens: 1500,
      maxTokens: 4000,
      priority: 4,
      elasticity: 0.7,
    },
    {
      layer: LayerType.LdDecisions,
      minTokens: 150,
      idealTokens: 1000,
      maxTokens: 3000,
      priority: 4,
      elasticity: 0.6,
    },
    {
      layer: LayerType.L4Conversation,
      minTokens: 1000,
      idealTokens: 6000,
      maxTokens: 16000,
      priority: 1,
      elasticity: 0.9,
    },
    {
      layer: LayerType.L5JitContext,
      minTokens: 300,
      idealTokens: 2000,
      maxTokens: 6000,
      priority: 1,
      elasticity: 0.6,
    },
    {
      layer: LayerType.L6RecentHistory,
      minTokens: 500,
      idealTokens: 4000,
      maxTokens: 12000,
      priority: 1,
      elasticity: 0.8,
    },
    {
      layer: LayerType.L7UserQuery,
      minTokens: 300,
      idealTokens: 1000,
      maxTokens: 4000,
      priority: 0,
      elasticity: 0.0,
    },
  ];

  /**
   * 4-phase budget allocation algorithm
   */
  static allocate(
    budget: number,
    configs: BudgetConfig[],
    depthMode: DepthMode = DepthMode.Standard
  ): LayerAllocation[] {
    // Apply depth mode adjustments
    const adjustedConfigs = configs.map(config => {
      const c = { ...config };
      switch (depthMode) {
        case DepthMode.Deep:
          c.minTokens = Math.floor(c.minTokens * 1.2);
          c.idealTokens = Math.floor(c.idealTokens * 1.3);
          c.maxTokens = Math.floor(c.maxTokens * 1.5);
          break;
        case DepthMode.Compact:
          c.minTokens = Math.floor(c.minTokens * 0.7);
          c.idealTokens = Math.floor(c.idealTokens * 0.6);
          c.maxTokens = Math.floor(c.maxTokens * 0.5);
          break;
        case DepthMode.Standard:
          break;
      }
      return c;
    });

    const allocations = new Map<LayerType, number>();
    for (const config of adjustedConfigs) {
      allocations.set(config.layer, 0);
    }

    const sumMin = adjustedConfigs.reduce((sum, c) => sum + c.minTokens, 0);

    if (budget <= sumMin) {
      // Phase 4: Cut-to-fit deficit recovery
      return this.allocatePhase4(budget, adjustedConfigs);
    }

    // Phase 1: Allocate minimum tokens
    for (const config of adjustedConfigs) {
      allocations.set(config.layer, config.minTokens);
    }

    let remaining = budget - sumMin;

    // Phase 2: Proportional build-up to ideal
    const roomToIdeal = adjustedConfigs.map(c => ({
      layer: c.layer,
      room: Math.max(0, c.idealTokens - c.minTokens),
    }));
    const sumRoom = roomToIdeal.reduce((sum, r) => sum + r.room, 0);

    if (sumRoom > 0 && remaining > 0) {
      const allocatedExtra = Math.min(remaining, sumRoom);
      let totalExtraAllocated = 0;

      for (const { layer, room } of roomToIdeal) {
        const share = Math.floor(allocatedExtra * (room / sumRoom));
        allocations.set(layer, (allocations.get(layer) || 0) + share);
        totalExtraAllocated += share;
      }

      // Distribute remainder
      let diff = allocatedExtra - totalExtraAllocated;
      for (const { layer, room } of roomToIdeal) {
        if (diff === 0) break;
        if (room > 0) {
          allocations.set(layer, (allocations.get(layer) || 0) + 1);
          diff--;
        }
      }

      remaining -= allocatedExtra;
    }

    // Phase 3: Priority overflow to max
    if (remaining > 0) {
      const priorities = [...new Set(adjustedConfigs.map(c => c.priority))].sort();

      for (const priority of priorities) {
        if (remaining === 0) break;

        const layerRoom = adjustedConfigs
          .filter(c => c.priority === priority)
          .map(c => ({
            layer: c.layer,
            room: Math.max(0, c.maxTokens - (allocations.get(c.layer) || 0)),
          }))
          .filter(lr => lr.room > 0);

        const sumGroupRoom = layerRoom.reduce((sum, lr) => sum + lr.room, 0);

        if (sumGroupRoom > 0) {
          const allocatedGroupExtra = Math.min(remaining, sumGroupRoom);
          let totalGroupAllocated = 0;

          for (const { layer, room } of layerRoom) {
            const share = Math.floor(allocatedGroupExtra * (room / sumGroupRoom));
            allocations.set(layer, (allocations.get(layer) || 0) + share);
            totalGroupAllocated += share;
          }

          // Distribute remainder
          let diff = allocatedGroupExtra - totalGroupAllocated;
          for (const { layer } of layerRoom) {
            if (diff === 0) break;
            allocations.set(layer, (allocations.get(layer) || 0) + 1);
            diff--;
          }

          remaining -= allocatedGroupExtra;
        }
      }
    }

    return adjustedConfigs.map(config => ({
      layer: config.layer,
      allocatedTokens: allocations.get(config.layer) || 0,
    }));
  }

  /**
   * Phase 4: Cut-to-fit deficit recovery
   */
  private static allocatePhase4(budget: number, configs: BudgetConfig[]): LayerAllocation[] {
    const allocations = new Map<LayerType, number>();
    let remaining = budget;

    // Protect fixed layers (L7, then L0)
    for (const target of [LayerType.L7UserQuery, LayerType.L0Identity]) {
      const config = configs.find(c => c.layer === target);
      if (config) {
        const alloc = Math.min(config.minTokens, remaining);
        allocations.set(target, alloc);
        remaining -= alloc;
      }
    }

    // Remaining layers by priority (ascending)
    const rest = configs
      .filter(c => ![
        LayerType.L0Identity,
        LayerType.L7UserQuery,
      ].includes(c.layer))
      .sort((a, b) => a.priority - b.priority);

    for (const config of rest) {
      if (remaining <= 0) break;
      const alloc = Math.min(config.minTokens, remaining);
      allocations.set(config.layer, alloc);
      remaining -= alloc;
    }

    return configs.map(config => ({
      layer: config.layer,
      allocatedTokens: allocations.get(config.layer) || 0,
    }));
  }
}
```

#### 4.2.2 Bundle Compiler

```typescript
// src/engines/bundle-compiler.ts

interface ContextBundle {
  id: string
  userId: string
  bundleType: 'identity_core' | 'global_prefs' | 'topic' | 'entity' | 'conversation'
  topicProfileId?: string
  entityProfileId?: string
  conversationId?: string
  personaId?: string
  compiledPrompt: string
  tokenCount: number
  version: number
  isDirty: boolean
  compiledAt: string
}

class BundleCompiler {
  constructor(private storage: ContextAssemblyStore) {}

  /**
   * Get or compile a context bundle with lazy recompilation
   */
  async getBundle(
    accountId: string,
    bundleType: string,
    refId?: string
  ): Promise<ContextBundle | null> {
    const refKey = refId || 'default';
    const key = `${accountId}:${bundleType}:${refKey}`;

    const existing = await this.storage.getBundle(key);
    if (existing && !existing.isDirty) {
      return existing;
    }

    if (existing && existing.isDirty) {
      const compiled = await this.compile(accountId, bundleType, refId, existing.version + 1);
      await this.storage.saveBundle(key, compiled);
      return compiled;
    }

    const compiled = await this.compile(accountId, bundleType, refId, 1);
    await this.storage.saveBundle(key, compiled);
    return compiled;
  }

  /**
   * Invalidate a bundle to trigger lazy recompilation
   */
  async invalidateBundle(
    accountId: string,
    bundleType: string,
    refId?: string
  ): Promise<void> {
    const refKey = refId || 'default';
    const key = `${accountId}:${bundleType}:${refKey}`;

    const existing = await this.storage.getBundle(key);
    if (existing) {
      existing.isDirty = true;
      await this.storage.saveBundle(key, existing);
    }
  }

  /**
   * Compile a context bundle
   */
  private async compile(
    accountId: string,
    bundleType: string,
    refId?: string,
    version: number = 1
  ): Promise<ContextBundle> {
    let prompt = '';

    switch (bundleType) {
      case 'identity_core':
        prompt = await this.compileIdentityCore(accountId);
        break;
      case 'global_prefs':
        prompt = this.compileGlobalPrefs();
        break;
      case 'topic':
        prompt = this.compileTopic(refId || 'general');
        break;
      case 'entity':
        prompt = this.compileEntity(refId || 'unknown');
        break;
      case 'conversation':
        prompt = await this.compileConversation(refId || 'none');
        break;
      default:
        prompt = '# Generic Context Bundle\n';
    }

    const tokenCount = Math.ceil(prompt.length / 4);

    return {
      id: `bundle-${crypto.randomUUID()}`,
      userId: accountId,
      bundleType: bundleType as any,
      topicProfileId: bundleType === 'topic' ? refId : undefined,
      entityProfileId: bundleType === 'entity' ? refId : undefined,
      conversationId: bundleType === 'conversation' ? refId : undefined,
      personaId: undefined,
      compiledPrompt: prompt,
      tokenCount,
      version,
      isDirty: false,
      compiledAt: new Date().toISOString(),
    };
  }

  private async compileIdentityCore(accountId: string): Promise<string> {
    let prompt = '# User Profile & Core Identity\n\n';
    
    const memories = await this.storage.getHighImportanceMemories(accountId, 0.8);
    if (memories.length === 0) {
      prompt += '- Default sovereign AI workspace user.\n';
    } else {
      for (const memory of memories) {
        prompt += `- ${memory.content}\n`;
      }
    }
    
    return prompt;
  }

  private compileGlobalPrefs(): string {
    return `# Formatting & Tone Preferences\n\n` +
           `- Tone: Professional, direct, local-first.\n` +
           `- Formatting: Clear markdown with code blocks where appropriate.\n`;
  }

  private compileTopic(topic: string): string {
    return `# Topic Knowledge: ${topic}\n\n` +
           `- Context compilation for domain-specific interactions.\n`;
  }

  private compileEntity(entity: string): string {
    return `# Entity Summary: ${entity}\n\n` +
           `- Details on project, agent, or client contacts.\n`;
  }

  private async compileConversation(convId: string): Promise<string> {
    let prompt = `# Conversation Arc [${convId}]\n\n`;

    const messages = await this.storage.getRecentMessages(convId, 6);
    prompt += '## Active Focus (Recent history):\n';
    for (const msg of messages) {
      prompt += `**${msg.role}**: ${msg.content}\n`;
    }

    if (messages.length > 6) {
      prompt += '\n## Arc Summary:\n';
      prompt += '- Thread contains past turns focusing on workspace setup and configuration.\n';
      prompt += '\n## Decisions Reached:\n';
      prompt += '- Local-first database configuration established.\n';
    }

    return prompt;
  }
}
```

#### 4.2.3 Freshness Computation

```typescript
// src/engines/freshness-computer.ts

enum CardFreshness {
  Live = 'Live',
  Fresh = 'Fresh',
  Stale = 'Stale',
}

const LIVE_WINDOW_SECS = 60;

class FreshnessComputer {
  /**
   * Compute freshness by comparing composed version with current version
   */
  static computeFreshness(
    composedAgainstVersion: number,
    currentVersion: number,
    updatedAt: string
  ): CardFreshness {
    const age = (Date.now() - new Date(updatedAt).getTime()) / 1000;
    
    if (Math.abs(age) < LIVE_WINDOW_SECS) {
      return CardFreshness.Live;
    }

    if (composedAgainstVersion < currentVersion) {
      return CardFreshness.Stale;
    }

    return CardFreshness.Fresh;
  }
}
```

#### 4.2.4 Recency Decay

```typescript
// src/engines/recency-decay.ts

class RecencyDecay {
  /**
   * Calculate recency decay with 7-day half-life
   * decay = exp(-secs / (7 × 86400))
   */
  static decay(secs: number): number {
    const HALF_LIFE_SECS = 7 * 86400; // 7 days in seconds
    return Math.exp(-secs / HALF_LIFE_SECS);
  }

  /**
   * Apply recency decay to item score
   * score = confidence × decay(recency_secs)
   */
  static applyToScore(confidence: number, recencySecs: number): number {
    return confidence * this.decay(recencySecs);
  }
}
```

### 4.3 API Design

#### 4.3.1 Enhanced Context Assembly Engine

```typescript
// src/engines/context-assembly.ts

export class ContextAssemblyEngine {
  private bundleCompiler: BundleCompiler;

  constructor(
    // ... existing dependencies ...
    private storage: ContextAssemblyStore,
  ) {
    this.bundleCompiler = new BundleCompiler(storage);
  }

  async assemble(conversationId: string, userMessage: string): Promise<AssembledContext> {
    // Stage 1: DETECT - classify task type and map to DCB profile
    const situation = await this.situationDetector.detect({
      message: userMessage,
      conversationId,
    });

    const dcbProfile = TASK_TYPE_TO_DCB_PROFILE[situation.type] || DcbProfile.Seed;

    // Stage 2: RECALL - pull relevant context using profile-based layers
    const activeLayers = PROFILE_LAYERS[dcbProfile];
    const rawLayers = await this.recallWithProfile(conversationId, userMessage, activeLayers);

    // Stage 3: RANK - sort by profile-specific priorities
    const ranked = this.rankWithProfile(rawLayers, dcbProfile);

    // Stage 4: BUDGET - allocate using 4-phase algorithm
    const { layers, truncated } = await this.allocateBudgetWithProfile(
      ranked,
      dcbProfile,
      userMessage
    );

    // Stage 5: INJECT - persist with freshness tracking
    await this.persistLayersWithFreshness(conversationId, layers);

    return {
      conversationId,
      layers,
      totalTokens: layers.reduce((sum, l) => sum + l.tokenCount, 0),
      budget: this.budget,
      situation,
      assembledAt: Date.now(),
      truncated,
    };
  }

  private async recallWithProfile(
    conversationId: string,
    userMessage: string,
    activeLayers: LayerType[]
  ): Promise<ContextLayer[]> {
    const layers: ContextLayer[] = [];

    // Use bundle compiler for identity and preferences
    if (activeLayers.includes(LayerType.L0Identity)) {
      const identityBundle = await this.bundleCompiler.getBundle(
        accountId,
        'identity_core'
      );
      if (identityBundle) {
        layers.push({
          name: 'identity',
          content: identityBundle.compiledPrompt,
          tokenCount: identityBundle.tokenCount,
          priority: 0.3,
          sources: [`bundle:${identityBundle.id}`],
        });
      }
    }

    if (activeLayers.includes(LayerType.L1GlobalPrefs)) {
      const prefsBundle = await this.bundleCompiler.getBundle(
        accountId,
        'global_prefs'
      );
      if (prefsBundle) {
        layers.push({
          name: 'preferences',
          content: prefsBundle.compiledPrompt,
          tokenCount: prefsBundle.tokenCount,
          priority: 0.4,
          sources: [`bundle:${prefsBundle.id}`],
        });
      }
    }

    // ... other layer builders ...

    return layers;
  }

  private async allocateBudgetWithProfile(
    ranked: ContextLayer[],
    profile: DcbProfile,
    userMessage?: string
  ): Promise<{ layers: ContextLayer[]; truncated: boolean }> {
    // Determine depth mode based on profile
    const depthMode = this.getDepthModeForProfile(profile);

    // Get budget allocations using 4-phase algorithm
    const allocations = BudgetAllocator.allocate(
      this.budget,
      BudgetAllocator.DEFAULT_CONFIGS,
      depthMode
    );

    // Apply allocations to layers
    // ... implementation ...

    return { layers: included, truncated };
  }

  private getDepthModeForProfile(profile: DcbProfile): DepthMode {
    switch (profile) {
      case DcbProfile.DeepResearch:
      case DcbProfile.Convergence:
        return DepthMode.Deep;
      case DcbProfile.Seed:
      case DcbProfile.Probe:
        return DepthMode.Compact;
      default:
        return DepthMode.Standard;
    }
  }
}
```

---

## 5. Implementation Plan

### 5.1 Phase 1: Foundation (Days 1-3)

**Tasks:**
1. Add DcbProfile enum to context-assembly.ts
2. Add LayerType enum (8 layers)
3. Add PROFILE_LAYERS matrix
4. Add TASK_TYPE_TO_DCB_PROFILE mapping
5. Add BudgetConfig interface
6. Add DepthMode enum
7. Implement BudgetAllocator class with 4-phase algorithm

**Deliverables:**
- Core type definitions
- Budget allocator implementation
- Unit tests for budget allocation

**Success Criteria:**
- Budget allocation respects budget constraint
- 4-phase algorithm produces correct allocations
- Unit tests pass

### 5.2 Phase 2: Bundle Compiler (Days 4-6)

**Tasks:**
1. Add ContextBundle interface
2. Implement BundleCompiler class
3. Implement bundle compilation for each type
4. Add lazy recompilation logic
5. Add bundle invalidation logic
6. Integrate with storage layer

**Deliverables:**
- Bundle compiler implementation
- Storage integration
- Integration tests

**Success Criteria:**
- Bundle compiler produces valid bundles
- Lazy recompilation works correctly
- Integration tests pass

### 5.3 Phase 3: Context Assembly Integration (Days 7-10)

**Tasks:**
1. Extend ContextAssemblyEngine with DCB profile selection
2. Implement profile-based layer activation
3. Integrate bundle compiler into recall stage
4. Implement depth mode selection based on profile
5. Add freshness computation to cached layers
6. Add structured provenance tracking

**Deliverables:**
- Enhanced context assembly engine
- Integration tests
- API documentation

**Success Criteria:**
- DCB profiles select correct layers
- Bundle compiler integrates correctly
- Freshness computation works
- No regression in existing functionality

### 5.4 Phase 4: Testing & Optimization (Days 11-14)

**Tasks:**
1. Performance testing (budget allocation, bundle compilation)
2. Accuracy testing (budget allocation, freshness)
3. Load testing (context assembly with profiles)
4. Optimization (caching, batching)
5. Documentation completion

**Deliverables:**
- Performance test report
- Accuracy validation report
- Optimized implementation
- Complete documentation

**Success Criteria:**
- Performance targets met
- Accuracy validated
- Documentation complete

---

## 6. Testing Strategy

### 6.1 Unit Tests

#### Budget Allocation Tests

```typescript
describe('BudgetAllocator', () => {
  test('phase 1: allocate minimum tokens', () => {
    const configs = BudgetAllocator.DEFAULT_CONFIGS;
    const sumMin = configs.reduce((sum, c) => sum + c.minTokens, 0);
    const allocations = BudgetAllocator.allocate(sumMin, configs);
    
    const allocatedSum = allocations.reduce((sum, a) => sum + a.allocatedTokens, 0);
    expect(allocatedSum).toBe(sumMin);
  });

  test('phase 2: proportional build-up to ideal', () => {
    const configs = BudgetAllocator.DEFAULT_CONFIGS;
    const sumIdeal = configs.reduce((sum, c) => sum + c.idealTokens, 0);
    const allocations = BudgetAllocator.allocate(sumIdeal, configs);
    
    const allocatedSum = allocations.reduce((sum, a) => sum + a.allocatedTokens, 0);
    expect(allocatedSum).toBe(sumIdeal);
  });

  test('phase 4: cut-to-fit deficit recovery', () => {
    const configs = BudgetAllocator.DEFAULT_CONFIGS;
    const sumMin = configs.reduce((sum, c) => sum + c.minTokens, 0);
    const allocations = BudgetAllocator.allocate(sumMin - 100, configs);
    
    // L7 and L0 should be protected
    const l7Alloc = allocations.find(a => a.layer === LayerType.L7UserQuery);
    const l0Alloc = allocations.find(a => a.layer === LayerType.L0Identity);
    
    expect(l7Alloc?.allocatedTokens).toBeGreaterThan(0);
    expect(l0Alloc?.allocatedTokens).toBeGreaterThan(0);
  });
});
```

#### Bundle Compiler Tests

```typescript
describe('BundleCompiler', () => {
  test('compile identity_core bundle', async () => {
    const bundle = await bundleCompiler.compile('user1', 'identity_core');
    
    expect(bundle.bundleType).toBe('identity_core');
    expect(bundle.compiledPrompt).toContain('User Profile');
    expect(bundle.tokenCount).toBeGreaterThan(0);
  });

  test('lazy recompilation on dirty flag', async () => {
    const bundle1 = await bundleCompiler.getBundle('user1', 'global_prefs');
    await bundleCompiler.invalidateBundle('user1', 'global_prefs');
    const bundle2 = await bundleCompiler.getBundle('user1', 'global_prefs');
    
    expect(bundle2.version).toBe(bundle1.version + 1);
  });
});
```

#### Freshness Tests

```typescript
describe('FreshnessComputer', () => {
  test('live freshness within 60 seconds', () => {
    const freshness = FreshnessComputer.computeFreshness(1, 1, new Date().toISOString());
    expect(freshness).toBe(CardFreshness.Live);
  });

  test('stale freshness when version mismatched', () => {
    const freshness = FreshnessComputer.computeFreshness(1, 2, new Date(Date.now() - 120000).toISOString());
    expect(freshness).toBe(CardFreshness.Stale);
  });
});
```

### 6.2 Integration Tests

```typescript
describe('ContextAssemblyEngine Integration', () => {
  test('DCB profile selection based on task type', async () => {
    const context = await contextAssembly.assemble(convId, 'debug this code');
    // Should select Convergence profile for debugging
    expect(context.layers.some(l => l.name === 'jit_context')).toBe(true);
  });

  test('bundle compiler integration', async () => {
    const context = await contextAssembly.assemble(convId, 'hello');
    // Should use cached identity bundle
    expect(context.layers.some(l => l.sources.some(s => s.startsWith('bundle:')))).toBe(true);
  });
});
```

### 6.3 Performance Tests

```typescript
describe('Performance Tests', () => {
  test('budget allocation latency', () => {
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      BudgetAllocator.allocate(8000, BudgetAllocator.DEFAULT_CONFIGS);
    }
    
    const elapsed = performance.now() - start;
    expect(elapsed / 1000).toBeLessThan(10); // < 10ms per allocation
  });

  test('bundle compilation latency', async () => {
    const start = performance.now();
    
    for (let i = 0; i < 100; i++) {
      await bundleCompiler.compile('user1', 'identity_core');
    }
    
    const elapsed = performance.now() - start;
    expect(elapsed / 100).toBeLessThan(50); // < 50ms per compilation
  });
});
```

---

## 7. Rollout Plan

### 7.1 Feature Flags

```typescript
const FEATURES = {
  DCB_PROFILES: process.env.FEATURE_DCB_PROFILES === 'true',
  BUNDLE_COMPILER: process.env.FEATURE_BUNDLE_COMPILER === 'true',
  FRESHNESS_TRACKING: process.env.FEATURE_FRESHNESS === 'true',
  STRUCTURED_PROVENANCE: process.env.FEATURE_PROVENANCE === 'true',
};
```

### 7.2 Phased Rollout

**Week 1:** Development environment testing
**Week 2:** Staging environment with production data copy
**Week 3:** 10% production rollout
**Week 4:** 50% production rollout
**Week 5:** 100% production rollout

### 7.3 Monitoring

**Metrics to Track:**
- DCB profile distribution
- Bundle cache hit rate
- Budget allocation latency
- Bundle compilation latency
- Freshness distribution (Live/Fresh/Stale)
- Context assembly latency

**Alerts:**
- Latency > 100ms for context assembly
- Bundle cache hit rate < 50%
- Stale bundle rate > 20%

---

## 8. Success Metrics

### 8.1 Quantitative Metrics

- **DCB Profile Adoption:** % of conversations using DCB profiles (target: 80%)
- **Bundle Cache Hit Rate:** % of bundle requests served from cache (target: 70%)
- **Freshness Accuracy:** % of cached bundles with correct freshness (target: 95%)
- **Budget Allocation Efficiency:** % of budget utilized (target: 90-95%)
- **Performance:** Context assembly latency < 100ms (target: 95% of requests)

### 8.2 Qualitative Metrics

- **Context Quality:** User feedback on context relevance
- **Profile Appropriateness:** User feedback on profile selection
- **Bundle Quality:** User feedback on pre-compiled contexts
- **System Performance:** No degradation in existing functionality

---

## 9. Risks and Mitigations

### 9.1 Technical Risks

**Risk 1:** Budget allocation algorithm incorrectness
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:** Unit tests with known inputs/outputs, validation against reference

**Risk 2:** Bundle compiler performance degradation
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:** Performance testing, caching, lazy compilation

**Risk 3:** Profile selection mismatch
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:** A/B testing, user feedback, profile adjustment

### 9.2 Integration Risks

**Risk 1:** Breaking existing context assembly
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:** All changes additive, backward compatibility, regression testing

### 9.3 Operational Risks

**Risk 1:** Increased memory usage from caching
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:** Cache size limits, TTL-based eviction, monitoring

---

## 10. Appendix

### 10.1 Budget Allocation Reference

The 4-phase budget allocation algorithm implements the following mathematical model:

**Phase 1 (Minimum Allocation):**
```
alloc_i = min_i for all layers i
remaining = budget - Σ min_i
```

**Phase 2 (Proportional Build-up):**
```
room_i = ideal_i - min_i
share_i = remaining × (room_i / Σ room_i)
alloc_i += share_i
```

**Phase 3 (Priority Overflow):**
```
for each priority level p:
    group_room = Σ (max_i - alloc_i) for layers with priority p
    share_i = remaining × (room_i / group_room)
    alloc_i += share_i
```

**Phase 4 (Cut-to-fit):**
```
if budget < Σ min_i:
    alloc_L7 = min_L7 (protected)
    alloc_L0 = min_L0 (protected)
    for layers sorted by priority ascending:
        alloc_i = min_i if budget remains
```

### 10.2 Recency Decay Reference

The recency decay algorithm uses exponential decay with a 7-day half-life:

```
decay(t) = exp(-t / (7 × 86400))
```

Where t is seconds since creation.

### 10.3 Freshness Reference

Freshness computation uses version tracking and time windows:

```
if age < 60 seconds:
    freshness = Live
else if composed_version < current_version:
    freshness = Stale
else:
    freshness = Fresh
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-13  
**Status:** Ready for Review  
