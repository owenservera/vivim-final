// src/engines/streaming-channel-caps.ts
// Phase 27.1 — Streaming Channel Capability Catalog

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type { Channel, ChannelStore } from '../storage/contracts/channel-store.js'
import type { ProviderMuxEngine } from './provider-mux.js'
import type {
  CapabilityContext,
  UnifiedCapability,
  UnifiedCapabilityRegistry,
} from './unified-registry.js'

function makeChannelCap(
  partial: Omit<
    UnifiedCapability,
    'surfaces' | 'isAsync' | 'requiresConfirmation' | 'tags' | 'handler'
  > & { requiresConfirmation?: boolean },
  handler: UnifiedCapability['handler'],
): UnifiedCapability {
  return {
    ...partial,
    surfaces: ['cli', 'ui', 'api', 'mcp'],
    handler,
    isAsync: true,
    requiresConfirmation: partial.requiresConfirmation ?? false,
    tags: ['channel', 'streaming'],
  }
}

export function registerStreamingChannelCaps(
  registry: UnifiedCapabilityRegistry,
  deps: { store: ChannelStore; mux: ProviderMuxEngine },
): void {
  // cap:channel:add
  registry.register(
    makeChannelCap(
      {
        id: 'cap:channel:add',
        slug: 'channel_add',
        name: 'Add Streaming Channel',
        description: 'Register a streaming channel source.',
        category: 'channel',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string' },
            name: { type: 'string' },
          },
          required: ['providerId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'channel add',
          aliases: ['chadd'],
          examples: ['channel add --providerId whatsapp'],
        },
        ui: { component: 'action-button', position: 'composer', order: 10 },
        mcpToolName: 'channel_add',
        apiEndpoint: { method: 'POST', path: '/api/channels' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { providerId, name } = input as { providerId: string; name?: string }

        const existing = await deps.store.findByProvider(providerId)
        if (existing) {
          return { ok: true, channelId: existing.id, alreadyExisted: true }
        }

        const channel: Channel = {
          id: `ch:${providerId}:${newId().slice(0, 8)}`,
          providerId,
          name,
          connected: false,
          createdAt: Date.now(),
        }

        await deps.store.save(channel)
        return { ok: true, channelId: channel.id }
      },
    ),
  )

  // cap:channel:list
  registry.register(
    makeChannelCap(
      {
        id: 'cap:channel:list',
        slug: 'channel_list',
        name: 'List Streaming Channels',
        description: 'List all streaming channels.',
        category: 'channel',
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
        cliCommand: { name: 'channel list', aliases: ['chlist'], examples: ['channel list'] },
        ui: { component: 'action-button', position: 'composer', order: 11 },
        mcpToolName: 'channel_list',
        apiEndpoint: { method: 'GET', path: '/api/channels' },
      },
      async () => {
        const channels = await deps.store.list()
        return { ok: true, channels }
      },
    ),
  )

  // cap:channel:connect
  registry.register(
    makeChannelCap(
      {
        id: 'cap:channel:connect',
        slug: 'channel_connect',
        name: 'Connect Streaming Channel',
        description: 'Connect a streaming channel (run auth flow).',
        category: 'channel',
        inputSchema: {
          type: 'object',
          properties: {
            channelId: { type: 'string' },
          },
          required: ['channelId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'channel connect',
          aliases: ['chcon'],
          examples: ['channel connect --channelId ch:whatsapp:abc'],
        },
        ui: { component: 'action-button', position: 'composer', order: 12 },
        mcpToolName: 'channel_connect',
        apiEndpoint: { method: 'POST', path: '/api/channels/connect' },
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { channelId } = input as { channelId: string }

        // TODO: Integrate with auth flow 27.5
        const channel = await deps.store.findById(channelId)
        if (!channel) {
          throw new EngineError(`Channel ${channelId} not found`)
        }

        await deps.store.setConnected(channelId, true)
        return { ok: true, connected: true }
      },
    ),
  )

  // cap:channel:remove (destructive)
  registry.register(
    makeChannelCap(
      {
        id: 'cap:channel:remove',
        slug: 'channel_remove',
        name: 'Remove Streaming Channel',
        description: 'Remove a streaming channel.',
        category: 'channel',
        inputSchema: {
          type: 'object',
          properties: {
            channelId: { type: 'string' },
          },
          required: ['channelId'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'channel remove',
          aliases: ['chrm'],
          examples: ['channel remove --channelId ch:whatsapp:abc'],
        },
        ui: { component: 'action-button', position: 'composer', order: 13 },
        mcpToolName: 'channel_remove',
        apiEndpoint: { method: 'DELETE', path: '/api/channels/{channelId}' },
        requiresConfirmation: true,
      },
      async (input: Record<string, unknown>, _ctx: CapabilityContext) => {
        const { channelId } = input as { channelId: string }
        await deps.store.delete(channelId)
        return { ok: true }
      },
    ),
  )
}
