// src/engines/nlcl/categories/canvas.ts
// canvas command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const canvasPatterns: CommandPattern[] = [
  pattern(
    'canvas.set_background',
    'canvas.set_background',
    'Change canvas background (by image query or layer)',
    {
      patterns: [
        {
          regex:
            /(?:change|set)\s+(?:my\s+)?(?:canvas\s+background|background)\s+(?:to|as)\s+(?:an?\s+)?(?:image\s+of\s+)?(.+)$/,
          priority: 18,
          keywords: ['change background', 'set background', 'canvas background'],
          extract: (m) => ({ imageQuery: (m[1] ?? '').trim().replace(/^the\s+/i, '') }),
        },
        {
          regex: /(?:canvas|background)\s+(image|picture|photo):\s*(.+)$/i,
          priority: 17,
          keywords: ['canvas', 'background'],
          extract: (m) => ({ imageQuery: (m[2] ?? '').trim().replace(/^the\s+/i, '') }),
        },
      ],
      aliases: ['canvas background', 'change background'],
      examples: ['change my canvas background to an image of the moon made out of cheese'],
      inputSchema: z.object({
        imageQuery: z.string().optional(),
        imageBase64: z.string().optional(),
        layerId: z.string().optional(),
      }),
      executor: 'capability',
      category: 'canvas',
      classification: 'system',
      aiFallback: true,
      capabilityId: 'cap:canvas:set_background',
      execute: async () => ({}),
    },
  ),

  pattern('canvas.add_layer', 'canvas.add_layer', 'Add a layer to the canvas', {
    patterns: [
      {
        regex:
          /(?:add|create)\s+(?:a\s+)?(?:layer|panel|window)\s+(?:showing|displaying|with)?\s*(.+)$/,
        priority: 16,
        keywords: ['add layer', 'create layer', 'canvas layer'],
        extract: (m) => ({ kind: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['add layer', 'create layer'],
    examples: ['add a layer showing my providers', 'create a layer for chat'],
    inputSchema: z.object({
      kind: z.string().optional(),
      title: z.string().optional(),
      config: z.record(z.unknown()).optional(),
    }),
    executor: 'capability',
    category: 'canvas',
    classification: 'system',
    capabilityId: 'cap:canvas:add_layer',
    execute: async () => ({}),
  }),

  pattern('canvas.remove_layer', 'canvas.remove_layer', 'Remove a layer from the canvas', {
    patterns: [
      {
        regex: /(?:remove|delete)\s+(?:the\s+)?(?:layer|panel)\s+(?:named\s+)?(.+)$/,
        priority: 15,
        keywords: ['remove layer', 'delete layer'],
        extract: (m) => ({ layerId: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['remove layer', 'delete layer'],
    examples: ['remove the chat layer', 'delete layer inst:chat:abc'],
    inputSchema: z.object({
      layerId: z.string(),
    }),
    executor: 'capability',
    category: 'canvas',
    classification: 'system',
    requiresConfirmation: true,
    capabilityId: 'cap:canvas:remove_layer',
    execute: async () => ({}),
  }),

  pattern('canvas.set_layout', 'canvas.set_layout', 'Set canvas layout mode', {
    patterns: [
      {
        regex: /(?:set|change)\s+(?:canvas\s+)?layout\s+(?:to\s+)?(grid|list|freeform)$/,
        priority: 14,
        keywords: ['set layout', 'canvas layout'],
        extract: (m) => ({ layout: (m[1] ?? 'freeform').toLowerCase() }),
      },
    ],
    aliases: ['set layout'],
    examples: ['set layout to grid', 'set canvas layout to list'],
    inputSchema: z.object({
      layout: z.enum(['grid', 'list', 'freeform']).optional(),
    }),
    executor: 'capability',
    category: 'canvas',
    classification: 'system',
    capabilityId: 'cap:canvas:set_layout',
    execute: async () => ({}),
  }),

  pattern('canvas.set_theme', 'canvas.set_theme', 'Set canvas theme', {
    patterns: [
      {
        regex: /(?:set|change|switch)\s+(?:canvas\s+)?theme\s+(?:to\s+)?(light|dark|auto)$/,
        priority: 13,
        keywords: ['set theme', 'canvas theme'],
        extract: (m) => ({ theme: (m[1] ?? 'auto').toLowerCase() }),
      },
    ],
    aliases: ['set theme', 'dark mode', 'light mode'],
    examples: ['set theme to dark', 'switch canvas to light mode'],
    inputSchema: z.object({
      theme: z.enum(['light', 'dark', 'auto']).optional(),
    }),
    executor: 'capability',
    category: 'canvas',
    classification: 'system',
    capabilityId: 'cap:canvas:set_theme',
    execute: async () => ({}),
  }),
]
