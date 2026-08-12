// devops/commands/gate.ts
// Command handler for quality gates, unit selection, closure loops, and utility ops.

import { audit } from '../audit.ts'
import { captureBaseline } from '../baseline.ts'
import { runGate } from '../gate.ts'
import { gc } from '../gc.ts'
import { runLoop } from '../loop.ts'
import { markUnit } from '../mark.ts'
import { formatOutput } from '../output-format.ts'
import { report } from '../report.ts'
import { selectNext } from '../select.ts'

export async function handle(args: string[]): Promise<void> {
  const [cmd, ...rest] = args

  switch (cmd) {
    case 'select': {
      const sel = await selectNext()
      formatOutput(sel ?? { ok: false, message: 'no unit selectable' }, rest)
      break
    }
    case 'mark': {
      const [id, state] = rest
      if (!id || !state) {
        // [audit] removed: console.error('usage: devops mark <id> <pending|in_progress|done|blocked>')
        process.exit(1)
      }
      await markUnit(id, state as 'pending' | 'in_progress' | 'done' | 'blocked')
      // [audit] removed: console.log(`marked ${id} -> ${state}`)
      break
    }
    case 'gate': {
      const strict = rest.includes('--strict')
      const full = rest.includes('--full')
      const includeIntegration = rest.includes('--include-integration') || full
      if (rest.includes('--capture-baseline')) {
        const baseline = await captureBaseline()
        // [audit] removed: console.log(JSON.stringify(baseline, null, 2))
        process.exit(0)
      }
      const gateResult = await runGate(strict, includeIntegration, full ? 'full' : 'regression')
      formatOutput(gateResult, rest)
      break
    }
    case 'toolkit': {
      const { runToolkit } = await import('../toolkit/index.ts')
      const code = await runToolkit(rest)
      process.exit(code)
      break
    }
    case 'fmt': {
      const { fmt } = await import('../fmt.ts')
      await fmt()
      break
    }
    case 'run': {
      const maxUnits = rest.find((a) => a.startsWith('--max-units='))
        ? Number(rest.find((a) => a.startsWith('--max-units='))!.split('=')[1])
        : undefined
      const result = await runLoop({
        maxUnits,
        commit: rest.includes('--commit'),
        strict: rest.includes('--strict'),
      })
      // [audit] removed: console.log(
        JSON.stringify(
          {
            processed: result.processed,
            done: result.done,
            blocked: result.blocked,
            allComplete: result.allComplete,
          },
          null,
          2,
        ),
      )
      if (!result.allComplete) process.exit(1)
      break
    }
    case 'audit': {
      const [id, ...notes] = rest
      if (!id) {
        // [audit] removed: console.error('usage: devops audit <id> "<gate summary / notes>"')
        process.exit(1)
      }
      await audit(id, notes.join(' '))
      break
    }
    case 'gc': {
      gc(rest.includes('--force'))
      break
    }
    case 'profiles': {
      const { runProfileCleanup } = await import('../profile-cleanup.ts')
      const code = await runProfileCleanup(rest)
      process.exit(code)
      break
    }
    case 'report': {
      formatOutput({ report: await report() }, rest)
      break
    }
    default: {
      // [audit] removed: console.error(`Unknown gate command: ${cmd}`)
      process.exit(1)
    }
  }
}
