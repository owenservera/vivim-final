// src/engines/nlcl/categories/ai.ts
// AI Gateway command patterns — natural-language entry points for cap:ai:*.
// These let users say "ask the ai to explain X" or "list ai providers" and
// have it route through the AI Gateway (src/ai/) via the NLCL engine.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const aiPatterns: CommandPattern[] = [
  // cap:ai:execute — "ask the ai to <prompt>"
  pattern('ai.execute', 'ai.execute', 'Execute an AI request through the AI Gateway', {
    patterns: [
      {
        regex: /(?:ask\s+the\s+ai|ai\s+execute|ai:)\s+(?:to\s+)?(.+)$/i,
        priority: 20,
        keywords: ['ai', 'ask', 'execute'],
        extract: (m) => ({
          messages: [{ role: 'user', content: (m[1] ?? '').trim() }],
        }),
      },
      {
        regex: /ai\s+(.+)$/i,
        priority: 5,
        keywords: ['ai'],
        extract: (m) => ({
          messages: [{ role: 'user', content: (m[1] ?? '').trim() }],
        }),
      },
    ],
    aliases: ['ai', 'ask ai', 'ai execute'],
    examples: [
      'ask the ai to explain this codebase',
      'ai execute: summarize the latest changes',
      'ai: what providers are available?',
    ],
    inputSchema: z.object({
      messages: z.array(z.object({ role: z.string(), content: z.string() })),
      providerId: z.string().optional(),
      modelId: z.string().optional(),
    }),
    executor: 'capability',
    category: 'ai',
    capabilityId: 'cap:ai:execute',
    execute: async () => ({}),
  }),

  // cap:ai:providers — "list ai providers"
  pattern('ai.providers', 'ai.providers', 'List AI providers registered in the AI Gateway', {
    patterns: [
      {
        regex: /(?:list|show)\s+ai\s+providers?(?:\s+for\s+(.+))?$/i,
        priority: 18,
        keywords: ['ai', 'providers', 'list'],
        extract: (m) => ({
          kind: (m[1] ?? '').trim() || undefined,
        }),
      },
      {
        regex: /ai\s+providers?$/i,
        priority: 17,
        keywords: ['ai', 'providers'],
        extract: () => ({}),
      },
    ],
    aliases: ['ai providers', 'list ai providers'],
    examples: ['list ai providers', 'show ai providers for local', 'ai providers'],
    inputSchema: z.object({ kind: z.string().optional() }),
    executor: 'capability',
    category: 'ai',
    capabilityId: 'cap:ai:providers',
    execute: async () => ({}),
  }),

  // cap:ai:models — "list ai models"
  pattern('ai.models', 'ai.models', 'List AI models registered in the AI Gateway', {
    patterns: [
      {
        regex: /(?:list|show)\s+ai\s+models?(?:\s+for\s+(.+))?$/i,
        priority: 18,
        keywords: ['ai', 'models', 'list'],
        extract: (m) => ({
          providerId: (m[1] ?? '').trim() || undefined,
        }),
      },
      {
        regex: /ai\s+models?$/i,
        priority: 17,
        keywords: ['ai', 'models'],
        extract: () => ({}),
      },
    ],
    aliases: ['ai models', 'list ai models'],
    examples: ['list ai models', 'show ai models for simulator', 'ai models'],
    inputSchema: z.object({ providerId: z.string().optional() }),
    executor: 'capability',
    category: 'ai',
    capabilityId: 'cap:ai:models',
    execute: async () => ({}),
  }),
]
