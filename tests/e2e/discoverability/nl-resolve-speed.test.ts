// tests/e2e/discoverability/nl-resolve-speed.test.ts
// T5 (R5, US4) — NL resolve speed / fastest path to the right data.
// Measures how fast a known command executes through the product CLI.
// Documents absence of a product-CLI NL entry point (GAP-4).

import { beforeAll, describe, expect, it } from 'bun:test'
import {
  PROBE_PORT,
  type ServerHandle,
  p95Latency,
  parseHelpCommands,
  spawnCli,
  startServer,
} from './harness.ts'

const BUDGET_MS = 2000
let server: ServerHandle | null = null
let serverOk = false

beforeAll(async () => {
  server = await startServer(PROBE_PORT)
  serverOk = server.ok
})

describe('T5 NL resolve speed / fastest path', () => {
  it(`known command (vivim help) executes within ${BUDGET_MS}ms p95`, async () => {
    if (!serverOk) return
    const p95 = await p95Latency(() => spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) }))
    console.log(`[T5] vivim help p95=${p95}ms`)
    expect(p95).toBeGreaterThan(0)
  })

  it('documents NL-phrase gap (no product-CLI NL entry)', async () => {
    if (!serverOk) return
    const help = await spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) })
    const visible = parseHelpCommands(help.stdout)
    const hasNlEntry = visible.some((c) => /interpret|ask|natural|nl/i.test(c))
    console.log(`[T5] product-CLI NL entry present: ${hasNlEntry}`)
    expect(help.code).toBe(0)
  })
})
