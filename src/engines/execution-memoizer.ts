// src/engines/execution-memoizer.ts
// ExecutionMemoizer — cross-cutting TTL-based caching for expensive engine computations.
// In-memory, no persistence. Supports TTL, LRU eviction, event-driven invalidation.

// ── Event bus ──────────────────────────────────────────────────────────────

export interface MemoizerEventBus {
  emit(event: string, data: unknown): void
  on(event: string, handler: (data: unknown) => void): void
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface MemoizerConfig {
  defaultTtlMs: number
  maxEntries: number
  invalidationHooks: string[]
}

export interface CacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
}

export interface MemoizerStats {
  size: number
  maxEntries: number
  hits: number
  misses: number
  hitRate: number
}

// ── ExecutionMemoizer ──────────────────────────────────────────────────────

export class ExecutionMemoizer {
  private cache = new Map<string, CacheEntry<unknown>>()
  private accessOrder: string[] = []
  private config: MemoizerConfig
  private hits = 0
  private misses = 0

  constructor(
    private eventBus?: MemoizerEventBus,
    config?: Partial<MemoizerConfig>,
  ) {
    this.config = {
      defaultTtlMs: 5000,
      maxEntries: 500,
      invalidationHooks: ['config:changed', 'provider:seeded'],
      ...config,
    }
    this.subscribeToInvalidation()
  }

  // ── Core API ───────────────────────────────────────────────────────────

  async getOrCompute<T>(key: string, compute: () => Promise<T>, ttlMs?: number): Promise<T> {
    const entry = this.cache.get(key)
    const now = Date.now()

    if (entry && entry.expiresAt > now) {
      this.hits++
      this.touch(key)
      return entry.value as T
    }

    this.misses++
    const value = await compute()
    this.set(key, value, ttlMs)
    return value
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const now = Date.now()
    const ttl = ttlMs ?? this.config.defaultTtlMs

    this.cache.set(key, {
      value,
      expiresAt: ttl === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : now + ttl,
      createdAt: now,
    })
    this.touch(key)
    this.evict()
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return undefined
    }
    this.touch(key)
    return entry.value as T
  }

  // ── Invalidation ───────────────────────────────────────────────────────

  invalidate(key: string): void {
    this.cache.delete(key)
    this.removeFromAccessOrder(key)
  }

  invalidateByPrefix(prefix: string): void {
    const keys = [...this.cache.keys()].filter((k) => k.startsWith(prefix))
    for (const key of keys) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
    }
  }

  invalidateAll(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  getStats(): MemoizerStats {
    const total = this.hits + this.misses
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private touch(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  private removeFromAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key)
    if (idx !== -1) this.accessOrder.splice(idx, 1)
  }

  private evict(): void {
    while (this.cache.size > this.config.maxEntries) {
      const oldest = this.accessOrder.shift()
      if (oldest) this.cache.delete(oldest)
    }
  }

  private subscribeToInvalidation(): void {
    if (!this.eventBus) return
    for (const hook of this.config.invalidationHooks) {
      this.eventBus.on(hook, () => this.invalidateAll())
    }
  }
}
