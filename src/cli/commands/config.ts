// src/cli/commands/config.ts
// CLI command: cap-store config get/set/history

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerConfigCommands(registry: CommandRegistry, opts: BridgeOptions): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'config',
    description: 'Get, set, or view config history',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: [
      'config get my-engine',
      'config set my-engine \'{"key":"val"}\'',
      'config history my-engine',
    ],
    handler: async (raw: unknown) => {
      const args = raw as { args: string[]; flags: Record<string, string> }
      const sub = args.args[0]
      if (sub === 'get') {
        const engineId = args.args[1]
        if (!engineId) throw new Error('Usage: config get <engineId>')
        const data = await bridge.get<unknown>(`/config/${engineId}`)
        return { data }
      }
      if (sub === 'set') {
        const engineId = args.args[1]
        const json = args.args[2]
        if (!engineId || !json) throw new Error('Usage: config set <engineId> <json>')
        const config = JSON.parse(json) as Record<string, unknown>
        const data = await bridge.put<unknown>(`/config/${engineId}`, { config })
        return { data }
      }
      if (sub === 'history') {
        const engineId = args.args[1]
        if (!engineId) throw new Error('Usage: config history <engineId>')
        const data = await bridge.get<unknown>(`/config/${engineId}/history`)
        return { data }
      }
      throw new Error('Usage: config get|set|history')
    },
  })
}
