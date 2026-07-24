// src/engines/selector-cache.ts
// Cache successful selector resolutions to skip discovery on repeat visits.
// Inspired by stagehand's action caching pattern for vivim-final.

interface CacheEntry {
  selector: string
  providerId: string
  capabilityId: string
  lastSuccess: number
  successCount: number
}

export interface SelectorCacheConfig {
  /** Max age in milliseconds before a cache entry expires */
  maxAgeMs: number
  /** Max entries to keep in cache */
  maxEntries: number
}

const DEFAULT_CONFIG: SelectorCacheConfig = {
  maxAgeMs: 30 * 60 * 1000, // 30 minutes
  maxEntries: 500,
}

/**
 * Cache successful selector resolutions. When a selector works for a
 * provider+capability pair, cache it so subsequent visits skip discovery.
 */
export class SelectorCache {
  private cache = new Map<string, CacheEntry>()
  private config: SelectorCacheConfig

  constructor(config?: Partial<SelectorCacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private key(providerId: string, capabilityId: string): string {
    return `${providerId}:${capabilityId}`
  }

  /**
   * Get a cached selector for a provider+capability pair.
   * Returns null if not cached or expired.
   */
  get(providerId: string, capabilityId: string): CacheEntry | null {
    const entry = this.cache.get(this.key(providerId, capabilityId))
    if (!entry) return null
    if (Date.now() - entry.lastSuccess > this.config.maxAgeMs) {
      this.cache.delete(this.key(providerId, capabilityId))
      return null
    }
    return entry
  }

  /**
   * Record a successful selector resolution.
   */
  record(providerId: string, capabilityId: string, selector: string): void {
    const k = this.key(providerId, capabilityId)
    const existing = this.cache.get(k)
    this.cache.set(k, {
      selector,
      providerId,
      capabilityId,
      lastSuccess: Date.now(),
      successCount: (existing?.successCount ?? 0) + 1,
    })

    // Evict oldest if over limit
    if (this.cache.size > this.config.maxEntries) {
      const oldest = [...this.cache.values()].sort((a, b) => a.lastSuccess - b.lastSuccess)[0]
      if (oldest) {
        this.cache.delete(this.key(oldest.providerId, oldest.capabilityId))
      }
    }
  }

  /**
   * Invalidate a cache entry (e.g. after selector fails).
   */
  invalidate(providerId: string, capabilityId: string): void {
    this.cache.delete(this.key(providerId, capabilityId))
  }

  /**
   * Get cache stats for diagnostics.
   */
  stats(): { size: number; entries: Array<{ key: string; successCount: number; age: number }> } {
    const now = Date.now()
    return {
      size: this.cache.size,
      entries: [...this.cache.values()].map((e) => ({
        key: this.key(e.providerId, e.capabilityId),
        successCount: e.successCount,
        age: now - e.lastSuccess,
      })),
    }
  }
}
