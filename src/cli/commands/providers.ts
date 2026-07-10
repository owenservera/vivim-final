// src/cli/commands/providers.ts
// CLI command: cap-store providers list/show

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerProvidersCommands(registry: CommandRegistry, opts: BridgeOptions): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'providers',
    description: 'List or show providers',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: ['providers list', 'providers show anthropic'],
    handler: async (raw: unknown) => {
      const args = raw as { args: string[]; flags: Record<string, string> }
      const sub = args.args[0]
      if (sub === 'show') {
        const slug = args.args[1]
        if (!slug) throw new Error('Usage: providers show <slug>')
        const data = await bridge.get<unknown>(`/providers/${slug}`)
        return { data }
      }
      const params = new URLSearchParams()
      if (args.flags.active) params.set('active', '1')
      const qs = params.toString() ? `?${params.toString()}` : ''
      const data = await bridge.get<unknown>(`/providers${qs}`)
      return { data }
    },
  })
}
