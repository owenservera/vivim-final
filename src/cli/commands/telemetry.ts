// src/cli/commands/telemetry.ts
// CLI command: cap-store telemetry summary/compare

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerTelemetryCommands(registry: CommandRegistry, opts: BridgeOptions): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'telemetry',
    description: 'Telemetry summary and compare',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: ['telemetry summary provider-123 --from 2024-01-01 --to 2024-01-31'],
    handler: async (raw: unknown) => {
      const args = raw as { args: string[]; flags: Record<string, string> }
      const sub = args.args[0]
      if (sub === 'summary') {
        const providerId = args.args[1]
        const from = args.flags.from
        const to = args.flags.to
        if (!providerId || !from || !to)
          throw new Error('Usage: telemetry summary <providerId> --from <date> --to <date>')
        const params = new URLSearchParams({ from, to })
        const data = await bridge.get<unknown>(
          `/telemetry/${providerId}/summary?${params.toString()}`,
        )
        return { data }
      }
      if (sub === 'compare') {
        const from = args.flags.from
        const to = args.flags.to
        if (!from || !to) throw new Error('Usage: telemetry compare --from <date> --to <date>')
        const params = new URLSearchParams({ from, to })
        const data = await bridge.get<unknown>(`/telemetry/compare?${params.toString()}`)
        return { data }
      }
      throw new Error('Usage: telemetry summary|compare')
    },
  })
}
