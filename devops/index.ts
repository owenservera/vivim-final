// devops/index.ts
// CLI entry point for DevOps tools: `bun run devops <cmd> [args]`
// Modularized SOTA plugin architecture.

import { join } from 'node:path'
import { routeCommand } from './router/index.ts'

const [cmd, ...args] = process.argv.slice(2)

// Allow satellite trackers via `--tracker <path>` and optional `--atomic-dir <path>`.
const tkIdx = process.argv.indexOf('--tracker')
if (tkIdx >= 0 && tkIdx + 1 < process.argv.length) {
  process.env.DEVOPS_TRACKER = process.argv[tkIdx + 1]!
  const adIdx = process.argv.indexOf('--atomic-dir')
  process.env.DEVOPS_ATOMIC_DIR =
    adIdx >= 0 && adIdx + 1 < process.argv.length
      ? process.argv[adIdx + 1]!
      : join(process.env.DEVOPS_TRACKER, '..')
}

if (!cmd) {
  // [audit] removed: console.log('DevOps Engine CLI')
  // [audit] removed: console.log('Usage: bun run devops <command> [options]')
  // [audit] removed: console.log('\nCore Commands:')
  // [audit] removed: console.log('  gate | select | mark | run | report | gc | fmt | toolkit | profiles')
  // [audit] removed: console.log('  audit-code | audit-arch | invariants | deep-scan | sota')
  // [audit] removed: console.log('  truth | goals | decision | features | roadmap | research')
  // [audit] removed: console.log('  desktop-loop | desktop | onboard | discover-protocol | protocol-promote')
  process.exit(0)
}

routeCommand(cmd, args).catch((err) => {
  // [audit] removed: console.error('Fatal CLI Error:', err)
  process.exit(1)
})
