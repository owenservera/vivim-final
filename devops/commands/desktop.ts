// devops/commands/desktop.ts
// Command handler for devops desktop & desktop-loop tooling.

import { runDesktopLoop } from '../desktop/index.ts'
import { dispatchAction } from '../desktop/cli.ts'

export async function handle(args: string[]): Promise<void> {
  const [cmd, ...rest] = args

  if (cmd === 'desktop-loop') {
    const action = rest[0]
    if (action === 'run') {
      const vIdx = rest.indexOf('--version')
      const version = vIdx >= 0 ? rest[vIdx + 1] : undefined
      if (!version) {
        // [audit] removed: console.error('usage: devops desktop-loop run --version <x.y.z>')
        process.exit(1)
      }
      const exitCode = await runDesktopLoop(version)
      process.exit(exitCode)
    } else {
      const exitCode = await dispatchAction(rest)
      process.exit(exitCode)
    }
  } else if (cmd === 'desktop') {
    const exitCode = await dispatchAction(rest)
    process.exit(exitCode)
  }
}
