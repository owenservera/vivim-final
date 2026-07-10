// src/cli/commands/version.ts
// CLI command: cap-store version

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerVersionCommands(registry: CommandRegistry, opts: BridgeOptions): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'version',
    description: 'Show version',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: ['version'],
    handler: async () => {
      const data = await bridge.get<unknown>('/version')
      return { data }
    },
  })
}
