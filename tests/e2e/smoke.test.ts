// tests/e2e/smoke.test.ts
// Smoke test harness. No browser required.

import { beforeAll, describe, expect, it } from 'bun:test'
const BASE = `http://127.0.0.1:${process.env.CAP_STORE_PORT ?? 9420}`

async function fetchJson(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

describe('Smoke Test', () => {
  beforeAll(async () => {
    // Give the server a moment if it was just started
    await Bun.sleep(1000)
  })

  it('GET /health returns status ok', async () => {
    const { status, body } = await fetchJson('/health')
    expect(status).toBe(200)
    expect(body).toHaveProperty('status')
    expect(body.status).toBe('ok')
  })

  it('GET /readyz returns status', async () => {
    const { status, body } = await fetchJson('/readyz')
    // May be 503 if server still starting — both are valid responses
    expect([200, 503]).toContain(status)
    expect(body).toHaveProperty('status')
  })

  it('GET /api/capabilities?surface=ui returns capability array', async () => {
    const { status, body } = await fetchJson('/api/capabilities?surface=ui')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    // Verify capability shape
    const cap = body[0] as any
    expect(cap).toHaveProperty('id')
    expect(cap).toHaveProperty('slug')
    expect(cap).toHaveProperty('name')
  })

  it('GET /api/capabilities?surface=cli returns CLI capabilities', async () => {
    const { status, body } = await fetchJson('/api/capabilities?surface=cli')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    // At least one CLI capability with a cliCommand
    const cliCaps = (body as any[]).filter((c: any) => c.cliCommand)
    expect(cliCaps.length).toBeGreaterThan(0)
  })

  it('GET /api/providers returns provider list', async () => {
    const { status, body } = await fetchJson('/api/providers')
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toHaveProperty('id')
    expect(body[0]).toHaveProperty('slug')
  })

  it('GET /api/nlcl/help returns help', async () => {
    const { status, body } = await fetchJson('/api/nlcl/help')
    expect(status).toBe(200)
    expect(body).toHaveProperty('categories')
    expect(body).toHaveProperty('totalCommands')
  })

  it('GET /api/nlcl/commands returns command list', async () => {
    const { status, body } = await fetchJson('/api/nlcl/commands')
    expect(status).toBe(200)
    expect(body).toHaveProperty('commands')
    expect(body).toHaveProperty('total')
    expect(body.total).toBeGreaterThan(0)
  })

  it('POST /api/nlcl/interpret returns parsing result', async () => {
    const { status, body } = await fetchJson('/api/nlcl/interpret', {
      method: 'POST',
      body: JSON.stringify({ input: 'system version' }),
    })
    expect(status).toBe(200)
    expect(body).toHaveProperty('ok')
    expect(body).toHaveProperty('intent')
  })

  it('GET /api/setup/profiles returns profiles', async () => {
    const { status, body } = await fetchJson('/api/setup/profiles')
    expect(status).toBe(200)
    expect(body).toHaveProperty('profiles')
  })

  it('GET /api/health/providers returns provider health', async () => {
    const { status, body } = await fetchJson('/api/health/providers')
    expect(status).toBe(200)
    expect(typeof body).toBe('object')
  })

  it('POST /api/capabilities/system_health/execute works', async () => {
    const { status, body } = await fetchJson('/api/capabilities/system_health/execute', {
      method: 'POST',
      body: JSON.stringify({ input: {} }),
    })
    expect(status).toBe(200)
    expect(body).toHaveProperty('ok')
    expect(body.ok).toBe(true)
  })

  it('POST /api/capabilities/system_version/execute returns version', async () => {
    const { status, body } = await fetchJson('/api/capabilities/system_version/execute', {
      method: 'POST',
      body: JSON.stringify({ input: {} }),
    })
    expect(status).toBe(200)
    expect(body.output).toHaveProperty('version')
  })
})
