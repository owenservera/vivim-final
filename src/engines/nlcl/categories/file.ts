// src/engines/nlcl/categories/file.ts
// file command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { pattern } from './builder.js'
import { z } from 'zod'
import type { CommandPattern } from '../types.js'

export const filePatterns: CommandPattern[] = [
  pattern('file.open', 'file.open', 'Open a file by name or path', {
    patterns: [
      {
        regex:
          /(?:open|launch|show|view)\s+(?:my\s+|the\s+|a\s+)?(.+?)(?:\s+(?:file|document|doc|pdf))?$/,
        priority: 10,
        keywords: ['open', 'launch', 'show', 'view'],
        extract: (m) => {
          const name = (m[1] ?? '').trim()
          if (name.match(/^[A-Z]:[\\/]|^\/|^~\//)) {
            return { path: name }
          }
          return { name }
        },
      },
    ],
    aliases: ['open file', 'open document'],
    examples: [
      'open my resume',
      'open report.pdf',
      'open C:\\Users\\me\\doc.txt',
      'open my budget',
    ],
    inputSchema: z.object({
      name: z.string().optional(),
      path: z.string().optional(),
    }),
    executor: 'file',
    category: 'file',
    classification: 'read',
    execute: async () => ({}),
  }),

  pattern('file.list', 'file.list', 'List files in a folder', {
    patterns: [
      {
        regex: /(?:list|show|open)\s+(?:my\s+)?(documents|desktop|downloads|pictures|files|folder)/,
        priority: 12,
        keywords: ['list', 'documents', 'desktop', 'downloads', 'pictures'],
        extract: (m) => ({ folder: (m[1] ?? 'documents').toLowerCase() }),
      },
      {
        regex:
          /(?:what|which)\s+(?:files|documents)\s+(?:are\s+)?(?:in|on)\s+(?:my\s+)?(documents|desktop|downloads|pictures)/,
        priority: 11,
        extract: (m) => ({ folder: (m[1] ?? 'documents').toLowerCase() }),
      },
    ],
    aliases: ['list files', 'show files', 'open documents'],
    examples: ['list my documents', 'show desktop', "what's in my downloads"],
    inputSchema: z.object({ folder: z.string().optional() }),
    executor: 'file',
    category: 'file',
    classification: 'read',
    execute: async () => ({}),
  }),

  pattern('file.search', 'file.search', 'Search for files by name', {
    patterns: [
      {
        regex:
          /(?:find|search\s+for|look\s+for|where\s+(?:is|are))\s+(.+?)(?:\s+(?:file|document|doc))?$/,
        priority: 9,
        keywords: ['find', 'search for', 'look for'],
        extract: (m) => ({ query: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['find file', 'search files'],
    examples: ['find my resume', 'search for budget', 'where is my tax document'],
    inputSchema: z.object({ query: z.string().optional(), name: z.string().optional() }),
    executor: 'file',
    category: 'file',
    classification: 'read',
    execute: async () => ({}),
  }),

  pattern('file.create', 'file.create', 'Create a new file', {
    patterns: [
      {
        regex:
          /(?:create|make|new)\s+(?:a\s+)?(?:file|document|doc|note)\s+(?:called\s+|named\s+)?(.+?)(?:\s+(?:in|under)\s+(documents|desktop|downloads))?$/,
        priority: 8,
        keywords: ['create', 'make', 'new file'],
        extract: (m) => ({
          name: (m[1] ?? '').trim(),
          folder: (m[2] ?? 'documents').toLowerCase(),
        }),
      },
    ],
    aliases: ['create file', 'new file', 'make document'],
    examples: ['create a file called notes.txt', 'make a new document named todo'],
    inputSchema: z.object({
      name: z.string(),
      content: z.string().optional(),
      folder: z.string().optional(),
    }),
    executor: 'file',
    category: 'file',
    classification: 'write',
    execute: async () => ({}),
  }),

  pattern('file.read', 'file.read', 'Read file contents', {
    patterns: [
      {
        regex: /(?:read|show\s+contents|display)\s+(?:of\s+)?(.+?)(?:\s+(?:file|document))?$/,
        priority: 8,
        keywords: ['read', 'show contents'],
        extract: (m) => ({ name: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['read file', 'show file contents'],
    examples: ['read my notes', 'show contents of config.json'],
    inputSchema: z.object({ name: z.string() }),
    executor: 'file',
    category: 'file',
    classification: 'read',
    execute: async () => ({}),
  }),
]
