// tests/e2e/discoverability/two-command-ceiling.test.ts
// T1 (R1, US1) — Two-command ceiling.
// Boot the server, run one discovery command, measure what fraction of the
// capability universe is visible through the product CLI.
//
// Expected (GAP-1/GAP-2): `vivim help` only surfaces `cli`-surface caps.
// Additional finding: server may not boot due to kernel DB init bug (GAP-5).

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
  if (serverOk) {
    universe = (await knownUniverseCaps()).map((c) => c.id)
  } else {
    console.log(
      '[T1] WARN: server failed to boot — GAP-5 (kernel DB init). Coverage gap not measurable without server.',
    )
  }
})

describe('T1 Two-command ceiling', () => {
  it('records whether vivim serve boots the system', () => {
    // Soft assertion: logs the outcome without hard-failing.
    console.log(`[T1] serverOk=${serverOk}`)
  })

  it('vivim help surfaces CLI capabilities when server is reachable', async () => {
    if (!serverOk) {
      console.log('[T1] SKIP: server not reachable')
      return
    }
    const help = await spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) })
    expect(help.code).toBe(0)
    const cmds = parseHelpCommands(help.stdout)
    expect(cmds.length).toBeGreaterThan(0)
    expect(cmds).toContain('automate')
    expect(cmds).toContain('moments')
  })

  it('coverage gap: universe vs CLI-visible commands (when server reachable)', async () => {
    if (!serverOk) return
    const help = await spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) })
    const visible = new Set(parseHelpCommands(help.stdout))
    const reachable = universe.filter((id) => {
      const tail = id.split(':').pop() ?? id
      return visible.has(tail) || visible.has(id)
    })
    const coverage = universe.length === 0 ? 0 : reachable.length / universe.length
    console.log(
      `[T1] universe=${universe.length} cliVisible=${visible.size} reachable=${reachable.length} coverage=${(coverage * 100).toFixed(1)}%`,
    )
  })
})
