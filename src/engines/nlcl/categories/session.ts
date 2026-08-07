// src/engines/nlcl/categories/session.ts
// session command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const sessionPatterns: CommandPattern[] = [
  pattern('session.load', 'session.load', 'Load an interactive session', {
    patterns: [
      {
        regex:
          /(?:load|start|open)\s+(?:my\s+)?(chatgpt|claude|gemini|gpt|ai)\s+(?:session|chat|conversation)/i,
        priority: 14,
        keywords: ['load session', 'start chat'],
        extract: (m) => ({
          providerId: (m[1] ?? '').toLowerCase() === 'gpt' ? 'chatgpt' : (m[1] ?? '').toLowerCase(),
        }),
      },
    ],
    aliases: ['load session', 'start chat', 'open ai'],
    examples: ['load my chatgpt session', 'start claude chat', 'open ai conversation'],
    inputSchema: z.object({
      providerId: z.string(),
      accountId: z.string().optional(),
    }),
    executor: 'capability',
    category: 'session',
    classification: 'system',
    capabilityId: 'cap:session:load',
    execute: async () => ({}),
  }),

  pattern('session.start', 'session.start', 'Start a new session', {
    patterns: [
      {
        regex: /(?:start|begin)\s+(?:a\s+)?new\s+(?:session|chat)/i,
        priority: 13,
        keywords: ['start session', 'new chat'],
        extract: () => ({}),
      },
    ],
    aliases: ['start session', 'new chat'],
    examples: ['start a new session', 'begin session on claude'],
    inputSchema: z.object({
      providerId: z.string().optional(),
      accountId: z.string().optional(),
    }),
    executor: 'capability',
    category: 'session',
    classification: 'system',
    capabilityId: 'cap:session:start',
    execute: async () => ({}),
  }),

  pattern('session.list', 'session.list', 'List active sessions', {
    patterns: [
      {
        regex: /(?:list|show)\s+(?:my\s+)?(?:sessions|chats)/i,
        priority: 12,
        keywords: ['list sessions', 'show chats'],
        extract: () => ({}),
      },
    ],
    aliases: ['list sessions', 'my sessions'],
    examples: ['list sessions', 'show my chats'],
    inputSchema: z.object({}),
    executor: 'capability',
    category: 'session',
    classification: 'read',
    capabilityId: 'cap:session:list',
    execute: async () => ({}),
  }),
]
