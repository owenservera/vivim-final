// src/storage/cross-boundary-cache.ts
// Cross-boundary read-through cache for system-side lookups used by user-side code.
// Caches provider and capability data from system DB to avoid repeated cross-DB reads.
// Uses TTL-based in-memory cache with background sweep (same pattern as response.ts).

import { getLogger } from '../lib/logger.js'

const log = getLogger('cross-boundary-cache')

// ── Cache Types ─────────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
  value: T
  expires: number
}

export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  size: number
}

// ── Cross-Boundary Cache Class ──────────────────────────────────────────

/**
 * TTL-based in-memory cache for cross-boundary reads.
 * System-side data (providers, capabilities) changes rarely, so we cache aggressively.
 */
export class CrossBoundaryCache {
  private cache = new Map<string, CacheEntry>()
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 }
  private sweepStarted = false
  private readonly defaultTtlMs: number
  private readonly sweepIntervalMs = 60_000

  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs
  }

  /**
   * Get a value from cache, or fetch and cache it if missing.
   * Cache-aside pattern: caller provides a fetcher function for cache misses.
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    this.startSweepIfNeeded()

    const now = Date.now()
    const entry = this.cache.get(key)

    if (entry && entry.expires > now) {
      this.stats.hits++
      return entry.value as T
    }

    this.stats.misses++
    const value = await fetcher()
    this.cache.set(key, {
      value,
      expires: now + (ttlMs ?? this.defaultTtlMs),
    })
    this.stats.size = this.cache.size
    return value
  }

  /**
   * Invalidate cache entries matching a prefix pattern.
   * Use 'provider:*' to clear all provider cache entries.
   */
  invalidate(pattern: string): void {
    const prefix = pattern.replace(/\*$/, '')
    let deleted = 0

    for (const [key] of this.cache) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        deleted++
      }
    }

    this.stats.evictions += deleted
    this.stats.size = this.cache.size

    if (deleted > 0) {
      log.debug({ pattern, deleted }, 'Invalidated cross-boundary cache entries')
    }
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    this.stats.evictions += size
    this.stats.size = 0
    log.debug({ cleared: size }, 'Cross-boundary cache cleared')
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Background sweep to remove expired entries (prevents unbounded growth).
   * Same pattern as src/server/response.ts:33-53.
   */
  private startSweepIfNeeded(): void {
    if (this.sweepStarted) return
    this.sweepStarted = true

    setInterval(() => {
      const now = Date.now()
      let deleted = 0

      for (const [key, entry] of this.cache) {
        if (entry.expires < now) {
          this.cache.delete(key)
          deleted++
        }
      }

      if (deleted > 0) {
        this.stats.evictions += deleted
        this.stats.size = this.cache.size
        log.debug({ deleted }, 'Swept expired cross-boundary cache entries')
      }
    }, this.sweepIntervalMs).unref()
  }
}

// ── Singleton Cache ─────────────────────────────────────────────────────

let instance: CrossBoundaryCache | null = null

export function getCrossBoundaryCache(): CrossBoundaryCache {
  if (!instance) {
    instance = new CrossBoundaryCache()
  }
  return instance
}

// ── Helper Functions for Common Cross-Boundary Reads ────────────────────

/**
 * Get a provider from system DB with caching.
 * System-side data changes rarely, so cache aggressively (60s TTL).
 */
export async function getCachedProvider(
  db: { systemPrisma: { providerDefinition: { findUnique: (args: { where: { id: string } }) => Promise<unknown> } } },
  providerId: string,
): Promise<unknown> {
  const cache = getCrossBoundaryCache()
  return cache.get(
    `provider:${providerId}`,
    () => db.systemPrisma.providerDefinition.findUnique({ where: { id: providerId } }),
  )
}

/**
 * Get a capability from system DB with caching.
 */
export async function getCachedCapability(
  db: { systemPrisma: { capabilityBinding: { findUnique: (args: { where: { id: string } }) => Promise<unknown> } } },
  capabilityId: string,
): Promise<unknown> {
  const cache = getCrossBoundaryCache()
  return cache.get(
    `capability:${capabilityId}`,
    () => db.systemPrisma.capabilityBinding.findUnique({ where: { id: capabilityId } }),
  )
}

/**
 * Get all capabilities for a provider from system DB with caching.
 */
export async function getCachedProviderCapabilities(
  db: { systemPrisma: { capabilityBinding: { findMany: (args: { where: { providerId: string } }) => Promise<unknown[]> } } },
  providerId: string,
): Promise<unknown[]> {
  const cache = getCrossBoundaryCache()
  return cache.get(
    `provider:${providerId}:capabilities`,
    () => db.systemPrisma.capabilityBinding.findMany({ where: { providerId } }),
    30_000, // shorter TTL for lists (may change more frequently)
  )
}
