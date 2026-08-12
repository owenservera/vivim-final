// devops/router/index.ts
// Plugin-based, lazy-loading CLI command router for devops tools.

export type CommandHandler = (args: string[]) => Promise<void>

const COMMAND_MAP: Record<string, () => Promise<{ handle: CommandHandler }>> = {
  select: () => import('../commands/gate.ts'),
  mark: () => import('../commands/gate.ts'),
  gate: () => import('../commands/gate.ts'),
  run: () => import('../commands/gate.ts'),
  audit: () => import('../commands/gate.ts'),
  gc: () => import('../commands/gate.ts'),
  report: () => import('../commands/gate.ts'),
  fmt: () => import('../commands/gate.ts'),
  toolkit: () => import('../commands/gate.ts'),
  profiles: () => import('../commands/gate.ts'),

  'audit-code': () => import('../commands/audit.ts'),
  'audit-arch': () => import('../commands/audit.ts'),
  invariants: () => import('../commands/audit.ts'),
  'deep-scan': () => import('../commands/audit.ts'),
  sota: () => import('../commands/audit.ts'),

  truth: () => import('../commands/truth.ts'),

  goals: () => import('../commands/strategy.ts'),
  decision: () => import('../commands/strategy.ts'),
  features: () => import('../commands/strategy.ts'),
  roadmap: () => import('../commands/strategy.ts'),
  research: () => import('../commands/strategy.ts'),

  'desktop-loop': () => import('../commands/desktop.ts'),
  desktop: () => import('../commands/desktop.ts'),

  onboard: () => import('../commands/onboard.ts'),
  'discover-cdp': () => import('../commands/onboard.ts'),
  'discover-protocol': () => import('../commands/onboard.ts'),
  'protocol-promote': () => import('../commands/onboard.ts'),
}

export async function routeCommand(cmd: string, args: string[]): Promise<void> {
  const loader = COMMAND_MAP[cmd]
  if (!loader) {
    // [audit] removed: console.error(`Unknown devops command: ${cmd}`)
    // [audit] removed: console.error(`Available commands: ${Object.keys(COMMAND_MAP).join(', ')}`)
    process.exit(1)
  }

  const module = await loader()
  await module.handle([cmd, ...args])
}
