// devops/commands/truth.ts
// Command handler for devops truth specification grounding system.

import { runTruthCommand } from '../truth/cli.ts'

export async function handle(args: string[]): Promise<void> {
  const [_cmd, ...rest] = args
  await runTruthCommand(rest)
}
