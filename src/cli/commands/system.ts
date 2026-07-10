// src/cli/commands/system.ts
// CLI command: cap-store serve

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerSystemCommands(registry: CommandRegistry, opts: BridgeOptions): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'system',
    description: 'System commands: serve',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: ['system serve'],
    handler: async (raw: unknown) => {
      const args = raw as { args: string[]; flags: Record<string, string> }
      const sub = args.args[0]
      if (sub === 'serve') {
        const port = args.flags.port ?? '3000'
        const data = await bridge.post<unknown>('/system/serve', {
          port: Number.parseInt(port, 10),
        })
        return { data }
      }
      throw new Error('Usage: system serve')
    },
  })
}
