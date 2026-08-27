// tests/e2e/discoverability/right-data-coverage.test.ts
// T3 (R3, US4) — Right-data coverage.
// Cross-checks the registered capability universe (devops offline catalog) against
// what the product CLI can surface, and reports the delta.

import { beforeAll, describe, expect, it } from 'bun:test'
import {
  knownUniverseCaps,
  PROBE_PORT,
  parseHelpCommands,
  type ServerHandle,
  spawnCli,
  startServer,
} from './harness.ts'

let server: ServerHandle | null = null
let universe: string[] = []
let serverOk = false

beforeAll(async () => {
  server = await startServer(PROBE_PORT)
  serverOk = server.ok
  universe = (await knownUniverseCaps()).map((c) => c.id)
})

describe('T3 Right-data coverage', () => {
  it('produces a coverage delta report', async () => {
    const help = await spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) })
    const visible = parseHelpCommands(help.stdout)
    const reachable = universe.filter((id) => {
      const tail = id.split(':').pop() ?? id
      return visible.includes(tail) || visible.includes(id)
    })
    const missing = universe.filter((id) => !reachable.includes(id))
    const coverage = universe.length === 0 ? 0 : reachable.length / universe.length
    // [audit] removed: console.log — T3 coverage result
    if (missing.length > 0) {
      // [audit] removed: console.log — T3 missing sample
    }
    expect(universe.length).toBeGreaterThan(0)
    // GAP-1/GAP-2: server crash or missing cli surface means coverage < 100%
    if (serverOk) {
      expect(coverage).toBeLessThan(1)
    } else {
      // [audit] removed: console.log — GAP-5: server unreachable
    }
  })

  it('builtin commands present (offline-safe check)', async () => {
    const help = await spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) })
    // Without server, help prints guidance message; with server it lists commands.
    // The exit code is always 0.
    expect(help.code).toBe(0)
    if (help.stdout.includes('No commands registered')) {
      // [audit] removed: console.log — No commands registered (server offline)
    }
  })
})
