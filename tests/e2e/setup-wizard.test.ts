// tests/e2e/setup-wizard.test.ts
// E2E: Provider setup wizard flow — API surface only (no Chrome needed for offline tests).

import { describe, expect, it } from 'bun:test'

const BASE = `http://127.0.0.1:${process.env.CAP_STORE_PORT ?? 9420}`

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(10_000),
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body: body as any }
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  const rBody = await res.json().catch(() => null)
  return { status: res.status, body: rBody as any }
}

describe('Setup Wizard E2E', () => {
  it('GET /api/setup/profiles returns profiles array', async () => {
    const { status, body } = await get('/api/setup/profiles')
    expect(status).toBe(200)
    expect(body).toHaveProperty('profiles')
  })

  it('GET /api/providers returns non-empty provider list', async () => {
    const { status, body } = await get('/api/providers')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  it('GET /api/health/providers returns health object', async () => {
    const { status, body } = await get('/api/health/providers')
    expect(status).toBe(200)
    expect(typeof body).toBe('object')
  })

  it('POST /api/capabilities/system_version/execute returns version info', async () => {
    const { status, body } = await post('/api/capabilities/system_version/execute', { input: {} })
    expect(status).toBe(200)
    expect(body.output).toHaveProperty('version')
  })

  it('GET /api/nlcl/help returns command help', async () => {
    const { status, body } = await get('/api/nlcl/help')
    expect(status).toBe(200)
    expect(body).toHaveProperty('totalCommands')
  })
})
