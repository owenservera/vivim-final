// src/engines/nlcl/categories/channel.ts
// channel command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const channelPatterns: CommandPattern[] = [
  pattern('channel.add', 'channel.add', 'Add a streaming channel', {
    patterns: [
      {
        regex:
          /(?:add|connect)\s+(?:my\s+|a\s+)?(whatsapp|facebook|telegram|slack|dispatch)\s+(?:feed|channel|messaging)/i,
        priority: 16,
        keywords: ['add channel', 'connect channel', 'stream channel'],
        extract: (m) => ({ providerId: (m[1] ?? '').toLowerCase() }),
      },
    ],
    aliases: ['add channel', 'add feed'],
    examples: ['add my whatsapp channel', 'connect my facebook messaging feed'],
    inputSchema: z.object({
      providerId: z.string(),
      name: z.string().optional(),
    }),
    executor: 'capability',
    category: 'channel',
    classification: 'system',
    capabilityId: 'cap:channel:add',
    execute: async () => ({}),
  }),

  pattern('channel.connect', 'channel.connect', 'Connect a streaming channel', {
    patterns: [
      {
        regex: /connect\s+(?:my\s+)?(.+)$/,
        priority: 15,
        keywords: ['connect channel'],
        extract: (m) => ({ channelId: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['connect channel'],
    examples: ['connect my whatsapp', 'connect channel ch:whatsapp:abc'],
    inputSchema: z.object({
      channelId: z.string(),
    }),
    executor: 'capability',
    category: 'channel',
    classification: 'system',
    capabilityId: 'cap:channel:connect',
    execute: async () => ({}),
  }),

  pattern('channel.list', 'channel.list', 'List streaming channels', {
    patterns: [
      {
        regex: /(?:list|show|my)\s+(?:my\s+)?(?:channels|feeds|messaging)/,
        priority: 14,
        keywords: ['list channels', 'show feeds'],
        extract: () => ({}),
      },
    ],
    aliases: ['list channels', 'show feeds'],
    examples: ['list my channels', 'show messaging feeds'],
    inputSchema: z.object({}),
    executor: 'capability',
    category: 'channel',
    classification: 'read',
    capabilityId: 'cap:channel:list',
    execute: async () => ({}),
  }),

  pattern('channel.remove', 'channel.remove', 'Remove a streaming channel', {
    patterns: [
      {
        regex: /(?:remove|delete|disconnect)\s+(?:my\s+)?(.+?)\s+(?:channel|feed)/,
        priority: 13,
        keywords: ['remove channel', 'delete feed'],
        extract: (m) => ({ channelId: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['remove channel', 'delete feed'],
    examples: ['remove my whatsapp channel', 'delete channel ch:telegram:abc'],
    inputSchema: z.object({
      channelId: z.string(),
    }),
    executor: 'capability',
    category: 'channel',
    classification: 'destructive',
    requiresConfirmation: true,
    capabilityId: 'cap:channel:remove',
    execute: async () => ({}),
  }),
]
