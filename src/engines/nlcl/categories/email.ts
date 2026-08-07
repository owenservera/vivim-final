// src/engines/nlcl/categories/email.ts
// email command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const emailPatterns: CommandPattern[] = [
  pattern('email.send', 'email.send', 'Send an email', {
    patterns: [
      {
        regex:
          /(?:send|write|compose)\s+(?:an\s+)?email\s+(?:to\s+)?([\w.+-]+@[\w-]+\.[\w.-]+|[\w\s]+)(?:\s+(?:about|re|subject)\s+(.+?))?(?:\s+saying\s+(.+))?$/,
        priority: 15,
        keywords: ['send email', 'write email', 'compose email'],
        extract: (m) => ({
          to: (m[1] ?? '').trim(),
          subject: (m[2] ?? '').trim() || undefined,
          body: (m[3] ?? '').trim() || undefined,
        }),
      },
      {
        regex: /email\s+([\w.+-]+@[\w-]+\.[\w.-]+)\s+(?:about\s+)?(.+)/,
        priority: 14,
        extract: (m) => ({
          to: (m[1] ?? '').trim(),
          subject: (m[2] ?? '').trim(),
        }),
      },
    ],
    aliases: ['send email', 'email', 'compose email'],
    examples: [
      'send email to john@example.com about the meeting',
      'email boss@example.com saying I will be late',
    ],
    inputSchema: z.object({
      to: z.string(),
      subject: z.string().optional(),
      body: z.string().optional(),
    }),
    executor: 'email',
    category: 'email',
    classification: 'communication',
    requiresConfirmation: true,
    execute: async () => ({}),
  }),
]
