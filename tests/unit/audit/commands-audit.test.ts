// atomic-v15 / Phase 29.1 — lock-in test for the command-surface audit refinement.
//
// After closing the command-surface audit (P1=6 dangling + P2=60), the
// `commands` pass must report zero P1 and zero P2 findings against the real
// source tree. This guards against regressions (e.g. re-introducing a dangling
// NL binding, a duplicate cliCommand, a surface declared-but-unbound cap, or
// flagging cli/ui/mcp/api-bound caps as "missing a command").
import { describe, expect, it } from 'bun:test'
import { checkCommands } from '../../../devops/audit-arch/passes/commands.ts'

describe('command-surface audit (atomic-v15)', () => {
  it('reports no P1 or P2 findings against the real source tree', async () => {
    const findings = await checkCommands({} as never, 'standard')
    const p1 = findings.filter((f) => f.priority === 'P1')
    const p2 = findings.filter((f) => f.priority === 'P2')
    expect(
      p1,
      `expected 0 P1 findings, got: ${JSON.stringify(p1.map((f) => f.title))}`,
    ).toHaveLength(0)
    expect(
      p2,
      `expected 0 P2 findings, got: ${JSON.stringify(p2.map((f) => f.title))}`,
    ).toHaveLength(0)
  })

  it('treats uiAction as a valid UI surface binding', async () => {
    const findings = await checkCommands({} as never, 'standard')
    const surfaceUnbound = findings.filter(
      (f) => f.priority === 'P2' && f.title.includes('declared but not bound'),
    )
    expect(surfaceUnbound).toHaveLength(0)
  })
})
