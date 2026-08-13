# PRD: Memory Engine Enhancement - FSRS-6 and Relevance Decay

**Product:** vivim-final Memory Engine  
**Source:** edge-pwa backend/src/memory_engine.rs (lines 816-1010)  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13

---

## 1. Executive Summary

This PRD details the enhancement of the vivim-final memory engine with two critical algorithms from edge-pwa: FSRS-6 spaced repetition scheduling and relevance decay with time-based scoring. These enhancements will transform the memory system from static storage to an intelligent, adaptive learning system that optimizes long-term retention and context relevance.

**Key Deliverables:**
- FSRS-6 spaced repetition algorithm implementation
- Relevance decay with 30-day half-life
- Memory classification with cognitive science types
- Memory snippet extraction for context retrieval

**Estimated Effort:** 2 weeks  
**Risk Level:** Low (well-established algorithms, additive changes)

---

## 2. Background

### 2.1 Current State

vivim-final memory engine has:
- Basic episodic, semantic, and procedural memory stores
- `recordMemory()` method with FSRS-6 fields but no algorithm implementation
- Consolidation logic with dedupe, decay, promote, prune
- No cognitive classification system
- No time-based relevance decay
- No memory snippet extraction

### 2.2 Problem Statement

The current memory system lacks:
1. **Intelligent Review Scheduling:** Memories are not scheduled for optimal review timing
2. **Time-Based Relevance:** Memory relevance does not decay over time
3. **Cognitive Classification:** Memories lack psychological categorization
4. **Context Optimization:** No snippet extraction for efficient context injection

### 2.3 Solution Overview

Implement FSRS-6 spaced repetition algorithm and relevance decay from edge-pwa to create an intelligent memory system that:
- Schedules memory reviews at optimal intervals for long-term retention
- Decays memory relevance over time to prioritize fresh information
- Classifies memories using cognitive science types
- Extracts memory snippets for efficient context assembly

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Memory Classification System

**FR-1.1:** Implement MemoryType enum with 10 cognitive science categories:
- Episodic (personal experiences/events)
- Semantic (general knowledge/facts)
- Procedural (how-to knowledge)
- Factual (verifiable facts)
- Preference (user preferences)
- Identity (self-concept)
- Relationship (social connections)
- Goal (objectives/targets)
- Project (work projects)
- Custom (user-defined types)

**FR-1.2:** Add default category mapping for each memory type:
```typescript
const DEFAULT_CATEGORY_MAP: Record<MemoryType, string> = {
  Episodic: "conversation_summary",
  Semantic: "knowledge",
  Procedural: "howto",
  Factual: "biography",
  Preference: "like",
  Identity: "role",
  Relationship: "person_info",
  Goal: "goal",
  Project: "project",
  Custom: "custom",
}
```

**FR-1.3:** Extend memory creation to accept memoryType parameter
**FR-1.4:** Add memoryType to existing memory records (backfill with "Semantic" as default)

#### FR-2: FSRS-6 Spaced Repetition Algorithm

**FR-2.1:** Implement FSRS-6 state machine with 4 states:
- New (never reviewed)
- Learning (initial learning phase)
- Review (regular review phase)
- Relearning (relearning after failure)

**FR-2.2:** Implement rating scale (1-4):
- 1 = Again (failed, need to relearn)
- 2 = Hard (difficult, but remembered)
- 3 = Good (remembered with some effort)
- 4 = Easy (remembered easily)

**FR-2.3:** Implement retrievability calculation:
```
R = 0.9^(elapsed_days / stability)
```
Where:
- R = retrievability (0-1)
- elapsed_days = days since last review
- stability = days to 90% retention

**FR-2.4:** Implement initial stability calculation:
```
S_initial = base_rating × (1 + importance)
```
Where base_rating values:
- Rating 4 (Easy): 4.0
- Rating 3 (Good): 2.0
- Rating 2 (Hard): 1.0
- Rating 1 (Again): 0.5

Importance (0-1) adds up to 2× boost to initial stability.

**FR-2.5:** Implement initial difficulty calculation:
```
D_initial = rating_difficulty
```
Where rating_difficulty values:
- Rating 4 (Easy): 0.1
- Rating 3 (Good): 0.3
- Rating 2 (Hard): 0.6
- Rating 1 (Again): 0.9

Clamped to [0.0, 1.0].

**FR-2.6:** Implement next difficulty calculation:
```
D_next = clamp(D_current + delta, 0.05, 0.95)
```
Where delta values:
- Rating 4 (Easy): -0.08
- Rating 3 (Good): 0.0
- Rating 2 (Hard): +0.08
- Rating 1 (Again): +0.2

**FR-2.7:** Implement next stability calculation:
```
S_next = S_current × exp(0.9 × (1 - D_current) × R × rating_factor)
```
Where rating_factor values:
- Rating 4 (Easy): 1.3
- Rating 3 (Good): 1.0
- Rating 2 (Hard): 0.8
- Rating 1 (Again): 0.2

Minimum stability: 0.5 days.

**FR-2.8:** Implement next interval calculation:
```
I_next = max(S_next × 9.49 × rating_scale, 1.0)
```
Where:
- 9.49 = -ln(0.9) / ln(2) (conversion factor for 90% retention target)
- rating_scale values:
  - Rating 4 (Easy): 1.3
  - Rating 3 (Good): 1.0
  - Rating 2 (Hard): 0.8
  - Rating 1 (Again): 1.0

**FR-2.9:** Implement state transitions:
- New/Learning → Review if rating ≥ 3
- New/Learning → Learning if rating < 3
- Review → Relearning if rating = 1
- Review → Review if rating ≥ 2
- Relearning → Review if rating ≥ 3
- Relearning → Relearning if rating < 3

**FR-2.10:** Implement learning step intervals:
- Rating 4 (Easy): 4.0 days
- Rating 3 (Good): 1.0 days
- Rating 2 (Hard): 0.5 days
- Rating 1 (Again): 0.25 days

**FR-2.11:** Implement relearning penalty:
```
S_relearning = max(S_current × 0.5, 0.5)
I_relearning = 0.1 days (if rating < 3) or S_relearning × 0.5 (if rating ≥ 3)
```

**FR-2.12:** Implement due date calculation:
```
due_date = current_time + (interval_days × 86400 seconds)
```

**FR-2.13:** Implement memory review collection:
- Query memories where due_date ≤ now
- Sort by due_date ascending
- Limit to configurable batch size (default: 50)

#### FR-3: Relevance Decay Algorithm

**FR-3.1:** Implement relevance decay with 30-day half-life:
```
relevance = base_relevance + access_boost
relevance = relevance × (0.5 + 0.5 × decay_factor)
```

Where:
- access_boost = min(0.2, access_count × 0.02)
- decay_factor = 0.5^(days_since_access / 30)

**FR-3.2:** Implement pinned memory exception:
```
if is_pinned:
    relevance = 1.0 (no decay)
```

**FR-3.3:** Implement time calculation:
```
days_since_access = (current_timestamp - last_accessed_timestamp) / (1000 × 60 × 60 × 24)
```

**FR-3.4:** Clamp final relevance to [0.0, 1.0]

**FR-3.5:** Apply relevance decay to all memory search results
**FR-3.6:** Update relevance on memory access (increment access_count, update last_accessed_at)

#### FR-4: Memory Snippet Extraction

**FR-4.1:** Implement memory snippet extraction for context retrieval:
```
snippet = memory.summary OR memory.content (if summary is null)
```

**FR-4.2:** Implement token estimation for snippets:
```
tokens = ceil(snippet.length / 4)  # ~4 chars per token
```

**FR-4.3:** Implement token-bounded memory retrieval:
- Sort memories by relevance descending
- Add memories to context until token budget exhausted
- Return MemoryRetrievalResult with snippets and token counts

**FR-4.4:** Implement minimum importance filter:
- Only include memories with importance ≥ min_importance (default: 0.5)

### 3.2 Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** FSRS-6 calculation latency < 1ms per memory
**NFR-1.2:** Relevance decay calculation < 0.1ms per memory
**NFR-1.3:** Memory snippet extraction < 0.5ms per memory
**NFR-1.4:** Due memory collection < 100ms for 1000 memories

#### NFR-2: Accuracy

**NFR-2.1:** FSRS-6 algorithm must match reference implementation
**NFR-2.2:** Relevance decay must produce deterministic results
**NFR-2.3:** Token estimation must be within ±10% of actual token count

#### NFR-3: Reliability

**NFR-3.1:** FSRS-6 calculations must not fail on edge cases (stability ≤ 0, etc.)
**NFR-3.2:** Relevance decay must handle missing last_accessed_at gracefully
**NFR-3.3:** Memory review collection must handle large datasets efficiently

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible with existing memory records
**NFR-4.2:** New fields must have sensible defaults for existing data
**NFR-4.3:** API changes must be additive (no breaking changes)

---

## 4. Technical Design

### 4.1 Data Model Changes

#### 4.1.1 MemoryType Enum

```typescript
// src/engines/memory-engine.ts

export enum MemoryType {
  Episodic = 'EPISODIC',      // Personal experiences/events
  Semantic = 'SEMANTIC',      // General knowledge/facts
  Procedural = 'PROCEDURAL',  // How-to knowledge
  Factual = 'FACTUAL',        // Verifiable facts
  Preference = 'PREFERENCE',  // User preferences
  Identity = 'IDENTITY',      // Self-concept
  Relationship = 'RELATIONSHIP', // Social connections
  Goal = 'GOAL',              // Objectives/targets
  Project = 'PROJECT',        // Work projects
  Custom = 'CUSTOM',          // User-defined types
}

export const DEFAULT_CATEGORY_MAP: Record<MemoryType, string> = {
  [MemoryType.Episodic]: 'conversation_summary',
  [MemoryType.Semantic]: 'knowledge',
  [MemoryType.Procedural]: 'howto',
  [MemoryType.Factual]: 'biography',
  [MemoryType.Preference]: 'like',
  [MemoryType.Identity]: 'role',
  [MemoryType.Relationship]: 'person_info',
  [MemoryType.Goal]: 'goal',
  [MemoryType.Project]: 'project',
  [MemoryType.Custom]: 'custom',
};
```

#### 4.1.2 FSRS-6 State Enum

```typescript
export enum FsrsState {
  New = 'New',
  Learning = 'Learning',
  Review = 'Review',
  Relearning = 'Relearning',
}
```

#### 4.1.3 Extended Memory Interface

```typescript
export interface EnhancedMemory {
  // ... existing fields ...
  
  // New fields
  memoryType: MemoryType;
  consolidationStatus: ConsolidationStatus;
  accessCount: number;
  lastAccessedAt?: number;
  
  // FSRS-6 fields (already exist in recordMemory, need to use them)
  stability: number;
  difficulty: number;
  dueDate: number;
  lastReview?: number;
  reviewCount: number;
  fsrsState: FsrsState;
}

export enum ConsolidationStatus {
  Unconsolidated = 'unconsolidated',
  Consolidating = 'consolidating',
  Consolidated = 'consolidated',
  Deprecated = 'deprecated',
}
```

### 4.2 Algorithm Implementation

#### 4.2.1 FSRS-6 Core Algorithm

```typescript
// src/engines/memory-engine.ts

class FsrsScheduler {
  /**
   * Calculate retrievability (probability of recall)
   * R = 0.9^(elapsed_days / stability)
   */
  static retrievability(stability: number, elapsedDays: number): number {
    if (stability <= 0) return 0;
    return Math.pow(0.9, elapsedDays / stability);
  }

  /**
   * Calculate initial stability based on rating and importance
   * S = base_rating × (1 + importance)
   */
  static initialStability(rating: number, importance: number): number {
    const baseRating: number = {
      4: 4.0,  // Easy
      3: 2.0,  // Good
      2: 1.0,  // Hard
      1: 0.5,  // Again
    }[rating] ?? 0.5;
    return baseRating * (1 + importance);
  }

  /**
   * Calculate initial difficulty based on rating
   */
  static initialDifficulty(rating: number): number {
    const difficulty: number = {
      4: 0.1,  // Easy
      3: 0.3,  // Good
      2: 0.6,  // Hard
      1: 0.9,  // Again
    }[rating] ?? 0.9;
    return Math.max(0, Math.min(1, difficulty));
  }

  /**
   * Calculate next difficulty
   * D_next = clamp(D_current + delta, 0.05, 0.95)
   */
  static nextDifficulty(current: number, rating: number): number {
    const delta: number = {
      4: -0.08, // Easy (decrease difficulty)
      3: 0.0,   // Good (no change)
      2: 0.08,  // Hard (increase difficulty)
      1: 0.2,   // Again (large increase)
    }[rating] ?? 0.2;
    return Math.max(0.05, Math.min(0.95, current + delta));
  }

  /**
   * Calculate next stability
   * S_next = S_current × exp(0.9 × (1 - D_current) × R × rating_factor)
   */
  static nextStability(
    stability: number,
    difficulty: number,
    retrievability: number,
    rating: number
  ): number {
    const ratingFactor: number = {
      4: 1.3,  // Easy
      3: 1.0,  // Good
      2: 0.8,  // Hard
      1: 0.2,  // Again
    }[rating] ?? 1.0;
    
    const newStability = stability * Math.exp(
      0.9 * (1 - difficulty) * retrievability * ratingFactor
    );
    return Math.max(0.5, newStability);
  }

  /**
   * Calculate next interval
   * I_next = max(S_next × 9.49 × rating_scale, 1.0)
   * Where 9.49 = -ln(0.9) / ln(2)
   */
  static nextInterval(stability: number, rating: number): number {
    const CONVERSION_FACTOR = -Math.log(0.9) / Math.log(2); // ≈ 9.49
    const interval = stability * CONVERSION_FACTOR;
    
    const ratingScale: number = {
      4: 1.3,  // Easy
      3: 1.0,  // Good
      2: 0.8,  // Hard
      1: 1.0,  // Again
    }[rating] ?? 1.0;
    
    return Math.max(1.0, interval * ratingScale);
  }

  /**
   * Apply review rating to memory and return updated memory
   */
  static applyReview(
    memory: EnhancedMemory,
    rating: number,
    now: number = Date.now()
  ): EnhancedMemory {
    const updated = { ...memory };
    updated.reviewCount += 1;
    updated.lastReview = now;
    updated.updatedAt = now;

    // Calculate elapsed days since last review
    const elapsedDays = memory.lastReview
      ? (now - memory.lastReview) / (1000 * 60 * 60 * 24)
      : 0;

    let newStability: number;
    let newDifficulty: number;
    let newState: FsrsState;
    let intervalDays: number;

    switch (memory.fsrsState) {
      case FsrsState.New:
      case FsrsState.Learning:
        newStability = this.initialStability(rating, memory.importance);
        newDifficulty = this.initialDifficulty(rating);
        newState = rating >= 3 ? FsrsState.Review : FsrsState.Learning;
        intervalDays = {
          4: 4.0,  // Easy
          3: 1.0,  // Good
          2: 0.5,  // Hard
          1: 0.25, // Again
        }[rating] ?? 0.25;
        break;

      case FsrsState.Review:
        const retrievability = this.retrievability(memory.stability, elapsedDays);
        newDifficulty = this.nextDifficulty(memory.difficulty, rating);
        newStability = this.nextStability(
          memory.stability,
          newDifficulty,
          retrievability,
          rating
        );
        newState = rating === 1 ? FsrsState.Relearning : FsrsState.Review;
        intervalDays = this.nextInterval(newStability, rating);
        break;

      case FsrsState.Relearning:
        newStability = Math.max(memory.stability * 0.5, 0.5);
        newDifficulty = this.nextDifficulty(memory.difficulty, rating);
        newState = rating >= 3 ? FsrsState.Review : FsrsState.Relearning;
        intervalDays = rating >= 3 ? newStability * 0.5 : 0.1;
        break;
    }

    updated.stability = newStability;
    updated.difficulty = newDifficulty;
    updated.fsrsState = newState;
    updated.dueDate = now + (intervalDays * 86400 * 1000);

    return updated;
  }
}
```

#### 4.2.2 Relevance Decay Algorithm

```typescript
// src/engines/memory-engine.ts

class RelevanceCalculator {
  /**
   * Calculate relevance with time decay (30-day half-life)
   * relevance = base_relevance + access_boost
   * relevance = relevance × (0.5 + 0.5 × decay_factor)
   */
  static calculateRelevance(
    baseRelevance: number,
    accessCount: number,
    lastAccessedAt: number | null,
    isPinned: boolean
  ): number {
    if (isPinned) return 1.0;

    let relevance = baseRelevance;

    // Boost for frequent access (max 0.2)
    const accessBoost = Math.min(0.2, accessCount * 0.02);
    relevance += accessBoost;

    // Decay for non-access over time (half-life of 30 days)
    if (lastAccessedAt) {
      const now = Date.now();
      const daysSinceAccess = (now - lastAccessedAt) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.pow(0.5, daysSinceAccess / 30);
      relevance *= 0.5 + 0.5 * decayFactor;
    }

    return Math.max(0, Math.min(1, relevance));
  }

  /**
   * Update memory access tracking
   */
  static recordAccess(memory: EnhancedMemory): EnhancedMemory {
    return {
      ...memory,
      accessCount: memory.accessCount + 1,
      lastAccessedAt: Date.now(),
    };
  }
}
```

#### 4.2.3 Memory Snippet Extraction

```typescript
// src/engines/memory-engine.ts

class MemorySnippetExtractor {
  /**
   * Extract snippet from memory
   */
  static extractSnippet(memory: EnhancedMemory): string {
    return memory.summary || memory.content;
  }

  /**
   * Estimate token count for snippet (~4 chars per token)
   */
  static estimateTokens(snippet: string): number {
    return Math.ceil(snippet.length / 4);
  }

  /**
   * Retrieve memories for context injection (token-bounded)
   */
  static retrieveForContext(
    memories: EnhancedMemory[],
    maxTokens: number,
    minImportance: number
  ): {
    snippets: Array<{ memory: EnhancedMemory; snippet: string; tokens: number }>;
    totalTokens: number;
  } {
    // Filter by importance
    const filtered = memories.filter(m => m.importance >= minImportance);
    
    // Sort by relevance descending
    const sorted = filtered.sort((a, b) => b.relevance - a.relevance);
    
    // Add memories until token budget exhausted
    const snippets: Array<{ memory: EnhancedMemory; snippet: string; tokens: number }> = [];
    let totalTokens = 0;
    
    for (const memory of sorted) {
      const snippet = this.extractSnippet(memory);
      const tokens = this.estimateTokens(snippet);
      
      if (totalTokens + tokens > maxTokens) {
        break;
      }
      
      snippets.push({ memory, snippet, tokens });
      totalTokens += tokens;
    }
    
    return { snippets, totalTokens };
  }
}
```

### 4.3 API Design

#### 4.3.1 Enhanced Memory Engine Interface

```typescript
// src/engines/memory-engine.ts

export class MemoryEngine {
  // ... existing methods ...

  /**
   * Apply FSRS-6 review rating to a memory
   */
  async applyReview(
    memoryId: string,
    rating: number, // 1-4
    accountId: string
  ): Promise<EnhancedMemory> {
    const memory = await this.getMemory(memoryId, accountId);
    const updated = FsrsScheduler.applyReview(memory, rating);
    await this.updateMemory(memoryId, updated);
    return updated;
  }

  /**
   * Collect memories due for review
   */
  async collectDueMemories(
    accountId: string,
    limit: number = 50
  ): Promise<EnhancedMemory[]> {
    const now = Date.now();
    const allMemories = await this.getAllMemories(accountId);
    
    const due = allMemories
      .filter(m => m.is_active && !m.is_archived && m.dueDate <= now)
      .sort((a, b) => a.dueDate - b.dueDate)
      .slice(0, limit);
    
    return due;
  }

  /**
   * Calculate and update relevance for memories
   */
  async updateRelevance(accountId: string): Promise<void> {
    const memories = await this.getAllMemories(accountId);
    
    for (const memory of memories) {
      const relevance = RelevanceCalculator.calculateRelevance(
        memory.importance,
        memory.accessCount,
        memory.lastAccessedAt,
        memory.is_pinned
      );
      await this.updateMemory(memory.id, { ...memory, relevance });
    }
  }

  /**
   * Retrieve memories for context injection
   */
  async retrieveForContext(
    accountId: string,
    maxTokens: number,
    minImportance: number = 0.5
  ): Promise<{
    snippets: Array<{ memory: EnhancedMemory; snippet: string; tokens: number }>;
    totalTokens: number;
  }> {
    const memories = await this.getAllMemories(accountId);
    return MemorySnippetExtractor.retrieveForContext(memories, maxTokens, minImportance);
  }

  /**
   * Record memory access (for relevance decay)
   */
  async recordAccess(memoryId: string, accountId: string): Promise<void> {
    const memory = await this.getMemory(memoryId, accountId);
    const updated = RelevanceCalculator.recordAccess(memory);
    await this.updateMemory(memoryId, updated);
  }
}
```

### 4.4 Integration Points

#### 4.4.1 Context Assembly Integration

```typescript
// src/engines/context-assembly.ts

export class ContextAssemblyEngine {
  private async recallIdentityLayer(conversationId: string): Promise<ContextLayer> {
    // Use memory snippet extraction for identity layer
    const { snippets, totalTokens } = await this.memory.retrieveForContext(
      accountId,
      1000, // token budget for identity
      0.7   // min importance
    );
    
    const content = snippets
      .map(s => `[${s.memory.memoryType}] ${s.snippet}`)
      .join('\n');
    
    return {
      name: 'identity',
      content,
      tokenCount: totalTokens,
      priority: 0.3,
      sources: snippets.map(s => s.memory.id),
    };
  }
}
```

#### 4.4.2 Scheduled Job Integration

```typescript
// src/engines/memory-scheduler.ts

export class MemoryScheduler {
  /**
   * Run daily job to:
   * 1. Collect due memories
   * 2. Update relevance decay
   * 3. Schedule review notifications
   */
  async runDailyJob(): Promise<void> {
    // Update relevance for all memories
    for (const account of await this.getAllAccounts()) {
      await this.memoryEngine.updateRelevance(account.id);
    }
    
    // Collect due memories and schedule reviews
    for (const account of await this.getAllAccounts()) {
      const dueMemories = await this.memoryEngine.collectDueMemories(account.id);
      await this.scheduleReviews(account.id, dueMemories);
    }
  }
}
```

---

## 5. Implementation Plan

### 5.1 Phase 1: Foundation (Days 1-3)

**Tasks:**
1. Add MemoryType enum to memory-engine.ts
2. Add FsrsState enum to memory-engine.ts
3. Add ConsolidationStatus enum to memory-engine.ts
4. Add DEFAULT_CATEGORY_MAP constant
5. Implement FsrsScheduler class with core methods
6. Implement RelevanceCalculator class
7. Implement MemorySnippetExtractor class

**Deliverables:**
- Core type definitions
- Algorithm implementations
- Unit tests for algorithms

**Success Criteria:**
- All algorithms produce correct results for test cases
- Unit tests pass with 100% coverage

### 5.2 Phase 2: Integration (Days 4-7)

**Tasks:**
1. Extend MemoryEngine with new methods (applyReview, collectDueMemories, etc.)
2. Integrate FSRS-6 into existing recordMemory method
3. Integrate relevance decay into search results
4. Add memory snippet extraction to context retrieval
5. Update memory creation to accept memoryType parameter

**Deliverables:**
- Enhanced MemoryEngine class
- Integration tests
- API documentation

**Success Criteria:**
- MemoryEngine methods work correctly
- Integration tests pass
- No regression in existing functionality

### 5.3 Phase 3: Data Migration (Days 8-10)

**Tasks:**
1. Add new fields to Prisma schema (memoryType, consolidationStatus, etc.)
2. Run schema migration
3. Backfill existing memories with default values
4. Validate data integrity
5. Rollback plan testing

**Deliverables:**
- Schema migration script
- Data backfill script
- Migration validation report

**Success Criteria:**
- Migration completes without errors
- Data integrity validated
- Rollback plan tested and working

### 5.4 Phase 4: Testing & Optimization (Days 11-14)

**Tasks:**
1. Performance testing (FSRS-6, relevance decay, snippet extraction)
2. Accuracy testing (FSRS-6 against reference)
3. Load testing (due memory collection)
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

#### FSRS-6 Algorithm Tests

```typescript
describe('FsrsScheduler', () => {
  test('retrievability calculation', () => {
    // R = 0.9^(elapsed / stability)
    expect(FsrsScheduler.retrievability(10, 10)).toBeCloseTo(0.9, 2);
    expect(FsrsScheduler.retrievability(10, 20)).toBeCloseTo(0.81, 2);
  });

  test('initial stability with importance boost', () => {
    // S = base × (1 + importance)
    expect(FsrsScheduler.initialStability(4, 0.5)).toBe(6.0); // 4 × 1.5
    expect(FsrsScheduler.initialStability(4, 1.0)).toBe(8.0); // 4 × 2.0
  });

  test('difficulty clamping', () => {
    expect(FsrsScheduler.initialDifficulty(1)).toBe(0.9);
    expect(FsrsScheduler.nextDifficulty(0.9, 4)).toBe(0.82); // 0.9 - 0.08
    expect(FsrsScheduler.nextDifficulty(0.05, 1)).toBe(0.25); // clamped to min 0.05
  });

  test('state transitions', () => {
    const memory = createTestMemory({ fsrsState: FsrsState.New });
    const updated = FsrsScheduler.applyReview(memory, 3);
    expect(updated.fsrsState).toBe(FsrsState.Review);
  });
});
```

#### Relevance Decay Tests

```typescript
describe('RelevanceCalculator', () => {
  test('pinned memories always have relevance 1.0', () => {
    const relevance = RelevanceCalculator.calculateRelevance(0.5, 0, null, true);
    expect(relevance).toBe(1.0);
  });

  test('access boost calculation', () => {
    // boost = min(0.2, count × 0.02)
    const relevance1 = RelevanceCalculator.calculateRelevance(0.5, 5, null, false);
    expect(relevance1).toBeCloseTo(0.6, 2); // 0.5 + 0.1
    
    const relevance2 = RelevanceCalculator.calculateRelevance(0.5, 20, null, false);
    expect(relevance2).toBeCloseTo(0.7, 2); // 0.5 + 0.2 (max)
  });

  test('30-day half-life decay', () => {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    const relevance = RelevanceCalculator.calculateRelevance(0.5, 0, thirtyDaysAgo, false);
    // After 30 days, decay_factor = 0.5, relevance = 0.5 × (0.5 + 0.5 × 0.5) = 0.375
    expect(relevance).toBeCloseTo(0.375, 2);
  });
});
```

### 6.2 Integration Tests

```typescript
describe('MemoryEngine Integration', () => {
  test('FSRS-6 review cycle', async () => {
    const memory = await memoryEngine.recordMemory({
      content: 'Test memory',
      memoryType: MemoryType.Semantic,
      importance: 0.7,
    });
    
    // First review (Good)
    const reviewed1 = await memoryEngine.applyReview(memory.id, 3, accountId);
    expect(reviewed1.fsrsState).toBe(FsrsState.Review);
    expect(reviewed1.stability).toBeGreaterThan(0);
    
    // Wait for due date
    await sleep(reviewed1.dueDate - Date.now());
    
    // Second review (Easy)
    const reviewed2 = await memoryEngine.applyReview(memory.id, 4, accountId);
    expect(reviewed2.stability).toBeGreaterThan(reviewed1.stability);
  });

  test('relevance decay over time', async () => {
    const memory = await memoryEngine.recordMemory({
      content: 'Test memory',
      memoryType: MemoryType.Semantic,
      importance: 0.8,
    });
    
    const initialRelevance = memory.relevance;
    
    // Wait 30 days
    await sleep(30 * 24 * 60 * 60 * 1000);
    
    await memoryEngine.updateRelevance(accountId);
    const updated = await memoryEngine.getMemory(memory.id, accountId);
    
    expect(updated.relevance).toBeLessThan(initialRelevance);
  });
});
```

### 6.3 Performance Tests

```typescript
describe('Performance Tests', () => {
  test('FSRS-6 calculation latency', () => {
    const memory = createTestMemory();
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      FsrsScheduler.applyReview(memory, 3);
    }
    
    const elapsed = performance.now() - start;
    expect(elapsed / 1000).toBeLessThan(1); // < 1ms per calculation
  });

  test('relevance decay latency', () => {
    const start = performance.now();
    
    for (let i = 0; i < 10000; i++) {
      RelevanceCalculator.calculateRelevance(0.5, i, Date.now(), false);
    }
    
    const elapsed = performance.now() - start;
    expect(elapsed / 10000).toBeLessThan(0.1); // < 0.1ms per calculation
  });
});
```

---

## 7. Rollout Plan

### 7.1 Feature Flags

```typescript
const FEATURES = {
  MEMORY_TYPE_CLASSIFICATION: process.env.FEATURE_MEMORY_TYPE === 'true',
  FSRS_6_SCHEDULING: process.env.FEATURE_FSRS_6 === 'true',
  RELEVANCE_DECAY: process.env.FEATURE_RELEVANCE_DECAY === 'true',
  MEMORY_SNIPPETS: process.env.FEATURE_MEMORY_SNIPPETS === 'true',
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
- FSRS-6 calculation latency
- Relevance decay calculation latency
- Memory review collection latency
- Memory snippet extraction latency
- Due memory count over time
- Relevance distribution over time

**Alerts:**
- Latency > 10ms for any calculation
- Due memory count > 1000
- Error rate > 1% for any operation

---

## 8. Success Metrics

### 8.1 Quantitative Metrics

- **FSRS-6 Adoption:** % of memories with scheduled reviews (target: 80%)
- **Relevance Decay Impact:** % improvement in memory relevance scoring (target: 30%)
- **Memory Snippet Usage:** % of context assemblies using snippets (target: 70%)
- **Review Completion Rate:** % of due memories reviewed on time (target: 60%)
- **Performance:** All calculations < 1ms latency (target: 100%)

### 8.2 Qualitative Metrics

- **Memory Quality:** User feedback on memory relevance
- **Review Experience:** User feedback on review scheduling
- **Context Quality:** User feedback on context assembly with snippets
- **System Performance:** No degradation in existing functionality

---

## 9. Risks and Mitigations

### 9.1 Technical Risks

**Risk 1:** FSRS-6 algorithm incorrectness
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:** Validate against reference implementation, unit tests with known inputs/outputs

**Risk 2:** Performance degradation
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:** Performance testing, optimization, caching

**Risk 3:** Data migration issues
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:** Pre-migration backups, rollback plan, validation

### 9.2 Integration Risks

**Risk 1:** Breaking existing APIs
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:** All changes additive, backward compatibility, regression testing

### 9.3 Operational Risks

**Risk 1:** Increased CPU usage
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:** Batching, background jobs, monitoring

---

## 10. Appendix

### 10.1 FSRS-6 Reference Implementation

The FSRS-6 algorithm is based on the Free Spaced Repetition Scheduler v6, which implements the following mathematical model:

**Retrievability:**
```
R(t) = exp(ln(0.9) × t / S)
```
Where t is elapsed time and S is stability.

**Stability Update:**
```
S' = S × exp(0.9 × (1 - D) × R × f)
```
Where D is difficulty, R is retrievability, and f is rating factor.

**Difficulty Update:**
```
D' = clamp(D + Δ, 0.05, 0.95)
```
Where Δ depends on rating.

### 10.2 Relevance Decay Reference

The relevance decay algorithm uses exponential decay with a 30-day half-life:

```
R(t) = R₀ × (0.5 + 0.5 × 0.5^(t / 30))
```

Where t is days since last access and R₀ is base relevance.

### 10.3 Token Estimation Reference

Token estimation uses the approximation of 4 characters per token for English text:

```
tokens = ceil(text.length / 4)
```

This approximation is within ±10% of actual token counts for typical English text.

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-13  
**Status:** Ready for Review  
