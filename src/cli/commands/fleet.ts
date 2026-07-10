// src/cli/commands/fleet.ts
// CLI command: cap-store fleet status/start/stop

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerFleetCommands(registry: CommandRegistry, opts: BridgeOptions): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'fleet',
    description: 'Fleet status/start/stop',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: ['fleet status', 'fleet start provider-123 account-456'],
    handler: async (raw: unknown) => {
      const args = raw as { args: string[]; flags: Record<string, string> }
      const sub = args.args[0]
      if (sub === 'start') {
        const providerId = args.args[1]
        const accountId = args.args[2]
        if (!providerId || !accountId)
          throw new Error('Usage: fleet start <providerId> <accountId>')
        const data = await bridge.post<unknown>('/fleet/start', { providerId, accountId })
        return { data }
      }
      if (sub === 'stop') {
        const providerId = args.args[1]
        const accountId = args.args[2]
        if (!providerId || !accountId) throw new Error('Usage: fleet stop <providerId> <accountId>')
        const data = await bridge.post<unknown>('/fleet/stop', { providerId, accountId })
        return { data }
      }
      const data = await bridge.get<unknown>('/fleet/status')
      return { data }
    },
  })
}
