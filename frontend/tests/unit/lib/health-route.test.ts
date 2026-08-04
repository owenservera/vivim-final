import { describe, test, expect } from 'bun:test'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  test('returns status ok or degraded', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.status).toBeOneOf(['ok', 'degraded'])
    expect(typeof body.uptime).toBe('number')
    expect(typeof body.timestamp).toBe('string')
    expect(typeof body.backend).toBe('string')
  })
})
