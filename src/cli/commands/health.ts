// src/cli/commands/health.ts
// CLI command: cap-store telemetry health

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerHealthCommands(registry: CommandRegistry, opts: BridgeOptions): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'health',
    description: 'Show provider health',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: ['health provider-123', 'health provider-123 --days 7'],
    handler: async (raw: unknown) => {
      const args = raw as { args: string[]; flags: Record<string, string> }
      const providerId = args.args[0]
      if (!providerId) throw new Error('Usage: health <providerId>')
      const params = new URLSearchParams()
      if (args.flags.days) params.set('days', args.flags.days)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const data = await bridge.get<unknown>(`/telemetry/${providerId}/health${qs}`)
      return { data }
    },
  })
}
