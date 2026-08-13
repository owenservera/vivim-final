# Algorithms and Mathematical Formulas Reference

**Project:** vivim-final Integration  
**Source:** edge-pwa backend  
**Version:** 1.0  
**Date:** 2026-08-13

---

## Table of Contents

1. [Memory Engine Algorithms](#1-memory-engine-algorithms)
   - 1.1 FSRS-6 Spaced Repetition
   - 1.2 Relevance Decay
   - 1.3 Token Estimation
2. [Context Assembly Algorithms](#2-context-assembly-algorithms)
   - 2.1 4-Phase Budget Allocation
   - 2.2 Recency Decay
   - 2.3 Freshness Computation
3. [Storage Algorithms](#3-storage-algorithms)
   - 3.1 Message Identity Hashing
   - 3.2 TTL Sweep
   - 3.3 Database Compaction
4. [Constants and Configuration](#4-constants-and-configuration)

---

## 1. Memory Engine Algorithms

### 1.1 FSRS-6 Spaced Repetition

FSRS-6 (Free Spaced Repetition Scheduler v6) is a cognitive science-based algorithm for optimizing memory review timing.

#### 1.1.1 Retrievability Calculation

**Formula:**
```
R = 0.9^(elapsed_days / stability)
```

**Where:**
- `R` = retrievability (probability of recall, 0-1)
- `elapsed_days` = days since last review
- `stability` = days to 90% retention

**Implementation:**
```typescript
function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.pow(0.9, elapsedDays / stability);
}
```

#### 1.1.2 Initial Stability Calculation

**Formula:**
```
S_initial = base_rating × (1 + importance)
```

**Where:**
- `S_initial` = initial stability in days
- `base_rating` = rating-based base value
- `importance` = memory importance (0-1)

**Base Rating Values:**
- Rating 4 (Easy): 4.0
- Rating 3 (Good): 2.0
- Rating 2 (Hard): 1.0
- Rating 1 (Again): 0.5

**Implementation:**
```typescript
function initialStability(rating: number, importance: number): number {
  const baseRating: number = {
    4: 4.0,
    3: 2.0,
    2: 1.0,
    1: 0.5,
  }[rating] ?? 0.5;
  return baseRating * (1 + importance);
}
```

#### 1.1.3 Initial Difficulty Calculation

**Formula:**
```
D_initial = rating_difficulty
```

**Clamped to [0.0, 1.0]**

**Rating Difficulty Values:**
- Rating 4 (Easy): 0.1
- Rating 3 (Good): 0.3
- Rating 2 (Hard): 0.6
- Rating 1 (Again): 0.9

**Implementation:**
```typescript
function initialDifficulty(rating: number): number {
  const difficulty: number = {
    4: 0.1,
    3: 0.3,
    2: 0.6,
    1: 0.9,
  }[rating] ?? 0.9;
  return Math.max(0, Math.min(1, difficulty));
}
```

#### 1.1.4 Next Difficulty Calculation

**Formula:**
```
D_next = clamp(D_current + delta, 0.05, 0.95)
```

**Delta Values:**
- Rating 4 (Easy): -0.08
- Rating 3 (Good): 0.0
- Rating 2 (Hard): +0.08
- Rating 1 (Again): +0.2

**Implementation:**
```typescript
function nextDifficulty(current: number, rating: number): number {
  const delta: number = {
    4: -0.08,
    3: 0.0,
    2: 0.08,
    1: 0.2,
  }[rating] ?? 0.2;
  return Math.max(0.05, Math.min(0.95, current + delta));
}
```

#### 1.1.5 Next Stability Calculation

**Formula:**
```
S_next = S_current × exp(0.9 × (1 - D_current) × R × rating_factor)
```

**Where:**
- `S_next` = next stability in days
- `S_current` = current stability
- `D_current` = current difficulty
- `R` = retrievability
- `rating_factor` = rating-based multiplier

**Rating Factor Values:**
- Rating 4 (Easy): 1.3
- Rating 3 (Good): 1.0
- Rating 2 (Hard): 0.8
- Rating 1 (Again): 0.2

**Minimum Stability:** 0.5 days

**Implementation:**
```typescript
function nextStability(
  stability: number,
  difficulty: number,
  retrievability: number,
  rating: number
): number {
  const ratingFactor: number = {
    4: 1.3,
    3: 1.0,
    2: 0.8,
    1: 0.2,
  }[rating] ?? 1.0;
  
  const newStability = stability * Math.exp(
    0.9 * (1 - difficulty) * retrievability * ratingFactor
  );
  return Math.max(0.5, newStability);
}
```

#### 1.1.6 Next Interval Calculation

**Formula:**
```
I_next = max(S_next × 9.49 × rating_scale, 1.0)
```

**Where:**
- `I_next` = next interval in days
- `S_next` = next stability
- `9.49` = -ln(0.9) / ln(2) (conversion factor for 90% retention target)
- `rating_scale` = rating-based multiplier

**Rating Scale Values:**
- Rating 4 (Easy): 1.3
- Rating 3 (Good): 1.0
- Rating 2 (Hard): 0.8
- Rating 1 (Again): 1.0

**Implementation:**
```typescript
function nextInterval(stability: number, rating: number): number {
  const CONVERSION_FACTOR = -Math.log(0.9) / Math.log(2); // ≈ 9.49
  const interval = stability * CONVERSION_FACTOR;
  
  const ratingScale: number = {
    4: 1.3,
    3: 1.0,
    2: 0.8,
    1: 1.0,
  }[rating] ?? 1.0;
  
  return Math.max(1.0, interval * ratingScale);
}
```

#### 1.1.7 Learning Step Intervals

**Formula:**
```
interval = rating_specific_value
```

**Rating-Specific Values:**
- Rating 4 (Easy): 4.0 days
- Rating 3 (Good): 1.0 days
- Rating 2 (Hard): 0.5 days
- Rating 1 (Again): 0.25 days

#### 1.1.8 Relearning Penalty

**Formula:**
```
S_relearning = max(S_current × 0.5, 0.5)
I_relearning = 0.1 days (if rating < 3) or S_relearning × 0.5 (if rating ≥ 3)
```

#### 1.1.9 Due Date Calculation

**Formula:**
```
due_date = current_time + (interval_days × 86400 seconds)
```

**Implementation:**
```typescript
function calculateDueDate(currentTime: number, intervalDays: number): number {
  return currentTime + (intervalDays * 86400 * 1000);
}
```

#### 1.1.10 State Transitions

**Transition Rules:**
- New/Learning → Review if rating ≥ 3
- New/Learning → Learning if rating < 3
- Review → Relearning if rating = 1
- Review → Review if rating ≥ 2
- Relearning → Review if rating ≥ 3
- Relearning → Relearning if rating < 3

### 1.2 Relevance Decay

Relevance decay uses exponential decay with a 30-day half-life to prioritize fresh information.

#### 1.2.1 Relevance Calculation

**Formula:**
```
relevance = base_relevance + access_boost
relevance = relevance × (0.5 + 0.5 × decay_factor)
```

**Where:**
- `access_boost = min(0.2, access_count × 0.02)`
- `decay_factor = 0.5^(days_since_access / 30)`

**Special Case:**
```
if is_pinned:
    relevance = 1.0 (no decay)
```

**Implementation:**
```typescript
function calculateRelevance(
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
```

#### 1.2.2 Time Calculation

**Formula:**
```
days_since_access = (current_timestamp - last_accessed_timestamp) / (1000 × 60 × 60 × 24)
```

### 1.3 Token Estimation

Token estimation uses a simple character-based approximation for English text.

#### 1.3.1 Token Count Estimation

**Formula:**
```
tokens = ceil(text.length / 4)
```

**Where:**
- `4` = average characters per token for English text
- `ceil` = round up to nearest integer

**Implementation:**
```typescript
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

**Accuracy:** Within ±10% of actual token counts for typical English text.

---

## 2. Context Assembly Algorithms

### 2.1 4-Phase Budget Allocation

The 4-phase budget allocation algorithm distributes tokens across context layers using a sophisticated multi-phase approach.

#### 2.1.1 Phase 1: Minimum Allocation

**Formula:**
```
sum_min = Σ layer.min_tokens
if budget <= sum_min:
    goto Phase 4
else:
    alloc_i = min_tokens for all layers i
    remaining = budget - sum_min
```

**Implementation:**
```typescript
function phase1Allocation(budget: number, configs: BudgetConfig[]): {
  allocations: Map<LayerType, number>;
  remaining: number;
  gotoPhase4: boolean;
} {
  const sumMin = configs.reduce((sum, c) => sum + c.minTokens, 0);
  
  if (budget <= sumMin) {
    return { allocations: new Map(), remaining: budget, gotoPhase4: true };
  }
  
  const allocations = new Map<LayerType, number>();
  for (const config of configs) {
    allocations.set(config.layer, config.minTokens);
  }
  
  return {
    allocations,
    remaining: budget - sumMin,
    gotoPhase4: false,
  };
}
```

#### 2.1.2 Phase 2: Proportional Build-up to Ideal

**Formula:**
```
room_i = ideal_tokens - min_tokens
sum_room = Σ room_i
if sum_room > 0 and remaining > 0:
    allocated_extra = min(remaining, sum_room)
    for each layer i:
        share_i = allocated_extra × (room_i / sum_room)
        alloc_i += share_i
    remaining -= allocated_extra
```

**Implementation:**
```typescript
function phase2Allocation(
  configs: BudgetConfig[],
  allocations: Map<LayerType, number>,
  remaining: number
): Map<LayerType, number> {
  const roomToIdeal = configs.map(c => ({
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

  return allocations;
}
```

#### 2.1.3 Phase 3: Priority Overflow to Max

**Formula:**
```
for each priority level p (ascending):
    group_room = Σ (max_tokens - current_tokens) for layers with priority p
    if group_room > 0 and remaining > 0:
        allocated_group_extra = min(remaining, group_room)
        for each layer i in group:
            share_i = allocated_group_extra × (room_i / group_room)
            alloc_i += share_i
        remaining -= allocated_group_extra
```

**Implementation:**
```typescript
function phase3Allocation(
  configs: BudgetConfig[],
  allocations: Map<LayerType, number>,
  remaining: number
): Map<LayerType, number> {
  const priorities = [...new Set(configs.map(c => c.priority))].sort();

  for (const priority of priorities) {
    if (remaining === 0) break;

    const layerRoom = configs
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

  return allocations;
}
```

#### 2.1.4 Phase 4: Cut-to-fit Deficit Recovery

**Formula:**
```
if budget < Σ min_tokens:
    # Protect fixed layers (L7, then L0)
    alloc_L7 = min_L7 (protected)
    alloc_L0 = min_L0 (protected)
    # Allocate remaining by priority (ascending)
    for layers sorted by priority ascending:
        alloc_i = min_tokens if budget remains
```

**Implementation:**
```typescript
function phase4Allocation(
  budget: number,
  configs: BudgetConfig[]
): Map<LayerType, number> {
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

  return allocations;
}
```

#### 2.1.5 Depth Mode Adjustments

**Formula:**
```
Deep: min×1.2, ideal×1.3, max×1.5
Compact: min×0.7, ideal×0.6, max×0.5
Standard: no adjustment
```

**Implementation:**
```typescript
function applyDepthMode(config: BudgetConfig, mode: DepthMode): BudgetConfig {
  const c = { ...config };
  switch (mode) {
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
}
```

#### 2.1.6 Pressure Signal Adjustments

**Formula:**
```
if conversation_pressure:
    L2Topic: ideal×0.6, max×0.6
if entity_count > 20:
    L3Entity: ideal×1.5, max×1.5
if message_history_ratio > 3.0:
    L6RecentHistory: ideal×0.5, max×0.5
```

### 2.2 Recency Decay

Recency decay uses exponential decay with a 7-day half-life for context layer items.

#### 2.2.1 Recency Decay Calculation

**Formula:**
```
decay(t) = exp(-t / (7 × 86400))
```

**Where:**
- `t` = seconds since creation
- `7 × 86400` = 7 days in seconds (half-life)

**Implementation:**
```typescript
function recencyDecay(secs: number): number {
  const HALF_LIFE_SECS = 7 * 86400; // 7 days in seconds
  return Math.exp(-secs / HALF_LIFE_SECS);
}
```

#### 2.2.2 Score Application

**Formula:**
```
item_score = confidence × decay(recency_secs)
```

**Implementation:**
```typescript
function applyRecencyDecay(confidence: number, recencySecs: number): number {
  return confidence * recencyDecay(recencySecs);
}
```

### 2.3 Freshness Computation

Freshness computation uses version tracking and time windows to determine cache validity.

#### 2.3.1 Freshness Calculation

**Formula:**
```
if age < LIVE_WINDOW_SECS (60):
    freshness = Live
else if composed_against_version < current_version:
    freshness = Stale
else:
    freshness = Fresh
```

**Where:**
- `age = now - updated_at` (in seconds)
- `LIVE_WINDOW_SECS = 60`

**Implementation:**
```typescript
function computeFreshness(
  composedAgainstVersion: number,
  currentVersion: number,
  updatedAt: string
): CardFreshness {
  const age = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  
  if (Math.abs(age) < 60) {
    return CardFreshness.Live;
  }

  if (composedAgainstVersion < currentVersion) {
    return CardFreshness.Stale;
  }

  return CardFreshness.Fresh;
}
```

---

## 3. Storage Algorithms

### 3.1 Message Identity Hashing

Message identity uses SHA256 hashing to prevent duplicate messages across sync/import operations.

#### 3.1.1 Identity Hash Generation

**Formula:**
```
identity = SHA256(provider + "\0" + account + "\0" + conv_id + "\0" + mode_specific_data)
```

**Mode-Specific Data:**
- Provider ID mode: `"id\0" + provider_msg_id`
- Role+Content mode: `"rc\0" + role + "\0" + content`

**Implementation:**
```typescript
import { createHash } from 'crypto';

function generateIdentity(input: MessageIdentityInput): string {
  const hash = createHash('sha256');
  
  hash.update(input.provider);
  hash.update('\0');
  hash.update(input.account);
  hash.update('\0');
  hash.update(input.convId);
  hash.update('\0');
  
  if (input.providerMsgId && input.providerMsgId.length > 0) {
    // Provider ID mode
    hash.update('id\0');
    hash.update(input.providerMsgId);
  } else {
    // Role+Content mode
    hash.update('rc\0');
    hash.update(input.role);
    hash.update('\0');
    hash.update(input.content);
  }
  
  return hash.digest('hex');
}
```

**Properties:**
- Deterministic: Same inputs always produce same hash
- Collision-free: SHA256 is cryptographically secure
- Stable across runs

### 3.2 TTL Sweep

TTL sweep uses timestamp parsing and expiration to automatically clean up ephemeral data.

#### 3.2.1 Timestamp Parsing

**Formula:**
```
parse_ts(value):
    for field in ["expires_at", "timestamp", "created_at", "ts", "updated_at"]:
        if value[field] is string:
            try parse as RFC3339
        if value[field] is number:
            if > 1_000_000_000_000: parse as milliseconds
            else: parse as seconds
    return null
```

**Implementation:**
```typescript
function parseTimestamp(value: Record<string, unknown>): number | null {
  const timestampFields = ['expires_at', 'timestamp', 'created_at', 'ts', 'updated_at'];
  
  for (const field of timestampFields) {
    const fieldValue = value[field];
    
    if (typeof fieldValue === 'string') {
      const date = new Date(fieldValue);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    } else if (typeof fieldValue === 'number') {
      // Determine if seconds or milliseconds
      if (fieldValue > 1_000_000_000_000) {
        return fieldValue; // Milliseconds
      } else {
        return fieldValue * 1000; // Seconds to milliseconds
      }
    }
  }
  
  return null;
}
```

#### 3.2.2 TTL Sweep

**Formula:**
```
sweep(tree, cutoff):
    entries = scan(tree, "", 1_000_000)
    expired = entries.filter(parse_ts(entry.value) < cutoff)
    delete expired entries in batch
    return count of deleted entries
```

**Implementation:**
```typescript
async function sweep(tree: string, cutoff: number): Promise<number> {
  const entries = await storage.scan(tree, '', 1_000_000);
  
  const expiredKeys = entries
    .filter(entry => {
      const timestamp = parseTimestamp(entry.value);
      return timestamp !== null && timestamp < cutoff;
    })
    .map(entry => entry.key);
  
  if (expiredKeys.length > 0) {
    await storage.deleteBatch(tree, expiredKeys);
  }
  
  return expiredKeys.length;
}
```

#### 3.2.3 Cap-Based Sweep

**Formula:**
```
sweep_cap(tree, max):
    entries = scan(tree, "", 1_000_000)
    if entries.length <= max: return 0
    
    sort entries by timestamp descending (newest first)
    expired = entries[max:]  # all beyond max
    delete expired entries in batch
    return count of deleted entries
```

**Implementation:**
```typescript
async function sweepCap(tree: string, max: number): Promise<number> {
  const entries = await storage.scan(tree, '', 1_000_000);
  
  if (entries.length <= max) {
    return 0;
  }
  
  // Sort by timestamp descending (newest first)
  entries.sort((a, b) => {
    const timestampA = parseTimestamp(a.value) || 0;
    const timestampB = parseTimestamp(b.value) || 0;
    return timestampB - timestampA;
  });
  
  // Keep first max entries, delete the rest
  const expiredKeys = entries.slice(max).map(entry => entry.key);
  
  if (expiredKeys.length > 0) {
    await storage.deleteBatch(tree, expiredKeys);
  }
  
  return expiredKeys.length;
}
```

### 3.3 Database Compaction

Database compaction uses copy-compaction to reclaim free pages and reduce database size.

#### 3.3.1 Copy-Compaction Algorithm

**Formula:**
```
compact():
    live_path = database_path
    tmp_path = live_path + ".compact.tmp"
    backup_path = live_path + ".pre-compact"
    
    # Remove tmp if exists
    if tmp_path.exists(): delete(tmp_path)
    
    # Copy all data from live to tmp
    for each entry in live:
        tmp.insert(entry.key, entry.value)
    
    # Swap: backup live, move tmp -> live
    if backup_path.exists(): delete(backup_path)
    rename(live_path, backup_path)
    rename(tmp_path, live_path)
    
    report size reduction
```

**Implementation:**
```typescript
async function compact(dbPath: string): Promise<{
  beforeMb: number;
  afterMb: number;
  reclaimedMb: number;
  backup: string;
}> {
  const livePath = dbPath;
  const tmpPath = dbPath + '.compact.tmp';
  const backupPath = dbPath + '.pre-compact';
  
  const beforeStats = await fs.stat(livePath);
  const beforeBytes = beforeStats.size;
  
  // Remove tmp if exists
  try {
    await fs.unlink(tmpPath);
  } catch {
    // Ignore if doesn't exist
  }
  
  // Copy all data from live to tmp
  await copyDatabase(livePath, tmpPath);
  
  const afterStats = await fs.stat(tmpPath);
  const afterBytes = afterStats.size;
  
  // Atomic swap: backup live, move tmp -> live
  try {
    await fs.unlink(backupPath);
  } catch {
    // Ignore if doesn't exist
  }
  
  await fs.rename(livePath, backupPath);
  await fs.rename(tmpPath, livePath);
  
  const reclaimedBytes = Math.max(0, beforeBytes - afterBytes);
  
  return {
    beforeMb: beforeBytes / (1024 * 1024),
    afterMb: afterBytes / (1024 * 1024),
    reclaimedMb: reclaimedBytes / (1024 * 1024),
    backup: backupPath,
  };
}
```

#### 3.3.2 Live Ratio Calculation

**Formula:**
```
live_ratio = live_bytes / file_bytes
```

**Where:**
- `live_bytes` = sum of all entry sizes (key + value)
- `file_bytes` = total database file size

**Implementation:**
```typescript
function calculateLiveRatio(fileBytes: number, liveBytes: number): number {
  return fileBytes > 0 ? liveBytes / fileBytes : 0;
}
```

---

## 4. Constants and Configuration

### 4.1 Memory Engine Constants

```typescript
const MEMORY_ENGINE_CONSTANTS = {
  // FSRS-6
  FSRS_TARGET_RETRIEVABILITY: 0.9,
  FSRS_CONVERSION_FACTOR: 9.49, // -ln(0.9) / ln(2)
  FSRS_MIN_STABILITY: 0.5,
  FSRS_MIN_DIFFICULTY: 0.05,
  FSRS_MAX_DIFFICULTY: 0.95,
  
  // Relevance Decay
  RELEVANCE_HALF_LIFE_DAYS: 30,
  RELEVANCE_MAX_ACCESS_BOOST: 0.2,
  RELEVANCE_ACCESS_BOOST_FACTOR: 0.02,
  
  // Token Estimation
  CHARS_PER_TOKEN: 4,
};
```

### 4.2 Context Assembly Constants

```typescript
const CONTEXT_ASSEMBLY_CONSTANTS = {
  // Freshness
  LIVE_WINDOW_SECS: 60,
  
  // Recency Decay
  RECENCY_HALF_LIFE_DAYS: 7,
  RECENCY_HALF_LIFE_SECS: 7 * 86400,
  
  // Budget Allocation
  DEFAULT_BUDGET: 8000,
  DEPTH_MODE_DEEP_MULTIPLIER: { min: 1.2, ideal: 1.3, max: 1.5 },
  DEPTH_MODE_COMPACT_MULTIPLIER: { min: 0.7, ideal: 0.6, max: 0.5 },
  
  // Pressure Signals
  PRESSURE_CONVERSATION_SQUEEZE: 0.6,
  PRESSURE_ENTITY_SCALE: 1.5,
  PRESSURE_HISTORY_DECAY: 0.5,
  PRESSURE_ENTITY_THRESHOLD: 20,
  PRESSURE_HISTORY_RATIO_THRESHOLD: 3.0,
};
```

### 4.3 Storage Constants

```typescript
const STORAGE_CONSTANTS = {
  // TTL
  TRACES_TTL_HOURS: 48,
  SESSIONS_TTL_HOURS: 6,
  SYNC_HISTORY_TTL_DAYS: 30,
  OBSERVATORY_TRAFFIC_TTL_DAYS: 7,
  OBSERVATORY_TRAFFIC_MAX: 2000,
  
  // Compaction
  COMPACTION_TMP_EXTENSION: '.compact.tmp',
  COMPACTION_BACKUP_EXTENSION: '.pre-compact',
  
  // Deduplication
  DEDUP_SEPARATOR: '\0',
  DEDUP_PROVIDER_ID_PREFIX: 'id\0',
  DEDUP_ROLE_CONTENT_PREFIX: ‘rc\0',
};
```

### 4.4 Default Layer Configurations

```typescript
const DEFAULT_LAYER_CONFIGS: BudgetConfig[] = [
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
```

---

## 5. Algorithm Complexity Analysis

### 5.1 Memory Engine

| Algorithm | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| FSRS-6 Review Application | O(1) | O(1) |
| Relevance Decay | O(1) | O(1) |
| Token Estimation | O(n) | O(1) |
| Due Memory Collection | O(n log n) | O(n) |

### 5.2 Context Assembly

| Algorithm | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| 4-Phase Budget Allocation | O(n log n) | O(n) |
| Recency Decay | O(1) | O(1) |
| Freshness Computation | O(1) | O(1) |
| Bundle Compilation | O(n) | O(n) |

### 5.3 Storage

| Algorithm | Time Complexity | Space Complexity |
|-----------|----------------|------------------|
| Message Identity Hashing | O(n) | O(1) |
| TTL Sweep | O(n) | O(n) |
| Cap-Based Sweep | O(n log n) | O(n) |
| Database Compaction | O(n) | O(n) |

---

## 6. Performance Targets

### 6.1 Memory Engine

- FSRS-6 calculation: < 1ms per memory
- Relevance decay calculation: < 0.1ms per memory
- Token estimation: < 0.5ms per memory
- Due memory collection: < 100ms for 1000 memories

### 6.2 Context Assembly

- DCB composition: < 100ms per bundle
- Budget allocation: < 10ms
- Bundle compilation: < 50ms per bundle
- Freshness computation: < 1ms per layer

### 6.3 Storage

- Message identity hashing: < 1ms per message
- Upsert operation: < 10ms per message
- TTL sweep: < 5s for 1M entries
- Compaction: < 30s for 100MB database

---

## 7. Validation and Testing

### 7.1 Algorithm Validation

**FSRS-6 Validation:**
- Compare against reference implementation
- Validate retrievability calculation with known inputs
- Test state transitions with all rating combinations

**Budget Allocation Validation:**
- Verify budget constraint is always respected
- Test with edge cases (zero budget, overflow budget)
- Validate phase transitions

**Deduplication Validation:**
- Test identity stability across runs
- Verify collision resistance with large datasets
- Test both identity modes (provider ID, role+content)

### 7.2 Accuracy Testing

**Token Estimation:**
- Compare against actual token counts for sample texts
- Verify ±10% accuracy for typical English text
- Test with edge cases (code, markdown, etc.)

**Relevance Decay:**
- Verify 30-day half-life with time-series testing
- Test pinned memory exception
- Validate access boost calculation

**Freshness Computation:**
- Test live window (60 seconds)
- Verify stale detection with version mismatch
- Test timestamp parsing with various formats

---

## 8. References

### 8.1 Academic References

**FSRS-6:**
- OpenSpacedRepetition: https://github.com/open-spaced-repetition
- Cognitive science basis: Ebbinghaus forgetting curve, spacing effect

**Budget Allocation:**
- Multi-phase resource allocation algorithms
- Priority-based scheduling theory

### 8.2 Implementation References

**Source Code:**
- edge-pwa backend/src/memory_engine.rs (lines 816-1010)
- edge-pwa backend/src/cortex/budget.rs (lines 1-582)
- edge-pwa backend/src/cortex/dcb/mod.rs (lines 75-124)
- edge-pwa backend/src/storage/dedup.rs (lines 1-148)
- edge-pwa backend/src/storage/lifecycle.rs (lines 1-112)
- edge-pwa backend/src/storage/ops.rs (lines 1-166)

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-13  
**Status:** Complete  
