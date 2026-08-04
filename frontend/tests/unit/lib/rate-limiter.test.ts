import { describe, test, expect } from 'bun:test'
import { rateLimit, rateLimitKey } from '@/lib/rate-limiter'

describe('rate-limiter', () => {
  test('allows requests within limit', () => {
    const result = rateLimit('test-ok', 5, 60_000)
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(4)
  })

  test('blocks requests exceeding limit', () => {
    const key = 'test-block'
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000)
    const blocked = rateLimit(key, 3, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  test('different keys are independent', () => {
    rateLimit('key-a', 1, 60_000)
    const b = rateLimit('key-b', 2, 60_000)
    expect(b.ok).toBe(true)
    expect(b.remaining).toBe(1)
  })

  test('returns resetMs on blocked request', () => {
    const key = 'test-reset'
    rateLimit(key, 1, 10_000)
    const result = rateLimit(key, 1, 10_000)
    expect(result.ok).toBe(false)
    expect(result.resetMs).toBeGreaterThan(0)
    expect(result.resetMs).toBeLessThanOrEqual(10_000)
  })
})

describe('rateLimitKey', () => {
  test('builds key from request', () => {
    const req = new Request('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    const key = rateLimitKey(req)
    expect(key).toContain('1.2.3.4')
    expect(key).toContain('/api/test')
  })

  test('uses prefix when provided', () => {
    const req = new Request('http://localhost:3000/api/test')
    const key = rateLimitKey(req, 'v1')
    expect(key).toMatch(/^v1:/)
  })
})
