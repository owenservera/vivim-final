// tests/unit/server/response.test.ts
// Unit 1.5 — ETag cache + 304 support

import { afterEach, describe, expect, it } from 'bun:test'
import { bustCache, sendJson } from '../../../src/server/response.js'

describe('response.ts — ETag cache', () => {
  afterEach(() => {
    // Clear cache between tests
    for (const key of ['test-cache']) {
      bustCache(key)
    }
  })

  it('sendJson returns 200 with body on first request', () => {
    const body = { foo: 'bar', count: 42 }
    const res = sendJson('test-cache', body)

    expect(res.status).toBe(200)
    expect(res.headers.get('ETag')).toBeTruthy()
    expect(res.headers.get('Cache-Control')).toMatch(/max-age/)
  })

  it('sendJson returns 304 when If-None-Match matches', () => {
    const body = { data: 'value' }
    const res1 = sendJson('test-cache', body)
    const etag = res1.headers.get('ETag')!

    const res2 = sendJson('test-cache', body, { ifNoneMatch: etag })
    expect(res2.status).toBe(304)
  })

  it('bustCache removes entry so next request is 200', () => {
    const body = { before: 'bust' }
    const res1 = sendJson('test-cache', body)
    const _etag1 = res1.headers.get('ETag')!

    bustCache('test-cache')

    const res2 = sendJson('test-cache', { after: 'bust' })
    expect(res2.status).toBe(200)
    // ETag changes because time-based
    expect(res2.headers.get('ETag')).toBeTruthy()
  })
})
