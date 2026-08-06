// src/engines/nlcl/categories/browser.ts
// browser command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { pattern } from './builder.js'
import { z } from 'zod'
import type { CommandPattern } from '../types.js'

export const browserPatterns: CommandPattern[] = [
  pattern('browser.navigate', 'browser.navigate', 'Navigate to a URL', {
    patterns: [
      {
        regex: /(?:go\s+to|navigate\s+to|open|visit)\s+(https?:\/\/[^\s]+|[\w-]+\.[\w.-]+[^\s]*)/,
        priority: 15,
        keywords: ['go to', 'navigate to', 'visit'],
        extract: (m) => ({ url: (m[1] ?? '').trim() }),
      },
      {
        regex:
          /(?:go\s+to|open|visit)\s+(cnn|bbc|youtube|github|gmail|google|reddit|twitter|x\.com|facebook|instagram|wikipedia|amazon|netflix|linkedin)/,
        priority: 14,
        extract: (m) => {
          const site = (m[1] ?? '').toLowerCase()
          const urlMap: Record<string, string> = {
            cnn: 'https://cnn.com',
            bbc: 'https://bbc.com',
            youtube: 'https://youtube.com',
            github: 'https://github.com',
            gmail: 'https://mail.google.com',
            google: 'https://google.com',
            reddit: 'https://reddit.com',
            twitter: 'https://twitter.com',
            'x.com': 'https://x.com',
            facebook: 'https://facebook.com',
            instagram: 'https://instagram.com',
            wikipedia: 'https://wikipedia.org',
            amazon: 'https://amazon.com',
            netflix: 'https://netflix.com',
            linkedin: 'https://linkedin.com',
          }
          return { url: urlMap[site] ?? `https://${site}.com` }
        },
      },
    ],
    aliases: ['go to', 'navigate', 'visit'],
    examples: ['go to cnn.com', 'open youtube', 'visit github.com'],
    inputSchema: z.object({ url: z.string() }),
    executor: 'browser',
    category: 'browser',
    classification: 'navigate',
    execute: async () => ({}),
  }),

  pattern('browser.search', 'browser.search', 'Search the web', {
    patterns: [
      {
        regex:
          /(?:search\s+(?:for\s+)?|google|look\s+up)\s*(.+?)(?:\s+on\s+(google|bing|duckduckgo|youtube))?$/,
        priority: 13,
        keywords: ['search', 'google', 'look up'],
        extract: (m) => ({
          query: (m[1] ?? '').trim(),
          engine: (m[2] ?? 'google').toLowerCase(),
        }),
      },
    ],
    aliases: ['search', 'google', 'look up'],
    examples: [
      'search for best restaurants',
      'google weather tomorrow',
      'look up python docs on bing',
    ],
    inputSchema: z.object({
      query: z.string(),
      engine: z.string().optional(),
    }),
    executor: 'browser',
    category: 'browser',
    classification: 'navigate',
    execute: async () => ({}),
  }),

  pattern('browser.open', 'browser.open', 'Open Chrome browser', {
    patterns: [
      {
        regex: /(?:open|launch|start)\s+(?:chrome|browser|the\s+browser)/,
        priority: 16,
        keywords: ['open chrome', 'launch chrome', 'start browser'],
        extract: () => ({}),
      },
    ],
    aliases: ['open chrome', 'launch browser', 'start chrome'],
    examples: ['open chrome', 'launch browser', 'start chrome'],
    inputSchema: z.object({ url: z.string().optional() }),
    executor: 'browser',
    category: 'browser',
    classification: 'navigate',
    execute: async () => ({}),
  }),

  pattern('browser.extract', 'browser.extract', 'Extract text from current page', {
    patterns: [
      {
        regex:
          /(?:extract|read|get)\s+(?:the\s+)?(?:text|content|page)(?:\s+content)?\s+(?:from\s+)?(?:this\s+)?(?:page|tab|site)?/,
        priority: 7,
        keywords: ['extract', 'read page', 'get content'],
        extract: () => ({}),
      },
    ],
    aliases: ['extract text', 'read page', 'get page content'],
    examples: ['extract the text from this page', 'read page content'],
    inputSchema: z.object({}),
    executor: 'browser',
    category: 'browser',
    classification: 'read',
    execute: async () => ({}),
  }),

  pattern('browser.screenshot', 'browser.screenshot', 'Take a screenshot', {
    patterns: [
      {
        regex: /(?:take\s+)?(?:a\s+)?screenshot(?:\s+of\s+(?:this\s+)?(?:page|tab|screen))?/,
        priority: 12,
        keywords: ['screenshot', 'capture screen'],
        extract: () => ({}),
      },
    ],
    aliases: ['screenshot', 'capture screen', 'take screenshot'],
    examples: ['screenshot', 'take a screenshot of this page'],
    inputSchema: z.object({}),
    executor: 'browser',
    category: 'browser',
    classification: 'read',
    execute: async () => ({}),
  }),
]
