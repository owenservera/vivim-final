// src/engines/nlcl/categories/opencode.ts
// opencode command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const opencodePatterns: CommandPattern[] = [
  pattern('opencode.send', 'opencode.send', 'Send a prompt to OpenCode serve', {
    patterns: [
      {
        regex: /(?:ask|talk\s+to|send\s+to)\s+opencode\s+(?:to\s+|about\s+|that\s+)?(.+)$/i,
        priority: 16,
        keywords: ['opencode', 'ask', 'send'],
        extract: (m) => ({
          prompt: (m[1] ?? '').trim(),
        }),
      },
      {
        regex: /opencode\s*:\s*(.+)$/i,
        priority: 15,
        keywords: ['opencode'],
        extract: (m) => ({
          prompt: (m[1] ?? '').trim(),
        }),
      },
      {
        regex: /(?:send|give|run)\s+(?:a\s+)?(?:prompt\s+)?(?:to\s+)?opencode\s+(.+)$/i,
        priority: 14,
        keywords: ['opencode', 'send', 'run'],
        extract: (m) => ({
          prompt: (m[1] ?? '').trim(),
        }),
      },
    ],
    aliases: ['opencode', 'ask opencode', 'send to opencode'],
    examples: [
      'ask opencode to refactor the auth module',
      'send to opencode: explain this codebase',
      'opencode: write unit tests for the parser',
    ],
    inputSchema: z.object({
      prompt: z.string(),
      sessionId: z.string().optional(),
      model: z.string().optional(),
    }),
    executor: 'opencode',
    category: 'agent',
    classification: 'communication',
    aiFallback: true,
    capabilityId: 'cap:opencode:send',
    execute: async () => ({}),
  }),

  pattern('opencode.session.create', 'opencode.session.create', 'Create an OpenCode session', {
    patterns: [
      {
        regex: /opencode\s+(?:session\s+)?create(?:\s+session)?$/i,
        priority: 12,
        keywords: ['opencode', 'create', 'session'],
        extract: () => ({}),
      },
    ],
    aliases: ['opencode create', 'opencode session create'],
    examples: ['opencode session create', 'opencode create session'],
    inputSchema: z.object({
      model: z.string().optional(),
      cwd: z.string().optional(),
    }),
    executor: 'opencode',
    category: 'agent',
    classification: 'system',
    capabilityId: 'cap:opencode:session.create',
    execute: async () => ({}),
  }),

  pattern('opencode.session.list', 'opencode.session.list', 'List OpenCode sessions', {
    patterns: [
      {
        regex: /opencode\s+(?:session\s+)?(?:list|ls|show)$/i,
        priority: 12,
        keywords: ['opencode', 'list', 'session'],
        extract: () => ({}),
      },
    ],
    aliases: ['opencode list', 'opencode sessions'],
    examples: ['opencode session list', 'opencode sessions'],
    inputSchema: z.object({}),
    executor: 'opencode',
    category: 'agent',
    classification: 'read',
    capabilityId: 'cap:opencode:session.list',
    execute: async () => ({}),
  }),
]
