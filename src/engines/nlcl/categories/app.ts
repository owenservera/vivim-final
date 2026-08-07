// src/engines/nlcl/categories/app.ts
// app command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const appPatterns: CommandPattern[] = [
  pattern('app.launch', 'app.launch', 'Launch a native application', {
    patterns: [
      {
        regex:
          /(?:open|launch|start|run)\s+(notepad|calculator|calc|terminal|cmd|powershell|explorer|paint|word|excel|chrome|edge|settings|textedit|safari|finder|notes|mail|calendar|files|file|firefox|screenshot|snipping|snip)/,
        priority: 13,
        keywords: ['open', 'launch', 'start app'],
        extract: (m) => ({ app: (m[1] ?? '').toLowerCase().trim() }),
      },
    ],
    aliases: ['open app', 'launch app'],
    examples: ['open notepad', 'launch calculator', 'start terminal'],
    inputSchema: z.object({ app: z.string(), name: z.string().optional() }),
    executor: 'app',
    category: 'app',
    classification: 'system',
    execute: async () => ({}),
  }),
]
