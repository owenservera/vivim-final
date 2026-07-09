# Unit 2.4: ExecutionMemoizer

**Phase:** 2 | **File:** `src/engines/execution-memoizer.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** TTL-based caching for expensive computations
**Source:** `05-merged-lifecycles.md` §Engine 13

## Purpose
Cross-cutting TTL-based caching layer for expensive engine computations. In-memory, no persistence. Used by:
- **ConversationManager** — capability resolution caching (TTL 5s)
- **StreamParserEngine** — parser module caching (by file hash)
- **ProviderHealthKernel** — health report caching (TTL 30s)
- **ProviderRegistrar** — provider detail caching (TTL 60s)

## Interface
```typescript
interface MemoizerConfig {
  defaultTtlMs: number;
  maxEntries: number;
  invalidationHooks: string[];
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

class ExecutionMemoizer {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private config: MemoizerConfig;

  constructor(
    private eventBus?: CapabilityEventBus,
    config?: Partial<MemoizerConfig>,
  ) {
    this.config = {
      defaultTtlMs: 5000,
      maxEntries: 500,
      invalidationHooks: ['config:changed', 'provider:seeded'],
      ...config,
    };
    this.subscribeToInvalidation();
  }

  async getOrCompute<T>(key: string, compute: () => Promise<T>, ttlMs?: number): Promise<T>;
  set<T>(key: string, value: T, ttlMs?: number): void;
  get<T>(key: string): T | undefined;
  invalidate(key: string): void;
  invalidateByPrefix(prefix: string): void;
  invalidateAll(): void;
  getStats(): { size: number; maxEntries: number; hitRate: number };
}
```

## Usage Patterns
```typescript
// ConversationManager — resolution cache
await memoizer.getOrCompute(
  `resolve:${providerId}:${planTier}`,
  () => resolution.resolve(providerId, planTier),
  5000  // TTL 5s
);

// StreamParserEngine — parser module cache
await memoizer.getOrCompute(
  `parser:${providerId}:${hash}`,
  () => import(parserPath),
  Infinity  // cached until invalidated
);

// ProviderHealthKernel — health report cache
await memoizer.getOrCompute(
  `health:${providerId}`,
  () => kernel.aggregate(providerId),
  30000  // TTL 30s
);
```

## Invalidation
- Auto-invalidates on subscribed events (`config:changed`, `provider:seeded`)
- LRU eviction when cache exceeds `maxEntries`
- TTL check on every `getOrCompute()` — expired entries auto-recomputed
- Prefix-based invalidation for bulk clears (e.g., `invalidateByPrefix('resolve:')`)

## Tests
- [ ] `getOrCompute()` returns cached value if within TTL
- [ ] `getOrCompute()` recomputes if TTL expired
- [ ] `invalidate(key)` removes specific entry
- [ ] `invalidateByPrefix('resolve:')` clears all resolution caches
- [ ] `invalidateAll()` clears all caches on `provider:seeded` event
- [ ] LRU eviction: oldest entry removed when cache exceeds maxEntries
- [ ] `getStats()` reports correct size, hitRate

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- Used by ConversationManager (step 1 RESOLVE), StreamParserEngine (parser loading), ProviderHealthKernel (health aggregation)
