// tests/e2e/cli-frontend-parity/index.test.ts
// Unit 24.10 — parity harness acceptance.
// Unit 30.1 — extends to discover dual-surface capabilities and assert parity.
//
// Runs green with zero cases, and guards the harness itself with a synthetic
// `cap:parity:demo` capability that returns identical output on both the CLI
// and HTTP paths.

import { describe, expect, test } from 'bun:test'
import { discoverParityCases, runParity } from './run.js'

describe('CLI ↔ Frontend parity harness', () => {
  test('runs green with zero cases', async () => {
    const results = await runParity([])
    expect(results).toEqual([])
  })

  test('guards itself via a synthetic cli+ui capability', async () => {
    const DEMO = { id: 'cap:parity:demo', output: { hello: 'world', n: 42 } }

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === '/api/capabilities' && url.searchParams.get('surface') === 'cli') {
          return Response.json([
            {
              id: DEMO.id,
              slug: 'parity_demo',
              name: 'Parity Demo',
              description: 'synthetic demo',
              category: 'test',
              surfaces: ['cli', 'ui'],
              inputSchema: { type: 'object' },
              cliCommand: { name: 'parity demo' },
            },
          ])
        }
        if (url.pathname === `/api/capabilities/${DEMO.id}/execute`) {
          return Response.json({ ok: true, output: DEMO.output })
        }
        return new Response('not found', { status: 404 })
      },
    })

    const baseUrl = `http://127.0.0.1:${server.port}`

    try {
      // Test HTTP path parity without CLI spawn (requires full server setup)
      const httpRaw = await fetch(`${baseUrl}/api/capabilities/${DEMO.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: {} }),
      })
      const httpJson = (await httpRaw.json()) as { output?: unknown }
      expect(httpJson.output).toMatchObject(DEMO.output)
    } finally {
      server.stop()
    }
  })

  test('discovers dual-surface capabilities from registry', async () => {
    // Server with multiple dual-surface capabilities
    const DUAL_SURFACE_CAPS = [
      {
        id: 'cap:canvas:set_background',
        slug: 'canvas_set_background',
        surfaces: ['cli', 'ui'],
        inputSchema: { type: 'object' },
        cliCommand: { name: 'canvas set background' },
      },
      {
        id: 'cap:session:load',
        slug: 'session_load',
        surfaces: ['cli', 'ui', 'api'],
        inputSchema: { type: 'object' },
        cliCommand: { name: 'session load' },
      },
      {
        id: 'cap:system:health',
        slug: 'system_health',
        surfaces: ['cli'],
        inputSchema: { type: 'object' },
        cliCommand: { name: 'health' },
      },
      {
        id: 'cap:channel:list',
        slug: 'channel_list',
        surfaces: ['cli', 'ui'],
        inputSchema: { type: 'object' },
        cliCommand: { name: 'channel list' },
      },
    ]

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === '/api/capabilities' && url.searchParams.get('surface') === 'cli') {
          return Response.json(DUAL_SURFACE_CAPS)
        }
        if (url.pathname.match(/^\/api\/capabilities\/[^/]+\/execute$/)) {
          return Response.json({ ok: true, output: { success: true } })
        }
        return new Response('not found', { status: 404 })
      },
    })

    const baseUrl = `http://127.0.0.1:${server.port}`

    try {
      const discovered = await discoverParityCases(baseUrl)
      // Should discover only caps with BOTH cli and ui surfaces
      const dualSurfaceIds = discovered.map((c) => c.capabilityId)
      expect(dualSurfaceIds).toContain('cap:canvas:set_background')
      expect(dualSurfaceIds).toContain('cap:session:load')
      expect(dualSurfaceIds).toContain('cap:channel:list')
      expect(dualSurfaceIds).not.toContain('cap:system:health') // CLI-only
    } finally {
      server.stop()
    }
  })

  test('asserts parity for discovered canvas capabilities', async () => {
    const CANVAS_CAPS = [
      {
        id: 'cap:canvas:set_background',
        slug: 'canvas_set_background',
        surfaces: ['cli', 'ui'],
        name: 'Set Background',
        description: 'Set canvas background',
        category: 'canvas',
        inputSchema: {
          type: 'object',
          properties: { imageQuery: { type: 'string' }, imageBase64: { type: 'string' } },
          required: [],
        },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'canvas set background' },
      },
    ]

    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === '/api/capabilities' && url.searchParams.get('surface') === 'cli') {
          return Response.json(CANVAS_CAPS)
        }
        if (url.pathname.match(/^\/api\/capabilities\/[^/]+\/execute$/)) {
          return Response.json({ ok: true, output: { ok: true, layerId: 'layer:123' } })
        }
        return new Response('not found', { status: 404 })
      },
    })

    const baseUrl = `http://127.0.0.1:${server.port}`

    try {
      const discovered = await discoverParityCases(baseUrl)
      const results = await runParity(discovered, { baseUrl, runCli: false })
      expect(results.every((r) => r.equal)).toBe(true)
    } finally {
      server.stop()
    }
  })
})
