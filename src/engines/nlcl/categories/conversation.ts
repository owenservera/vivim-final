// src/engines/nlcl/categories/conversation.ts
// conversation command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const conversationPatterns: CommandPattern[] = [
  pattern('conversation.create', 'conversation.create', 'Create a new conversation', {
    patterns: [
      {
        regex:
          /(?:new|create|start)\s+(?:a\s+)?(?:conversation|chat|session)(?:\s+(?:with|on)\s+(chatgpt|claude|gemini))?/,
        priority: 12,
        keywords: ['new conversation', 'create chat', 'start session'],
        extract: (m) => ({
          providerId: (m[1] ?? undefined)?.toLowerCase(),
        }),
      },
    ],
    aliases: ['new chat', 'new conversation', 'create conversation'],
    examples: ['new conversation', 'create a chat with claude', 'start a session on gemini'],
    inputSchema: z.object({
      providerId: z.string().optional(),
      title: z.string().optional(),
    }),
    executor: 'conversation',
    category: 'conversation',
    classification: 'system',
    capabilityId: 'cap:conversation:create',
    execute: async () => ({}),
  }),

  pattern('conversation.list', 'conversation.list', 'List conversations', {
    patterns: [
      {
        regex: /(?:list|show|my)\s+(?:my\s+)?(?:conversations|chats|sessions)/,
        priority: 11,
        keywords: ['list conversations', 'show chats'],
        extract: () => ({}),
      },
    ],
    aliases: ['list chats', 'show conversations', 'my conversations'],
    examples: ['list my conversations', 'show chats'],
    inputSchema: z.object({ limit: z.number().optional() }),
    executor: 'conversation',
    category: 'conversation',
    classification: 'read',
    capabilityId: 'cap:conversation:list',
    execute: async () => ({}),
  }),

  pattern('conversation.switch', 'conversation.switch', 'Switch to a different provider', {
    patterns: [
      {
        regex: /(?:switch\s+to|use|change\s+to)\s+(chatgpt|claude|gemini|gpt)/,
        priority: 14,
        keywords: ['switch to', 'use provider'],
        extract: (m) => {
          const p = (m[1] ?? '').toLowerCase()
          return { providerId: p === 'gpt' ? 'chatgpt' : p }
        },
      },
    ],
    aliases: ['switch to', 'use provider'],
    examples: ['switch to claude', 'use gemini', 'change to chatgpt'],
    inputSchema: z.object({ providerId: z.string() }),
    executor: 'conversation',
    category: 'conversation',
    classification: 'navigate',
    capabilityId: 'cap:conversation:switch',
    execute: async () => ({}),
  }),
]
