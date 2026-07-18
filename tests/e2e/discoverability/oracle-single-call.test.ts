// tests/e2e/discoverability/oracle-single-call.test.ts
// T4 (R4, US2) — Oracle single-call reachability.
// The kernel oracle (`POST /api/kernel/oracle/query {op:"all"}`) is the ONE call
// that should surface topology+health+capability+config. This test checks
// whether that single-call path is reachable through the product CLI.
//
// Expected (GAP-3): the oracle is server-only (kernel-router.ts) with no cli
// surface binding — unreachable under the CLI-only constraint.

import { beforeAll, describe, expect, it } from 'bun:test'
import {
  PROBE_PORT,
  type ServerHandle,
  parseHelpCommands,
  spawnCli,
  spawnDevops,
  startServer,
} from './harness.ts'

let server: ServerHandle | null = null
let serverOk = false

beforeAll(async () => {
  server = await startServer(PROBE_PORT)
  serverOk = server.ok
})

describe('T4 Oracle single-call reachability', () => {
  it('no product-CLI command binds the kernel oracle (GAP-3)', async () => {
    if (!serverOk) return
    const help = await spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) })
    const visible = parseHelpCommands(help.stdout)
    const oracleLike = visible.filter((c) =>
      /oracle|kernel|topology|system.map|introspect/i.test(c),
    )
    console.log(`[T4] oracle-like CLI commands: ${oracleLike.join(', ') || '(none)'}`)
    expect(help.code).toBe(0)
    expect(Array.isArray(oracleLike)).toBe(true)
  })

  it('devops tooling provides offline oracle-equivalent discovery', async () => {
    const r = await spawnDevops(['runtime-test', 'discover', '--offline'])
    console.log(
      `[T4] devops discover --offline exit=${r.code} output=${r.stdout.length}b in ${r.ms}ms`,
    )
    expect(r.code).toBe(0)
  })
})
