# PRD: FSRS-6 Review Scheduler (M8)

**Product:** vivim-final Memory Engine  
**Source:** intelligence-pack-acu-dcb-storage  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13  
**Phase:** 5 (FSRS-6 Scheduler)

---

## Executive Summary

This PRD details the implementation of FSRS-6 spaced repetition review scheduling for vivim-final. This enhancement completes the FSRS-6 algorithm implementation that was partially started in `recordMemory()`, adding the review scheduling logic and due memory collection.

**Key Deliverables:**
- FSRS-6 review scheduling algorithm implementation
- Due memory collection system
- Review interval computation
- Memory review API
- Integration with existing memory engine

**Estimated Effort:** 1 week  
**Risk Level:** Medium (completes existing partial implementation, algorithm-heavy)

---

## Background

### Current State

vivim-final memory engine has:
- `recordMemory()` method with FSRS-6 fields (`stability`, `difficulty`, `dueDate`, `fsrsState`)
- Consolidation logic with dedupe, decay, promote, prune (lines 478–514)
- Initial FSRS-6 state but no review scheduling algorithm
- No due-date review pass
- No next-interval computation at retrieval time
- FSRS-6 fields exist but are not used for scheduling

### Problem Statement

The current memory system lacks:
1. **Review Scheduling:** No algorithm to compute next review intervals
2. **Due Memory Collection:** No system to collect memories due for review
3. **FSRS-6 Algorithm:** No implementation of the full FSRS-6 state machine
4. **Review APIs:** No APIs to trigger memory reviews

### Solution Overview

Implement FSRS-6 spaced repetition algorithm to create an intelligent memory review system that:
- Schedules memory reviews at optimal intervals for long-term retention
- Collects memories due for review
- Computes next intervals based on performance ratings
- Provides APIs for memory review operations

---

## Requirements

### Functional Requirements

#### FR-1: FSRS-6 Algorithm Implementation

**FR-1.1:** Implement FSRS-6 state machine with 4 states:
- New (never reviewed)
- Learning (initial learning phase)
- Review (regular review phase)
- Relearning (relearning after failure)

**FR-1.2:** Implement rating scale (1-4):
- 1 = Again (failed, need to relearn)
- 2 = Hard (difficult, but remembered)
- 3 = Good (remembered with some effort)
- 4 = Easy (remembered easily)

**FR-1.3:** Implement retrievability calculation:
```
R = 0.9^(elapsed_days / stability)
```
Where:
- R = retrievability (0-1)
- elapsed_days = days since last review
- stability = days to 90% retention

**FR-1.4:** Implement initial stability calculation:
```
S_initial = base_rating × (1 + importance)
```
Where base_rating values:
- Rating 4 (Easy): 4.0
- Rating 3 (Good): 2.0
- Rating 2 (Hard): 1.0
- Rating 1 (Again): 0.5

Importance (0-1) adds up to 2× boost to initial stability.

**FR-1.5:** Implement initial difficulty calculation:
```
D_initial = rating_difficulty
```
Where rating_difficulty values:
- Rating 4 (Easy): 0.1
- Rating 3 (Good): 0.3
- Rating 2 (Hard): 0.6
- Rating 1 (Again): 0.9

Clamped to [0.0, 1.0].

**FR-1.6:** Implement next difficulty calculation:
```
D_next = clamp(D_current + delta, 0.05, 0.95)
```
Where delta values:
- Rating 4 (Easy): -0.08
- Rating 3 (Good): 0.0
- Rating 2 (Hard): +0.08
- Rating 1 (Again): +0.2

**FR-1.7:** Implement next stability calculation:
```
S_next = S_current × exp(0.9 × (1 - D_current) × R × rating_factor)
```
Where rating_factor values:
- Rating 4 (Easy): 1.3
- Rating 3 (Good): 1.0
- Rating 2 (Hard): 0.8
- Rating 1 (Again): 0.2

Minimum stability: 0.5 days.

**FR-1.8:** Implement next interval calculation:
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

**FR-1.9:** Implement state transitions:
- New/Learning → Review if rating ≥ 3
- New/Learning → Learning if rating < 3
- Review → Relearning if rating = 1
- Review → Review if rating ≥ 2
- Relearning → Review if rating ≥ 3
- Relearning → Relearning if rating < 3

**FR-1.10:** Implement learning step intervals:
- Rating 4 (Easy): 4.0 days
- Rating 3 (Good): 1.0 days
- Rating 2 (Hard): 0.5 days
- Rating 1 (Again): 0.25 days

**FR-1.11:** Implement relearning penalty:
```
S_relearning = max(S_current × 0.5, 0.5)
I_relearning = 0.1 days (if rating < 3) or S_relearning × 0.5 (if rating ≥ 3)
```

**FR-1.12:** Implement due date calculation:
```
due_date = current_time + (interval_days × 86400 seconds)
```

#### FR-2: Schema Additions

**FR-2.1:** Add FSRS-6 metadata to Node metadata (memory-related nodes):
```typescript
// Node.metadata JSON field
{
  // ... existing fields ...
  
  // FSRS-6 fields
  stability: number;
  difficulty: number;
  dueDate: number;
  lastReview?: number;
  reviewCount: number;
  fsrsState: 'New' | 'Learning' | 'Review' | 'Relearning';
}
```

**FR-2.2:** Note: FSRS-6 fields already exist in `recordMemory()` output, just need to use them

#### FR-3: Due Memory Collection

**FR-3.1:** Implement due memory collection:
```typescript
export class MemoryEngine {
  /**
   * Collect memories due for review
   */
  async collectDueMemories(
    accountId: string,
    limit: number = 50
  ): Promise<MemoryNode[]> {
    const now = Date.now();
    
    const allMemories = await this.getAllMemories(accountId);
    
    const due = allMemories
      .filter(m => {
        const metadata = JSON.parse(m.metadata || '{}');
        return metadata.isActive && !metadata.isArchived && metadata.dueDate <= now;
      })
      .sort((a, b) => {
        const metaA = JSON.parse(a.metadata || '{}');
        const metaB = JSON.parse(b.metadata || '{}');
        return metaA.dueDate - metaB.dueDate;
      })
      .slice(0, limit);
    
    return due;
  }
}
```

**FR-3.2:** Implement configurable batch size (default: 50)
**FR-3.3:** Sort by due date ascending

#### FR-4: Review Application

**FR-4.1:** Implement review application:
```typescript
export class MemoryEngine {
  /**
   * Apply FSRS-6 review rating to a memory
   */
  async applyReview(
    memoryId: string,
    rating: number, // 1-4
    accountId: string
  ): Promise<MemoryNode> {
    const memory = await this.getMemory(memoryId, accountId);
    const metadata = JSON.parse(memory.metadata || '{}');
    
    const updated = FsrsScheduler.applyReview(metadata, rating, Date.now());
    
    await this.updateMemory(memoryId, { metadata: JSON.stringify(updated) });
    
    return await this.getMemory(memoryId, accountId);
  }
}
```

**FR-4.2:** Update memory metadata with new FSRS-6 values
**FR-4.3:** Increment review count
**FR-4.4:** Update last review timestamp

#### FR-5: Review APIs

**FR-5.1:** Implement review APIs:
- `GET /api/memory/due` - Get memories due for review
- `POST /api/memory/:id/review` - Submit review rating
- `GET /api/memory/stats` - Get memory review statistics

**FR-5.2:** Implement API request/response:
```typescript
// GET /api/memory/due?limit=50
Response: {
  memories: MemoryNode[];
  totalDue: number;
  returned: number;
}

// POST /api/memory/:id/review
Request: {
  rating: number; // 1-4
}
Response: {
  memory: MemoryNode;
  nextDueDate: number;
  stability: number;
  difficulty: number;
}
```

### Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** FSRS-6 calculation latency < 1ms per memory
**NFR-1.2:** Due memory collection < 100ms for 1000 memories
**NFR-1.3:** Review application < 50ms per memory

#### NFR-2: Accuracy

**NFR-2.1:** FSRS-6 algorithm must match reference implementation
**NFR-2.2:** Due date calculation must be accurate
**NFR-2.3:** State transitions must follow FSRS-6 specification

#### NFR-3: Reliability

**NFR-3.1:** FSRS-6 calculations must not fail on edge cases
**NFR-3.2:** Due memory collection must handle large datasets
**NFR-3.3:** Review application must be atomic

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible
**NFR-4.2:** Existing memory operations must continue to work
**NFR-4.3:** API changes must be additive

---

## Technical Design

### Algorithm Implementation

#### FSRS-6 Scheduler

```typescript
// src/engines/fsrs-scheduler.ts

export enum FsrsState {
  New = 'New',
  Learning = 'Learning',
  Review = 'Review',
  Relearning = 'Relearning',
}

export interface FsrsMetadata {
  stability: number;
  difficulty: number;
  dueDate: number;
  lastReview?: number;
  reviewCount: number;
  fsrsState: FsrsState;
  importance: number;
}

export class FsrsScheduler {
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
   * Apply review rating to memory and return updated metadata
   */
  static applyReview(
    metadata: FsrsMetadata,
    rating: number,
    now: number = Date.now()
  ): FsrsMetadata {
    const updated = { ...metadata };
    updated.reviewCount += 1;
    updated.lastReview = now;
    
    // Calculate elapsed days since last review
    const elapsedDays = metadata.lastReview
      ? (now - metadata.lastReview) / (1000 * 60 * 60 * 24)
      : 0;
    
    let newStability: number;
    let newDifficulty: number;
    let newState: FsrsState;
    let intervalDays: number;
    
    switch (metadata.fsrsState) {
      case FsrsState.New:
      case FsrsState.Learning:
        newStability = this.initialStability(rating, metadata.importance);
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
        const retrievability = this.retrievability(metadata.stability, elapsedDays);
        newDifficulty = this.nextDifficulty(metadata.difficulty, rating);
        newStability = this.nextStability(
          metadata.stability,
          newDifficulty,
          retrievability,
          rating
        );
        newState = rating === 1 ? FsrsState.Relearning : FsrsState.Review;
        intervalDays = this.nextInterval(newStability, rating);
        break;
        
      case FsrsState.Relearning:
        newStability = Math.max(metadata.stability * 0.5, 0.5);
        newDifficulty = this.nextDifficulty(metadata.difficulty, rating);
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

#### Memory Engine Integration

```typescript
// src/engines/memory-engine.ts

import { FsrsScheduler, FsrsState } from './fsrs-scheduler.js';

export class MemoryEngine {
  // ... existing methods ...
  
  /**
   * Collect memories due for review
   */
  async collectDueMemories(
    accountId: string,
    limit: number = 50
  ): Promise<MemoryNode[]> {
    const now = Date.now();
    
    const allMemories = await this.getAllMemories(accountId);
    
    const due = allMemories
      .filter(m => {
        const metadata = JSON.parse(m.metadata || '{}');
        return metadata.isActive && !metadata.isArchived && metadata.dueDate <= now;
      })
      .sort((a, b) => {
        const metaA = JSON.parse(a.metadata || '{}');
        const metaB = JSON.parse(b.metadata || '{}');
        return metaA.dueDate - metaB.dueDate;
      })
      .slice(0, limit);
    
    return due;
  }
  
  /**
   * Apply FSRS-6 review rating to a memory
   */
  async applyReview(
    memoryId: string,
    rating: number, // 1-4
    accountId: string
  ): Promise<MemoryNode> {
    const memory = await this.getMemory(memoryId, accountId);
    const metadata = JSON.parse(memory.metadata || '{}');
    
    // Ensure FSRS-6 fields exist
    const fsrsMetadata: FsrsMetadata = {
      stability: metadata.stability ?? 1.0,
      difficulty: metadata.difficulty ?? 0.3,
      dueDate: metadata.dueDate ?? Date.now(),
      lastReview: metadata.lastReview,
      reviewCount: metadata.reviewCount ?? 0,
      fsrsState: (metadata.fsrsState as FsrsState) ?? FsrsState.New,
      importance: metadata.importance ?? 0.5,
    };
    
    const updated = FsrsScheduler.applyReview(fsrsMetadata, rating, Date.now());
    
    // Update memory metadata
    await this.updateMemory(memoryId, {
      ...memory,
      metadata: JSON.stringify({
        ...metadata,
        ...updated,
      }),
    });
    
    return await this.getMemory(memoryId, accountId);
  }
}
```

---

## Implementation Plan

### Phase 5.1: FSRS-6 Algorithm (Day 1-2)

**Tasks:**
1. Create `src/engines/fsrs-scheduler.ts`
2. Implement FSRS-6 state machine
3. Implement all FSRS-6 calculations
4. Add unit tests for algorithm

**Deliverables:**
- FSRS-6 scheduler module
- Unit tests passing

**Success Criteria:**
- FSRS-6 algorithm produces valid schedules
- State transitions work correctly
- Unit tests pass

### Phase 5.2: Memory Engine Integration (Day 3-4)

**Tasks:**
1. Extend `MemoryEngine` with `collectDueMemories()` method
2. Extend `MemoryEngine` with `applyReview()` method
3. Integrate FSRS-6 scheduler into memory engine
4. Add integration tests

**Deliverables:**
- Extended memory engine
- Integration tests passing

**Success Criteria:**
- Due memory collection works
- Review application works
- Integration tests pass

### Phase 5.3: API Implementation (Day 5)

**Tasks:**
1. Create memory review APIs in `memory-router.ts`
2. Implement `GET /api/memory/due` endpoint
3. Implement `POST /api/memory/:id/review` endpoint
4. Implement `GET /api/memory/stats` endpoint
5. Add API tests

**Deliverables:**
- Review APIs implemented
- API tests passing

**Success Criteria:**
- API endpoints work correctly
- API tests pass
- Error handling is robust

### Phase 5.4: Testing and Validation (Day 6-7)

**Tasks:**
1. Run full test suite
2. Test with real memory data
3. Performance testing (calculation latency, collection latency)
4. Regression testing
5. Validate against FSRS-6 reference

**Deliverables:**
- Test results
- Performance metrics
- Validation report

**Success Criteria:**
- All tests pass
- Performance targets met
- No regressions detected

---

## Risk Mitigation

### Technical Risks

**Risk 1: FSRS-6 Algorithm Incorrectness**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Validate against reference implementation
  - Unit tests with known inputs/outputs
  - Manual review of early schedules

**Risk 2: Performance Degradation**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Performance testing before rollout
  - Optimize due memory collection
  - Monitor performance

**Risk 3: Edge Case Handling**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:**
  - Handle missing FSRS-6 fields gracefully
  - Clamp values to valid ranges
  - Add comprehensive error handling

### Integration Risks

**Risk 1: Breaking Existing Memory Operations**
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - All changes are additive
  - Maintain backward compatibility
  - Comprehensive regression testing

**Risk 2: Metadata Schema Changes**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - FSRS-6 fields already exist in metadata
  - No schema changes required
  - Use default values for missing fields

---

## Success Metrics

### Quantitative Metrics

- **FSRS-6 Calculation Latency:** < 1ms per memory (target)
- **Due Memory Collection:** < 100ms for 1000 memories (target)
- **Review Application:** < 50ms per memory (target)
- **Review Accuracy:** Matches reference implementation (target)

### Qualitative Metrics

- **Memory Retention:** Improved long-term retention
- **Review Efficiency:** Optimal review scheduling
- **User Experience:** Smooth review process

---

## Rollout Plan

### Deployment Steps

1. Deploy to development environment
2. Run integration tests with synthetic data
3. Deploy to staging with production data backup
4. Monitor performance metrics for 1 week
5. Gradual rollout to production (10% → 50% → 100%)

### Rollback Plan

- All changes are additive (safe to rollback)
- Feature flag can disable FSRS-6 scheduling if needed
- Database backup before deployment

---

## References

- `AGENTS.md` - Project instructions and conventions
- `intelligence-pack-acu-dcb-storage/PRD_MEMORY_ENGINE_ENHANCEMENT.md` - Source memory PRD
- `src/engines/memory-engine.ts` - Existing memory engine
- FSRS-6 reference documentation
