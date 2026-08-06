// src/engines/nlcl/categories/provider-cap.ts
// provider-cap command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { pattern } from './builder.js'
import { z } from 'zod'
import type { CommandPattern } from '../types.js'

export const providerCapPatterns: CommandPattern[] = [
  pattern(
    'claude.thinking',
    'claude.extended_thinking',
    'Set Claude thinking token budget',
    {
      patterns: [
        {
          regex:
            /claude\s+(?:thinking|think)\s+(?:budget\s+)?(?:--budgetTokens\s+)?(\d+)/i,
          priority: 14,
          keywords: ['claude', 'thinking', 'budget'],
          extract: (m) => ({ budgetTokens: Number(m[1] ?? 4096) }),
        },
        {
          regex: /(?:set|enable|toggle)\s+claude\s+(?:extended\s+)?thinking/i,
          priority: 12,
          keywords: ['claude', 'thinking', 'enable'],
          extract: () => ({ budgetTokens: 4096, enabled: true }),
        },
        {
          regex: /disable\s+claude\s+(?:extended\s+)?thinking/i,
          priority: 12,
          keywords: ['claude', 'thinking', 'disable'],
          extract: () => ({ budgetTokens: 0, enabled: false }),
        },
      ],
      aliases: ['claude think', 'extended thinking'],
      examples: [
        'claude thinking budget 8192',
        'enable claude extended thinking',
        'disable claude thinking',
      ],
      inputSchema: z.object({
        budgetTokens: z.number().min(0).max(64000).default(4096),
        enabled: z.boolean().optional(),
      }),
      executor: 'provider-llm',
      category: 'llm',
      classification: 'write',
      capabilityId: 'cap:claude:extended_thinking',
      execute: async () => ({}),
    },
  ),

  pattern(
    'claude.extract_artifacts',
    'claude.export_artifact',
    'Export a Claude artifact to a workspace file',
    {
      patterns: [
        {
          regex:
            /claude\s+(?:artifact\s+)?export\s+(?:--artifactId\s+)?(\S+)\s+(?:--targetPath\s+)?(\S+)/i,
          priority: 14,
          keywords: ['claude', 'artifact', 'export'],
          extract: (m) => ({ artifactId: m[1] ?? '', targetPath: m[2] ?? '' }),
        },
        {
          regex: /(?:export|save|extract)\s+claude\s+artifact(?:\s+(\S+))?/i,
          priority: 11,
          keywords: ['export', 'claude', 'artifact'],
          extract: (m) => ({ artifactId: m[1] ?? '', targetPath: '' }),
        },
      ],
      aliases: ['claude artifact export', 'save artifact'],
      examples: [
        'claude artifact export art_123 ./src/index.ts',
        'export claude artifact',
      ],
      inputSchema: z.object({
        artifactId: z.string(),
        targetPath: z.string(),
      }),
      executor: 'provider-llm',
      category: 'llm',
      classification: 'write',
      capabilityId: 'cap:claude:extract_artifacts',
      execute: async () => ({}),
    },
  ),

  pattern(
    'chatgpt.canvas_sync',
    'chatgpt.canvas_sync',
    'Sync ChatGPT Canvas edits back to local files',
    {
      patterns: [
        {
          regex:
            /chatgpt\s+canvas\s+sync(?:\s+(?:--canvasId\s+)?(\S+))?(?:\s+(?:--targetPath\s+)?(\S+))?/i,
          priority: 14,
          keywords: ['chatgpt', 'canvas', 'sync'],
          extract: (m) => ({ canvasId: m[1] ?? '', targetPath: m[2] ?? '' }),
        },
        {
          regex: /sync\s+(?:chatgpt\s+)?canvas/i,
          priority: 11,
          keywords: ['sync', 'canvas'],
          extract: () => ({ canvasId: '', targetPath: '' }),
        },
      ],
      aliases: ['canvas sync', 'gcsync'],
      examples: ['chatgpt canvas sync cv_123 ./app.ts', 'sync canvas'],
      inputSchema: z.object({
        canvasId: z.string(),
        targetPath: z.string(),
      }),
      executor: 'provider-llm',
      category: 'llm',
      classification: 'write',
      capabilityId: 'cap:chatgpt:canvas_sync',
      execute: async () => ({}),
    },
  ),

  pattern(
    'chatgpt.web_search',
    'chatgpt.toggle_web_search',
    'Toggle ChatGPT web search on or off',
    {
      patterns: [
        {
          regex: /chatgpt\s+(?:web\s*)?search\s*(on|off|enable|disable|true|false)/i,
          priority: 13,
          keywords: ['chatgpt', 'websearch', 'toggle'],
          extract: (m) => ({
            enabled: ['on', 'enable', 'true'].includes((m[1] ?? '').toLowerCase()),
          }),
        },
        {
          regex: /(?:enable|turn\s+on)\s+(?:chatgpt\s+)?web\s*search/i,
          priority: 12,
          keywords: ['enable', 'websearch'],
          extract: () => ({ enabled: true }),
        },
        {
          regex: /(?:disable|turn\s+off)\s+(?:chatgpt\s+)?web\s*search/i,
          priority: 12,
          keywords: ['disable', 'websearch'],
          extract: () => ({ enabled: false }),
        },
      ],
      aliases: ['chatgpt websearch', 'toggle web search'],
      examples: ['chatgpt search on', 'enable chatgpt web search', 'disable web search'],
      inputSchema: z.object({ enabled: z.boolean() }),
      executor: 'provider-llm',
      category: 'llm',
      classification: 'write',
      capabilityId: 'cap:chatgpt:toggle_web_search',
      execute: async () => ({}),
    },
  ),

  pattern(
    'gemini.grounding',
    'gemini.grounded_search',
    'Toggle Gemini Google Search grounding',
    {
      patterns: [
        {
          regex: /gemini\s+grounding\s*(on|off|enable|disable|true|false)/i,
          priority: 13,
          keywords: ['gemini', 'grounding'],
          extract: (m) => ({
            enabled: ['on', 'enable', 'true'].includes((m[1] ?? '').toLowerCase()),
          }),
        },
        {
          regex: /(?:enable|turn\s+on)\s+gemini\s+(?:search\s+)?grounding/i,
          priority: 12,
          keywords: ['gemini', 'grounding', 'enable'],
          extract: () => ({ enabled: true }),
        },
        {
          regex: /(?:disable|turn\s+off)\s+gemini\s+(?:search\s+)?grounding/i,
          priority: 12,
          keywords: ['gemini', 'grounding', 'disable'],
          extract: () => ({ enabled: false }),
        },
      ],
      aliases: ['gemini grounded search', 'gmground'],
      examples: [
        'gemini grounding on',
        'enable gemini search grounding',
        'disable gemini grounding',
      ],
      inputSchema: z.object({ enabled: z.boolean() }),
      executor: 'provider-llm',
      category: 'llm',
      classification: 'write',
      capabilityId: 'cap:gemini:grounded_search',
      execute: async () => ({}),
    },
  ),

  pattern(
    'gemini.sandbox',
    'gemini.python_sandbox',
    'Run a Gemini Python code snippet in the local sandbox',
    {
      patterns: [
        {
          regex: /gemini\s+sandbox\s+run(?:\s+([\s\S]+))?$/i,
          priority: 14,
          keywords: ['gemini', 'sandbox', 'run'],
          extract: (m) => ({ code: (m[1] ?? '').trim() }),
        },
        {
          regex: /(?:run|execute)\s+gemini\s+(?:python\s+)?(?:code|snippet|sandbox)/i,
          priority: 11,
          keywords: ['gemini', 'sandbox', 'execute'],
          extract: () => ({ code: '' }),
        },
      ],
      aliases: ['gemini python', 'gemini code run', 'gmsandbox'],
      examples: ['gemini sandbox run print(42)', 'run gemini python code'],
      inputSchema: z.object({ code: z.string() }),
      executor: 'provider-llm',
      category: 'llm',
      classification: 'write',
      capabilityId: 'cap:gemini:python_sandbox',
      execute: async () => ({}),
    },
  ),
]
