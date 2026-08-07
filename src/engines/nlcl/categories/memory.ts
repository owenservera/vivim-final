// src/engines/nlcl/categories/memory.ts
// memory command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const memoryPatterns: CommandPattern[] = [
  pattern('memory.recall', 'memory.recall', 'Recall something you know', {
    patterns: [
      {
        regex:
          /(?:remember|recall|what\s+(?:do\s+you\s+know|is)\s+(?:about\s+)?(.+)|what\s+(?:is|was)\s+(?:the\s+)?(.+?)\s+you\s+told\s+me)/,
        priority: 12,
        keywords: ['recall', 'remember', 'what do you know'],
        extract: (m) => ({ topic: (m[1] ?? m[2] ?? '').trim() }),
      },
    ],
    aliases: ['recall', 'remember', 'remind me'],
    examples: ['recall the secret key', 'remember what we discussed about quantum computing'],
    inputSchema: z.object({ topic: z.string().optional() }),
    executor: 'memory',
    category: 'memory',
    classification: 'read',
    execute: async () => ({}),
  }),

  pattern('memory.store', 'memory.store', 'Store something for later', {
    patterns: [
      {
        regex:
          /(?:remember|store|save)\s+(?:this\s+)?(?:key|secret|password|api\s+key)\s+(?:is\s+)?(.+)$/,
        priority: 11,
        keywords: ['remember', 'store', 'save'],
        extract: (m) => ({ key: 'secret', value: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['store', 'save', 'remember'],
    examples: ['remember my api key is abc123', 'store this password: hunter2'],
    inputSchema: z.object({
      key: z.string().optional(),
      value: z.string().optional(),
    }),
    executor: 'memory',
    category: 'memory',
    classification: 'write',
    execute: async () => ({}),
  }),
]
