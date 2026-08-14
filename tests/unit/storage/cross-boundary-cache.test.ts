// tests/unit/storage/cross-boundary-cache.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CrossBoundaryCache, getCrossBoundaryCache } from '../../../src/storage/cross-boundary-cache.js'

describe('CrossBoundaryCache', () => {
  let cache: CrossBoundaryCache

  beforeEach(() => {
    cache = new CrossBoundaryCache(1000) // 1s TTL for tests
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('caches and returns values', async () => {
    let fetchCount = 0
    const result = await cache.get('test', async () => {
      fetchCount++
      return { id: '1', name: 'test' }
    })
    expect(result).toEqual({ id: '1', name: 'test' })
    expect(fetchCount).toBe(1)

    // Second call returns cached
    const result2 = await cache.get('test', async () => {
      fetchCount++
      return { id: '1', name: 'test' }
    })
    expect(result2).toEqual({ id: '1', name: 'test' })
    expect(fetchCount).toBe(1) // Not incremented
  })

  it('propagates fetch errors', async () => {
    await expect(
      cache.get('fail', async () => {
        throw new Error('fetch failed')
      }),
    ).rejects.toThrow('fetch failed')
  })

  it('invalidates specific entries', async () => {
    await cache.get('provider:1', async () => ({ id: '1' }))
    expect(cache.getStats().size).toBe(1)

    cache.invalidate('provider:1')
    expect(cache.getStats().size).toBe(0)
  })

  it('invalidates by prefix pattern', async () => {
    await cache.get('provider:1', async () => ({ id: '1' }))
    await cache.get('provider:2', async () => ({ id: '2' }))
    await cache.get('capability:1', async () => ({ id: '1' }))
    expect(cache.getStats().size).toBe(3)

    cache.invalidate('provider:')
    expect(cache.getStats().size).toBe(1) // Only capability:1 remains
  })

  it('clears all entries', async () => {
    await cache.get('a', async () => 'a')
    await cache.get('b', async () => 'b')
    cache.clear()
    expect(cache.getStats().size).toBe(0)
  })

  it('respects TTL and expires entries', async () => {
    // Use short TTL for this test
    const shortCache = new CrossBoundaryCache(100)
    await shortCache.get('expire', async () => 'value')
    expect(await shortCache.get('expire', async () => 'new')).toBe('value')

    // Advance past TTL
    vi.advanceTimersByTime(200)

    // Now fetches fresh
    const result = await shortCache.get('expire', async () => 'fresh')
    expect(result).toBe('fresh')
  })

  it('returns cache stats', async () => {
    await cache.get('a', async () => 'a')
    await cache.get('b', async () => 'b')
    const stats = cache.getStats()
    expect(stats.size).toBe(2)
    expect(stats.hits).toBeGreaterThanOrEqual(0)
    expect(stats.misses).toBe(2)
  })

  it('singleton returns same instance', () => {
    const a = getCrossBoundaryCache()
    const b = getCrossBoundaryCache()
    expect(a).toBe(b)
  })
})
