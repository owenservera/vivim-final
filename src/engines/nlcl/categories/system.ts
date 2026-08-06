// src/engines/nlcl/categories/system.ts
// system command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { pattern } from './builder.js'
import { z } from 'zod'
import type { CommandPattern } from '../types.js'

export const systemPatterns: CommandPattern[] = [
  pattern('system.health', 'system.health', 'Check system health', {
    patterns: [
      {
        regex:
          /(?:what'?s?\s+)?(?:the\s+)?(?:system\s+)?health|how\s+(?:is|are)\s+(?:you|the\s+system|things)|status\s+check/,
        priority: 12,
        keywords: ['health', 'status', 'how are you'],
        extract: () => ({}),
      },
    ],
    aliases: ['health', 'status', 'how are you'],
    examples: ["what's the system health", 'how are you', 'status check'],
    inputSchema: z.object({}),
    executor: 'system',
    category: 'system',
    classification: 'system',
    capabilityId: 'cap:system:health',
    execute: async () => ({}),
  }),

  pattern('system.providers', 'system.providers', 'List available providers', {
    patterns: [
      {
        regex: /(?:list|show|what)\s+(?:my\s+)?(?:providers|ai\s+providers|llms)/,
        priority: 12,
        keywords: ['providers', 'list providers'],
        extract: () => ({}),
      },
      {
        regex: /(?:which|what)\s+(?:providers|ai|llms)\s+(?:do\s+i\s+have|are\s+available)/,
        priority: 11,
        extract: () => ({}),
      },
    ],
    aliases: ['list providers', 'providers', 'show providers'],
    examples: ['list my providers', 'which providers do I have', 'show providers'],
    inputSchema: z.object({}),
    executor: 'system',
    category: 'system',
    classification: 'system',
    capabilityId: 'cap:provider:health_get',
    execute: async () => ({}),
  }),

  pattern('system.fleet', 'system.fleet', 'Show Chrome fleet status', {
    patterns: [
      {
        regex:
          /(?:fleet|chrome)\s+(?:status|state|info)|what'?s?\s+(?:the\s+)?fleet\s+(?:status|doing)/,
        priority: 12,
        keywords: ['fleet', 'chrome status'],
        extract: () => ({}),
      },
    ],
    aliases: ['fleet status', 'chrome status'],
    examples: ['fleet status', "what's the fleet doing", 'chrome status'],
    inputSchema: z.object({}),
    executor: 'system',
    category: 'system',
    classification: 'system',
    capabilityId: 'cap:fleet:status',
    execute: async () => ({}),
  }),

  pattern('system.capabilities', 'system.capabilities', 'List available capabilities', {
    patterns: [
      {
        regex:
          /(?:list|show|what)\s+(?:my\s+)?(?:capabilities|commands|actions)|what\s+can\s+(?:you|i)\s+do/,
        priority: 11,
        keywords: ['capabilities', 'commands', 'what can you do'],
        extract: () => ({}),
      },
    ],
    aliases: ['capabilities', 'commands', 'what can you do'],
    examples: ['what can you do', 'list capabilities', 'show commands'],
    inputSchema: z.object({}),
    executor: 'system',
    category: 'system',
    classification: 'system',
    capabilityId: 'cap:system:capabilities',
    execute: async () => ({}),
  }),

  pattern('system.version', 'system.version', 'Show system version', {
    patterns: [
      {
        regex: /(?:what'?s?\s+)?(?:your\s+|the\s+)?version|vivim\s+version/,
        priority: 13,
        keywords: ['version'],
        extract: () => ({}),
      },
    ],
    aliases: ['version', 'vivim version'],
    examples: ['what version', 'vivim version'],
    inputSchema: z.object({}),
    executor: 'system',
    category: 'system',
    classification: 'system',
    capabilityId: 'cap:system:version',
    execute: async () => ({}),
  }),

  pattern('system.workspace', 'system.workspace', 'Show current workspace', {
    patterns: [
      {
        regex:
          /(?:what'?s?\s+)?(?:my|the)\s+workspace|where\s+(?:is|am)\s+(?:my|i|the)\s+(?:workspace|working\s+directory)/,
        priority: 12,
        keywords: ['workspace', 'working directory'],
        extract: () => ({}),
      },
    ],
    aliases: ['workspace', 'where am i'],
    examples: ["what's my workspace", 'where is my working directory'],
    inputSchema: z.object({}),
    executor: 'system',
    category: 'system',
    classification: 'system',
    capabilityId: 'cap:setup:workspace_get',
    execute: async () => ({}),
  }),

  pattern('help', 'system.help', 'Show help and available commands', {
    patterns: [
      {
        regex: /^(help|commands|what\s+can\s+you\s+do|how\s+do\s+i\s+use\s+this)/,
        priority: 20,
        keywords: ['help', 'commands'],
        extract: () => ({}),
      },
    ],
    aliases: ['help', 'commands', '?'],
    examples: ['help', 'commands', 'what can you do'],
    inputSchema: z.object({}),
    executor: 'system',
    category: 'system',
    classification: 'system',
    capabilityId: 'cap:help',
    execute: async () => ({}),
  }),
]
