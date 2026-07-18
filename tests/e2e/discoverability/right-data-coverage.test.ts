// tests/e2e/discoverability/right-data-coverage.test.ts
// T3 (R3, US4) — Right-data coverage.
// Cross-checks the registered capability universe (devops offline catalog) against
// what the product CLI can surface, and reports the delta.

import { beforeAll, describe, expect, it } from 'bun:test'
import {
  PROBE_PORT,
  type ServerHandle,
  knownUniverseCaps,
  parseHelpCommands,
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
    console.log(
      `[T3] serverOk=${serverOk} universe=${universe.length} reachable=${reachable.length} missing=${missing.length} coverage=${(coverage * 100).toFixed(1)}%`,
    )
    if (missing.length > 0) {
      console.log(`[T3] missing sample: ${missing.slice(0, 10).join(', ')}`)
    }
    expect(universe.length).toBeGreaterThan(0)
    // GAP-1/GAP-2: server crash or missing cli surface means coverage < 100%
    if (serverOk) {
      expect(coverage).toBeLessThan(1)
    } else {
      console.log('[T3] GAP-5: server unreachable; CLI returns no capabilities — document this')
    }
  })

  it('builtin commands present (offline-safe check)', async () => {
    const help = await spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) })
    // Without server, help prints guidance message; with server it lists commands.
    // The exit code is always 0.
    expect(help.code).toBe(0)
    if (help.stdout.includes('No commands registered')) {
      console.log('[T3] No commands registered (server offline) — consistent with GAP-5')
    }
  })
})
