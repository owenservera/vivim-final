// devops/index.ts
// CLI entry: `bun run devops <cmd> [args]`
//
//   select            -> print next implementable unit as JSON (or "null")
//   mark <id> <s>    -> transition state: pending|in_progress|done|blocked
//   gate             -> run quality gate, print JSON, exit non-zero on fail
//   report           -> print progress summary

import { audit } from './audit.ts'
import { fmt } from './fmt.ts'
import { runGate } from './gate.ts'
import { gc } from './gc.ts'
import { markUnit } from './mark.ts'
import { report } from './report.ts'
import { selectNext } from './select.ts'

const [cmd, ...args] = process.argv.slice(2)

async function main() {
  let gateResult: Awaited<ReturnType<typeof runGate>> | undefined

  switch (cmd) {
    case 'select': {
      const sel = await selectNext()
      console.log(sel ? JSON.stringify(sel, null, 2) : 'null')
      break
    }
    case 'mark': {
      const [id, state] = args
      if (!id || !state) {
        console.error('usage: devops mark <id> <pending|in_progress|done|blocked>')
        process.exit(1)
      }
      await markUnit(id, state as 'pending' | 'in_progress' | 'done' | 'blocked')
      console.log(`marked ${id} -> ${state}`)
      break
    }
    case 'gate': {
      const strict = args.includes('--strict')
      gateResult = await runGate(strict)
      console.log(JSON.stringify(gateResult, null, 2))
      break
    }
    case 'fmt': {
      fmt()
      break
    }
    case 'audit': {
      const [id, ...rest] = args
      if (!id) {
        console.error('usage: devops audit <id> "<gate summary / notes>"')
        process.exit(1)
      }
      await audit(id, rest.join(' '))
      break
    }
    case 'gc': {
      gc(args.includes('--force'))
      break
    }
    case 'report': {
      console.log(await report())
      break
    }
    default: {
      console.error('usage: bun run devops <select|mark|gate|fmt|audit|gc|report>')
      process.exit(1)
    }
  }

  if (gateResult) {
    process.exit(gateResult.pass ? 0 : 1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
