// devops/commands/onboard.ts
// Command handler for web provider discovery, CDP testing, and protocol promotion.

import {
  discoverCdpProtocol,
  discoverProtocol,
  preflight,
  providerStatus,
} from '../runtime-test/index.ts'
import { runOnboardController } from '../onboard-controller.ts'
import { listDevDeltas, promoteProvider } from '../protocol-promote.ts'

export async function handle(args: string[]): Promise<void> {
  const [cmd, ...rest] = args

  if (cmd === 'onboard') {
    const slugArg = rest.find((a) => a.startsWith('--provider='))?.split('=')[1] ?? rest[0]
    if (!slugArg) {
      // [audit] removed: console.error('usage: devops onboard <providerSlug> [--account=<email>] [--json]')
      process.exit(1)
    }
    const exitCode = await runOnboardController(rest)
    process.exit(exitCode)
  }

  if (cmd === 'discover-cdp' || cmd === 'discover-protocol') {
    const url = rest[0]
    if (!url) {
      // [audit] removed: console.error('usage: devops discover-protocol <url> [--hint=<name>]')
      process.exit(1)
    }
    const result = await discoverCdpProtocol(url, rest)
    // [audit] removed: console.log(JSON.stringify(result, null, 2))
    return
  }

  if (cmd === 'protocol-promote') {
    const provider = rest.find((a) => a.startsWith('--provider='))?.split('=')[1]
    if (rest.includes('--diff')) {
      const deltas = await listDevDeltas()
      // [audit] removed: console.log(JSON.stringify(deltas, null, 2))
    } else if (provider) {
      const res = await promoteProvider(provider)
      // [audit] removed: console.log(`Promoted ${provider}: ${res ? 'success' : 'failed'}`)
    } else {
      // [audit] removed: console.error('usage: devops protocol-promote [--diff] [--provider=<slug>]')
      process.exit(1)
    }
  }
}
