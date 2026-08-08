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

  pattern('opencode.models', 'opencode.models', 'List available OpenCode models', {
    patterns: [
      {
        regex: /opencode\s+(?:models?|model\s+list|available\s+models?)$/i,
        priority: 12,
        keywords: ['opencode', 'model'],
        extract: () => ({}),
      },
      {
        regex: /(?:what|which)\s+models?\s+(?:does\s+)?opencode\s+(?:have|offer|support)\??$/i,
        priority: 11,
        keywords: ['opencode', 'model'],
        extract: () => ({}),
      },
    ],
    aliases: ['opencode models', 'opencode model list', 'list opencode models'],
    examples: ['opencode models', 'what models does opencode offer'],
    inputSchema: z.object({}),
    executor: 'opencode',
    category: 'agent',
    classification: 'read',
    capabilityId: 'cap:opencode:models',
    execute: async () => ({}),
  }),

  pattern('opencode.model.sync', 'opencode.model.sync', 'Refresh the OpenCode model list', {
    patterns: [
      {
        regex: /opencode\s+(?:model\s+)?(?:sync|refresh|update)(?:\s+models?)?$/i,
        priority: 12,
        keywords: ['opencode', 'sync', 'refresh', 'model'],
        extract: (m) => ({
          refresh: /refresh/.test(m[0]),
        }),
      },
    ],
    aliases: ['sync opencode models', 'refresh opencode models'],
    examples: ['opencode models sync', 'refresh opencode models'],
    inputSchema: z.object({
      refresh: z.boolean().optional(),
    }),
    executor: 'opencode',
    category: 'agent',
    classification: 'system',
    capabilityId: 'cap:opencode:model.sync',
    execute: async () => ({}),
  }),

  pattern('opencode.model.set_default', 'opencode.model.set_default', 'Set the default OpenCode model', {
    patterns: [
      {
        regex: /(?:set|use|switch|make)\s+(?:the\s+)?(?:default\s+)?opencode\s+model\s+(?:to|as|:)\s+(.+)$/i,
        priority: 12,
        keywords: ['opencode', 'default', 'model'],
        extract: (m) => ({
          model: (m[1] ?? '').trim(),
        }),
      },
      {
        regex: /opencode\s+(?:model\s+)?set-default\s+(.+)$/i,
        priority: 12,
        keywords: ['opencode', 'set-default', 'model'],
        extract: (m) => ({
          model: (m[1] ?? '').trim(),
        }),
      },
    ],
    aliases: ['opencode model set-default', 'set default opencode model'],
    examples: [
      'set default opencode model to opencode/deepseek-v4-flash-free',
      'opencode model set-default opencode/mimo-v2.5-free',
    ],
    inputSchema: z.object({
      model: z.string(),
    }),
    executor: 'opencode',
    category: 'agent',
    classification: 'system',
    capabilityId: 'cap:opencode:model.set_default',
    execute: async () => ({}),
  }),
]
