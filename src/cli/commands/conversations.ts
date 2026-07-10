// src/cli/commands/conversations.ts
// CLI command: cap-store conversations list/create/send

import { z } from 'zod'
import { type BridgeOptions, CapStoreBridge } from '../bridges/cap-store-bridge.js'
import type { CommandRegistry } from '../command-registry.js'

export function registerConversationsCommands(
  registry: CommandRegistry,
  opts: BridgeOptions,
): void {
  const bridge = new CapStoreBridge(opts)

  registry.register({
    name: 'conversations',
    description: 'List, create, or send messages',
    subsystem: 'cap-store',
    schema: z.any(),
    examples: [
      'conversations list',
      'conversations create provider-123',
      'conversations send conv-456 --message "hello"',
    ],
    handler: async (raw: unknown) => {
      const args = raw as { args: string[]; flags: Record<string, string> }
      const sub = args.args[0]
      if (sub === 'create') {
        const providerId = args.args[1]
        if (!providerId) throw new Error('Usage: conversations create <providerId>')
        const title = args.flags.title
        const data = await bridge.post<unknown>('/conversations', { providerId, title })
        return { data }
      }
      if (sub === 'send') {
        const id = args.args[1]
        const message = args.flags.message
        if (!id) throw new Error('Usage: conversations send <id> --message "<text>"')
        if (!message) throw new Error('--message is required')
        const data = await bridge.post<unknown>(`/conversations/${id}/messages`, { message })
        return { data }
      }
      const params = new URLSearchParams()
      if (args.flags.provider) params.set('providerId', args.flags.provider)
      if (args.flags.limit) params.set('limit', args.flags.limit)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const data = await bridge.get<unknown>(`/conversations${qs}`)
      return { data }
    },
  })
}
