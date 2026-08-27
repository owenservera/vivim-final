// tests/unit/server/response.test.ts
// Unit tests for the canonical response + error contract layer.
//
// Session 4 (2026-08-07): Expanded from 3 tests (ETag cache only) to full
// coverage of the public API: corsHeaders, json (incl. BigInt), withCORS
// (both branches), errorResponse (shape + status), appErrorResponse
// (AppError + plain Error + string), dispatch (success + fallback + error).
// The canonical error shape { error, code, details } is now verified by test.

import { afterEach, describe, expect, it } from 'bun:test'
import { AppError } from '../../../src/server/errors.js'
import {
  appErrorResponse,
  bustCache,
  corsHeaders,
  dispatch,
  errorResponse,
  json,
  sendJson,
  withCORS,
} from '../../../src/server/response.js'

describe('response.ts — ETag cache', () => {
  afterEach(() => {
    bustCache('test-cache')
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
    const etag = res1.headers.get('ETag') ?? ''
    const res2 = sendJson('test-cache', body, { ifNoneMatch: etag })
    expect(res2.status).toBe(304)
  })

  it('bustCache removes entry so next request is 200', () => {
    sendJson('test-cache', { before: 'bust' })
    bustCache('test-cache')
    const res2 = sendJson('test-cache', { after: 'bust' })
    expect(res2.status).toBe(200)
    expect(res2.headers.get('ETag')).toBeTruthy()
  })
})

describe('response.ts — corsHeaders', () => {
  it('returns all required CORS header keys', () => {
    const headers = corsHeaders()
    expect(headers['Access-Control-Allow-Origin']).toBe('*')
    expect(headers['Access-Control-Allow-Methods']).toContain('GET')
    expect(headers['Access-Control-Allow-Methods']).toContain('POST')
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization')
    expect(headers['Access-Control-Allow-Headers']).toContain('X-Trace-Id')
  })
})

describe('response.ts — json', () => {
  it('serializes an object to a JSON Response with CORS + ETag', async () => {
    const res = json({ hello: 'world' })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(res.headers.get('ETag')).toBeTruthy()
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await res.json()
    expect(body).toEqual({ hello: 'world' })
  })

  it('serializes BigInt values as strings (BigInt-safe)', async () => {
    const res = json({ count: 9007199254740993n })
    const body = (await res.json()) as { count: string }
    expect(body.count).toBe('9007199254740993')
  })

  it('respects the status parameter', () => {
    const res = json({ error: 'nope' }, 418)
    expect(res.status).toBe(418)
  })
})

describe('response.ts — withCORS', () => {
  it('returns the response as-is if it already has CORS headers', () => {
    const original = json({ ok: true })
    const result = withCORS(original)
    // Should be the same response (not a clone) — headers already present
    expect(result).toBe(original)
  })

  it('adds CORS headers to a response that lacks them', () => {
    const bare = new Response('{"ok":true}', {
      headers: { 'Content-Type': 'application/json' },
    })
    expect(bare.headers.get('Access-Control-Allow-Origin')).toBeNull()
    const result = withCORS(bare)
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(result.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })
})

describe('response.ts — errorResponse', () => {
  it('returns the canonical { error, code, details } shape', async () => {
    const res = errorResponse('thing not found', 'NotFound', 404)
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string; code: string; details?: unknown }
    expect(body.error).toBe('thing not found')
    expect(body.code).toBe('NotFound')
    expect(body.details).toBeUndefined()
  })

  it('includes details when provided', async () => {
    const res = errorResponse('bad input', 'ValidationError', 400, {
      field: 'email',
      issue: 'required',
    })
    const body = (await res.json()) as {
      error: string
      code: string
      details: Record<string, unknown>
    }
    expect(body.details).toEqual({ field: 'email', issue: 'required' })
  })

  it('defaults to status 500 when omitted', () => {
    const res = errorResponse('oops', 'InternalError')
    expect(res.status).toBe(500)
  })

  it('includes CORS headers on error responses', () => {
    const res = errorResponse('oops', 'InternalError', 500)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('response.ts — appErrorResponse', () => {
  it('converts an AppError to a response with its code, status, and details', async () => {
    const err = AppError.notFound('conversation 123 not found', { id: '123' })
    const res = appErrorResponse(err)
    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      error: string
      code: string
      details: Record<string, unknown>
    }
    expect(body.error).toBe('conversation 123 not found')
    expect(body.code).toBe('NotFound')
    expect(body.details).toEqual({ id: '123' })
  })

  it('converts a plain Error to a 500 InternalError', async () => {
    const res = appErrorResponse(new Error('something broke'))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string; code: string }
    expect(body.error).toBe('something broke')
    expect(body.code).toBe('InternalError')
  })

  it('converts a non-Error value to a 500 InternalError', async () => {
    const res = appErrorResponse('a string was thrown')
    expect(res.status).toBe(500)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('InternalError')
  })
})

describe('response.ts — dispatch', () => {
  it('returns the primary router response when non-null', async () => {
    const primary = () => json({ from: 'primary' })
    const fallback = () => json({ from: 'fallback' })
    const res = await dispatch(primary, fallback)
    const body = (await res.json()) as { from: string }
    expect(body.from).toBe('primary')
  })

  it('falls back when the primary returns null', async () => {
    const primary = () => null
    const fallback = () => json({ from: 'fallback' })
    const res = await dispatch(primary, fallback)
    const body = (await res.json()) as { from: string }
    expect(body.from).toBe('fallback')
  })

  it('catches sync throws from the primary router and returns appErrorResponse', async () => {
    const primary = () => {
      throw new Error('primary crashed')
    }
    const fallback = () => json({ from: 'fallback' })
    const res = await dispatch(primary, fallback)
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string; code: string }
    expect(body.error).toBe('primary crashed')
    expect(body.code).toBe('InternalError')
  })

  it('catches async rejections from the primary router', async () => {
    const primary = async () => {
      throw AppError.validation('async validation failed')
    }
    const fallback = () => json({ from: 'fallback' })
    const res = await dispatch(primary, fallback)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('ValidationError')
  })
})
