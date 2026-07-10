// src/cli/commands/admin.ts
// CLI command: cap-store admin seed/audit/drift

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerAdminCommands(registry: CommandRegistry, opts: BridgeOptions): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'admin',
    description: 'Admin operations: seed, audit, drift',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: ['admin seed', 'admin audit provider-123', 'admin drift'],
    handler: async (raw: unknown) => {
      const args = raw as { args: string[]; flags: Record<string, string> }
      const sub = args.args[0]
      if (sub === 'seed') {
        const source = args.flags.source
        const data = await bridge.post<unknown>('/admin/seed', { source })
        return { data }
      }
      if (sub === 'audit') {
        const providerId = args.args[1]
        if (!providerId) throw new Error('Usage: admin audit <providerId>')
        const limit = args.flags.limit ? Number.parseInt(args.flags.limit, 10) : undefined
        const params = limit ? `?limit=${limit}` : ''
        const data = await bridge.get<unknown>(`/admin/audit/${providerId}${params}`)
        return { data }
      }
      if (sub === 'drift') {
        const params = new URLSearchParams()
        if (args.flags.provider) params.set('providerId', args.flags.provider)
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await bridge.get<unknown>(`/admin/drift${qs}`)
        return { data }
      }
      throw new Error('Usage: admin seed|audit|drift')
    },
  })
}
