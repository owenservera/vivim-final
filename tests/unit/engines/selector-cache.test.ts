import { beforeEach, describe, expect, it } from 'bun:test'
import { SelectorCache } from '../../../src/engines/selector-cache.js'

describe('selector-cache', () => {
  let cache: SelectorCache

  beforeEach(() => {
    cache = new SelectorCache({ maxAgeMs: 60_000, maxEntries: 10 })
  })

  it('get returns null for missing entry', () => {
    expect(cache.get('chatgpt', 'send')).toBeNull()
  })

  it('record + get returns cached entry', () => {
    cache.record('chatgpt', 'send', 'button.submit')
    const entry = cache.get('chatgpt', 'send')
    expect(entry).not.toBeNull()
    expect(entry?.selector).toBe('button.submit')
    expect(entry?.providerId).toBe('chatgpt')
    expect(entry?.capabilityId).toBe('send')
    expect(entry?.successCount).toBe(1)
  })

  it('increments successCount on repeated record', () => {
    cache.record('chatgpt', 'send', 'button.submit')
    cache.record('chatgpt', 'send', 'button.submit')
    const entry = cache.get('chatgpt', 'send')
    expect(entry?.successCount).toBe(2)
  })

  it('evicts oldest entry when maxEntries exceeded', () => {
    for (let i = 0; i < 10; i++) {
      cache.record('p', `cap${i}`, 'sel')
    }
    cache.record('p', 'cap_new', 'sel')
    expect(cache.get('p', 'cap0')).toBeNull()
    expect(cache.get('p', 'cap_new')).not.toBeNull()
  })

  it('returns null for expired entry', () => {
    const shortCache = new SelectorCache({ maxAgeMs: 1 })
    shortCache.record('p', 'c', 'sel')
    const start = Date.now()
    while (Date.now() - start < 5) {}
    expect(shortCache.get('p', 'c')).toBeNull()
  })

  it('invalidate removes entry', () => {
    cache.record('p', 'c', 'sel')
    cache.invalidate('p', 'c')
    expect(cache.get('p', 'c')).toBeNull()
  })

  it('stats returns size and entries', () => {
    cache.record('p', 'c1', 'sel')
    cache.record('p', 'c2', 'sel')
    const s = cache.stats()
    expect(s.size).toBe(2)
    expect(s.entries).toHaveLength(2)
    expect(s.entries[0].key).toBe('p:c1')
  })
})
