// devops/commands/audit.ts
// Command handler for source code audits, architecture audits, invariants, and SOTA scans.

import { runAuditArch } from '../audit-arch/index.ts'
import { runAuditCode } from '../audit-code/index.ts'
import { runDeepScan } from '../deep-scan/index.ts'
import { checkInvariants, generateInvariantReport } from '../invariants.ts'

export async function handle(args: string[]): Promise<void> {
  const [cmd, ...rest] = args

  if (cmd === 'audit-code') {
    await runAuditCode(rest)
    return
  }

  if (cmd === 'audit-arch') {
    await runAuditArch(rest)
    return
  }

  if (cmd === 'deep-scan') {
    await runDeepScan(rest)
    return
  }

  if (cmd === 'sota') {
    await runAuditCode(['sota', ...rest])
    return
  }

  if (cmd === 'invariants') {
    const subcmd = rest[0] ?? 'check'
    if (subcmd === 'check') {
      const unitId = rest.includes('--unit') ? rest[rest.indexOf('--unit') + 1] : undefined
      const category = rest.includes('--category')
        ? (rest[rest.indexOf('--category') + 1] as 'A' | 'B' | 'C' | 'D' | 'E')
        : undefined
      const result = await checkInvariants(unitId, category)
      // [audit] removed: console.log(JSON.stringify(result, null, 2))
      process.exit(result.pass ? 0 : 1)
    } else if (subcmd === 'report') {
      // [audit] removed: console.log(await generateInvariantReport())
    } else {
      // [audit] removed: console.error(
        'usage: devops invariants <check|report> [--unit <id>] [--category <A|B|C|D>]',
      )
      process.exit(1)
    }
  }
}
