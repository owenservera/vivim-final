// src/engines/nlcl/categories/workflow.ts
// workflow command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { dayToCron, extractEmails, pattern } from './builder.js'

export const workflowPatterns: CommandPattern[] = [
  pattern('workflow.newsletter', 'workflow.newsletter', 'Create a newsletter workflow', {
    patterns: [
      {
        regex: /(?:create|make)(?: an?)?(?: weekly | daily )?newsletter(?: for (.+))?/i,
        priority: 12,
        keywords: ['newsletter', 'create newsletter'],
        extract: (m) => ({
          recipients: extractEmails(m[1] ?? ''),
          windowDays: 7,
        }),
      },
    ],
    aliases: ['create newsletter'],
    examples: ['create a weekly newsletter for team@x.io'],
    inputSchema: z.object({
      recipients: z.array(z.string()).optional(),
      windowDays: z.number().optional(),
      title: z.string().optional(),
    }),
    executor: 'capability',
    category: 'workflow',
    classification: 'system',
    capabilityId: 'cap:workflow:create_newsletter',
    execute: async () => ({}),
  }),

  pattern('schedule.register', 'schedule.register', 'Register a schedule', {
    patterns: [
      {
        regex:
          /(?:every|each) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|hour|day) (.+)/i,
        priority: 11,
        keywords: ['schedule', 'every day', 'every week'],
        extract: (m) => ({
          cron: dayToCron(m[1] ?? ''),
          action: 'cap:workflow:create_newsletter',
        }),
      },
    ],
    aliases: ['schedule', 'automate'],
    examples: ['every monday send newsletter', 'schedule daily summary'],
    inputSchema: z.object({
      cron: z.string(),
      action: z.string(),
      actionConfig: z.record(z.string(), z.unknown()).optional(),
      name: z.string().optional(),
    }),
    executor: 'capability',
    category: 'schedule',
    classification: 'system',
    capabilityId: 'cap:schedule:register',
    execute: async () => ({}),
  }),
]
