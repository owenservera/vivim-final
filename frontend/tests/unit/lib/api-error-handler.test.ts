import { describe, test, expect } from 'bun:test'
import { apiHandler } from '@/lib/api-error-handler'
import { NextRequest, NextResponse } from 'next/server'

describe('apiHandler', () => {
  const makeReq = () => new NextRequest(new Request('http://localhost:3000/api/test'))

  test('returns handler result on success', async () => {
    const handler = apiHandler(async () => {
      return NextResponse.json({ ok: true })
    })
    const res = await handler(makeReq())
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test('catches errors and returns JSON error', async () => {
    const handler = apiHandler(async () => {
      throw new Error('boom')
    })
    const res = await handler(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Error')
    expect(body.message).toBe('boom')
  })

  test('maps auth errors to 401', async () => {
    const handler = apiHandler(async () => {
      throw new Error('unauthorized')
    })
    const res = await handler(makeReq())
    expect(res.status).toBe(401)
  })

  test('maps validation errors to 400', async () => {
    const handler = apiHandler(async () => {
      throw new Error('bad request')
    })
    const res = await handler(makeReq())
    expect(res.status).toBe(400)
  })
})
