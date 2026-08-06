// src/engines/nlcl/categories/automation.ts
// automation command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { pattern } from './builder.js'
import { z } from 'zod'
import type { CommandPattern } from '../types.js'

export const automationPatterns: CommandPattern[] = [
  pattern('auto.research', 'auto.research', 'Research a topic and produce a report', {
    patterns: [
      {
        regex: /research\s+(?:a\s+|an\s+)?(.+?)(?:\s+report)?$/,
        priority: 12,
        keywords: ['research', 'report', 'investigate'],
        extract: (m) => ({
          role: 'researcher',
          topic: (m[1] ?? '').trim(),
          queryUrl: (m[1] ?? '').trim(),
        }),
      },
    ],
    aliases: ['study', 'investigate'],
    examples: ['research the economic AI crisis', 'research quantum computing report'],
    executor: 'generic-browser',
    category: 'automation',
    classification: 'read',
    execute: async () => ({}),
  }),
  pattern('auto.extract', 'auto.extract', 'Extract structured data from a URL', {
    patterns: [
      {
        regex: /extract\s+(?:from\s+)?(.+?)(?:\s+data)?$/,
        priority: 12,
        keywords: ['extract', 'scrape', 'pull'],
        extract: (m) => ({ role: 'extractor', url: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['scrape', 'pull'],
    examples: ['extract from https://example.com', 'scrape the table'],
    executor: 'generic-browser',
    category: 'automation',
    classification: 'read',
    execute: async () => ({}),
  }),
  pattern('auto.summarize', 'auto.summarize', 'Summarize / rewrite / translate a page', {
    patterns: [
      {
        regex: /(?:summar|rewrite|translate)\w*\s+(?:the\s+)?(.+?)$/,
        priority: 12,
        keywords: ['summarize', 'tl;dr', 'rewrite', 'translate'],
        extract: (m) => ({ role: 'synthesizer', url: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['tldr', 'rewrite', 'translate'],
    examples: ['summarize https://example.com', 'translate this article'],
    executor: 'generic-browser',
    category: 'automation',
    classification: 'read',
    execute: async () => ({}),
  }),
  pattern('auto.monitor', 'auto.monitor', 'Monitor a URL or selector for changes', {
    patterns: [
      {
        regex: /monitor\s+(?:the\s+)?(.+?)(?:\s+for\s+changes)?$/,
        priority: 12,
        keywords: ['monitor', 'watch', 'track'],
        extract: (m) => ({ role: 'monitor', url: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['watch', 'track'],
    examples: ['monitor https://shop.example.com', 'watch the price'],
    executor: 'generic-browser',
    category: 'automation',
    classification: 'read',
    execute: async () => ({}),
  }),
  pattern('auto.test', 'auto.test', 'Run a UI smoke/regression test (human-gated if destructive)', {
    patterns: [
      {
        regex: /test\s+(?:the\s+)?(.+?)(?:\s+ui)?$/,
        priority: 12,
        keywords: ['test', 'smoke', 'regression'],
        extract: (m) => ({ role: 'tester', url: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['smoke', 'regression'],
    examples: ['test https://app.example.com', 'ui smoke test'],
    executor: 'generic-browser',
    category: 'automation',
    classification: 'destructive',
    requiresConfirmation: true,
    execute: async () => ({}),
  }),
]
