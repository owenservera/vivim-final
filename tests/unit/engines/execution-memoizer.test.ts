// tests/unit/engines/execution-memoizer.test.ts
// Unit tests for ExecutionMemoizer — pure in-memory cache, no store needed.

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  ExecutionMemoizer,
  type MemoizerEventBus,
} from '../../../src/engines/execution-memoizer.js'

// ── Mock event bus ─────────────────────────────────────────────────────────

function createMockEventBus() {
  const handlers = new Map<string, Array<(data: unknown) => void>>()
  return {
    bus: {
      emit(event: string, data: unknown) {
        const handlersForEvent = handlers.get(event)
        if (handlersForEvent) {
          for (const h of handlersForEvent) h(data)
        }
      },
      on(event: string, handler: (data: unknown) => void) {
        if (!handlers.has(event)) handlers.set(event, [])
        const list = handlers.get(event)
        if (list) list.push(handler)
      },
    } satisfies MemoizerEventBus,
    handlers,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ExecutionMemoizer', () => {
  let memoizer: ExecutionMemoizer

  beforeEach(() => {
    memoizer = new ExecutionMemoizer(undefined, { defaultTtlMs: 1000, maxEntries: 5 })
  })

  it('getOrCompute() returns cached value if within TTL', async () => {
    let callCount = 0
    const result = await memoizer.getOrCompute('key1', async () => {
      callCount++
      return 'value1'
    })
    expect(result).toBe('value1')
    expect(callCount).toBe(1)

    const cached = await memoizer.getOrCompute('key1', async () => {
      callCount++
      return 'value2'
    })
    expect(cached).toBe('value1')
    expect(callCount).toBe(1)
  })

  it('getOrCompute() recomputes if TTL expired', async () => {
    let callCount = 0
    const shortMemoizer = new ExecutionMemoizer(undefined, { defaultTtlMs: 1 })

    await shortMemoizer.getOrCompute('key1', async () => {
      callCount++
      return 'v1'
    })
    expect(callCount).toBe(1)

    await new Promise((r) => setTimeout(r, 5))

    const result = await shortMemoizer.getOrCompute('key1', async () => {
      callCount++
      return 'v2'
    })
    expect(result).toBe('v2')
    expect(callCount).toBe(2)
  })

  it('invalidate(key) removes specific entry', async () => {
    await memoizer.getOrCompute('key1', async () => 'value1')
    memoizer.invalidate('key1')

    let callCount = 0
    await memoizer.getOrCompute('key1', async () => {
      callCount++
      return 'value2'
    })
    expect(callCount).toBe(1)
  })

  it('invalidateByPrefix() clears matching entries', async () => {
    await memoizer.getOrCompute('resolve:a', async () => 'ra')
    await memoizer.getOrCompute('resolve:b', async () => 'rb')
    await memoizer.getOrCompute('health:a', async () => 'ha')

    memoizer.invalidateByPrefix('resolve:')

    let callCount = 0
    await memoizer.getOrCompute('resolve:a', async () => {
      callCount++
      return 'ra2'
    })
    await memoizer.getOrCompute('health:a', async () => {
      callCount++
      return 'ha2'
    })
    expect(callCount).toBe(1)
  })

  it('invalidateAll() clears all caches', async () => {
    await memoizer.getOrCompute('a', async () => 1)
    await memoizer.getOrCompute('b', async () => 2)
    memoizer.invalidateAll()

    let callCount = 0
    await memoizer.getOrCompute('a', async () => {
      callCount++
      return 3
    })
    expect(callCount).toBe(1)
  })

  it('invalidateAll() called on provider:seeded event', async () => {
    const mockBus = createMockEventBus()
    const memoizerWithBus = new ExecutionMemoizer(mockBus.bus, { defaultTtlMs: 5000 })

    await memoizerWithBus.getOrCompute('key1', async () => 'value1')
    mockBus.bus.emit('provider:seeded', {})

    let callCount = 0
    await memoizerWithBus.getOrCompute('key1', async () => {
      callCount++
      return 'value2'
    })
    expect(callCount).toBe(1)
  })

  it('LRU eviction: oldest entry removed when cache exceeds maxEntries', async () => {
    const smallMemoizer = new ExecutionMemoizer(undefined, { defaultTtlMs: 5000, maxEntries: 3 })

    await smallMemoizer.getOrCompute('a', async () => 1)
    await smallMemoizer.getOrCompute('b', async () => 2)
    await smallMemoizer.getOrCompute('c', async () => 3)
    await smallMemoizer.getOrCompute('d', async () => 4)

    const stats = smallMemoizer.getStats()
    expect(stats.size).toBe(3)

    let callCount = 0
    await smallMemoizer.getOrCompute('a', async () => {
      callCount++
      return 99
    })
    expect(callCount).toBe(1)
  })

  it('getStats() reports correct size and hitRate', async () => {
    await memoizer.getOrCompute('a', async () => 1)
    await memoizer.getOrCompute('a', async () => 2)
    await memoizer.getOrCompute('b', async () => 3)

    const stats = memoizer.getStats()
    expect(stats.size).toBe(2)
    expect(stats.hits).toBe(1)
    expect(stats.misses).toBe(2)
    expect(stats.hitRate).toBeCloseTo(1 / 3)
  })

  it('set() and get() work without compute function', () => {
    memoizer.set('direct', 'value', 5000)
    expect(memoizer.get<string>('direct')).toBe('value')
  })

  it('get() returns undefined for expired entries', async () => {
    const shortMemoizer = new ExecutionMemoizer(undefined, { defaultTtlMs: 1 })
    shortMemoizer.set('expiring', 'value', 1)
    await new Promise((r) => setTimeout(r, 5))
    expect(shortMemoizer.get('expiring')).toBeUndefined()
  })

  it('get() returns undefined for missing keys', () => {
    expect(memoizer.get('nonexistent')).toBeUndefined()
  })
})
