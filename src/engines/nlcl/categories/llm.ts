// src/engines/nlcl/categories/llm.ts
// llm command patterns — data only (moved from catalog.ts by
// categories/_generate.ts). Keep this a pure data module: build patterns
// through the shared builder in ./builder.ts.

import { z } from 'zod'
import type { CommandPattern } from '../types.js'
import { pattern } from './builder.js'

export const llmPatterns: CommandPattern[] = [
  pattern('llm.ask', 'llm.ask', 'Ask a provider LLM a question', {
    patterns: [
      {
        regex:
          /(?:ask|talk\s+to|tell|question)\s+(chatgpt|gpt|claude|gemini|ai|the\s+ai)\s+(?:about\s+|to\s+|that\s+)?(.+)$/,
        priority: 15,
        keywords: ['ask', 'chatgpt', 'claude', 'gemini'],
        extract: (m) => {
          const providerRaw = (m[1] ?? '').toLowerCase()
          const providerMap: Record<string, string> = {
            chatgpt: 'chatgpt',
            gpt: 'chatgpt',
            claude: 'claude',
            gemini: 'gemini',
            ai: 'chatgpt',
            'the ai': 'chatgpt',
          }
          return {
            providerId: providerMap[providerRaw] ?? 'chatgpt',
            prompt: (m[2] ?? '').trim(),
          }
        },
      },
      {
        regex: /(?:ask|tell)\s+(.+?)\s+(?:to\s+)?(?:chatgpt|claude|gemini|ai)$/,
        priority: 14,
        extract: (m) => ({
          prompt: (m[1] ?? '').trim(),
          providerId: 'chatgpt',
        }),
      },
    ],
    aliases: ['ask', 'question', 'tell ai'],
    examples: [
      'ask chatgpt about quantum physics',
      'tell claude to explain recursion',
      'ask gemini what is the weather',
    ],
    inputSchema: z.object({
      prompt: z.string(),
      providerId: z.string().optional(),
      query: z.string().optional(),
      message: z.string().optional(),
    }),
    executor: 'provider-llm',
    category: 'llm',
    classification: 'communication',
    aiFallback: true,
    execute: async () => ({}),
  }),

  pattern('llm.summarize', 'llm.summarize', 'Summarize content using provider LLM', {
    patterns: [
      {
        regex:
          /(?:summarize|summarise|tldr|tl;dr)\s+(?:(?:the\s+)?(?:news|article|page|content|text|document)\s+)?(?:about\s+)?(.+)?$/,
        priority: 14,
        keywords: ['summarize', 'summarise', 'tldr'],
        extract: (m) => ({
          topic: (m[1] ?? '').trim() || undefined,
          content: undefined,
        }),
      },
    ],
    aliases: ['summarize', 'tldr', 'summarise'],
    examples: ['summarize the news', 'summarize about AI', 'tldr this article'],
    inputSchema: z.object({
      content: z.string().optional(),
      topic: z.string().optional(),
    }),
    executor: 'provider-llm',
    category: 'llm',
    classification: 'communication',
    aiFallback: true,
    execute: async () => ({}),
  }),

  pattern('web.summarize', 'web.summarize', 'Navigate to a URL and summarize its content', {
    patterns: [
      {
        regex:
          /(?:go\s+to|open|visit)\s+(https?:\/\/[^\s]+|[\w-]+\.[\w.-]+)\s+(?:and\s+)?(?:summarize|summarise|tldr|read\s+and\s+summarize)/,
        priority: 20,
        keywords: ['go to', 'summarize'],
        extract: (m) => ({ url: (m[1] ?? '').trim() }),
      },
      {
        regex: /(?:summarize|summarise)\s+(https?:\/\/[^\s]+|[\w-]+\.[\w.-]+)/,
        priority: 19,
        extract: (m) => ({ url: (m[1] ?? '').trim() }),
      },
      {
        regex:
          /(?:summarize|summarise)\s+(?:the\s+)?(?:news|latest)\s+(?:from\s+|on\s+)?(cnn|bbc|reuters|nytimes|wsj|techcrunch|the\s+verge|hacker\s+news)/,
        priority: 18,
        extract: (m) => {
          const site = (m[1] ?? '').toLowerCase()
          const urlMap: Record<string, string> = {
            cnn: 'https://cnn.com',
            bbc: 'https://bbc.com/news',
            reuters: 'https://reuters.com',
            nytimes: 'https://nytimes.com',
            wsj: 'https://wsj.com',
            techcrunch: 'https://techcrunch.com',
            'the verge': 'https://theverge.com',
            'hacker news': 'https://news.ycombinator.com',
          }
          return { url: urlMap[site] ?? `https://${site}.com`, topic: 'news' }
        },
      },
    ],
    aliases: ['summarize website', 'read and summarize'],
    examples: [
      'go to cnn and summarize the news',
      'summarize bbc.com',
      'summarize the news from cnn',
    ],
    inputSchema: z.object({
      url: z.string().optional(),
      content: z.string().optional(),
      topic: z.string().optional(),
    }),
    executor: 'provider-llm',
    category: 'llm',
    classification: 'communication',
    aiFallback: true,
    execute: async () => ({}),
  }),

  // Unit 1.5 — QUERY endpoint for safe body-bearing read
  pattern('web.query', 'web.query', 'Query an HTTP endpoint with body (safe read)', {
    patterns: [
      {
        regex:
          /(?:query|fetch|get|read)\s+(?:from\s+)?(https?:\/\/[^\s]+)\s+(?:with|body)?\s*(.+)?$/,
        priority: 15,
        keywords: ['query', 'fetch', 'http get'],
        extract: (m) => ({ url: (m[1] ?? '').trim(), body: (m[2] ?? '').trim() || undefined }),
      },
    ],
    aliases: ['query', 'http query', 'fetch'],
    examples: ['query https://api.example.com/data', 'fetch from https://api.github.com with body'],
    inputSchema: z.object({ url: z.string(), body: z.string().optional() }),
    executor: 'web',
    category: 'web',
    classification: 'read',
    capabilityId: 'cap:web:query',
    execute: async () => ({}),
  }),

  pattern('llm.translate', 'llm.translate', 'Translate text using provider LLM', {
    patterns: [
      {
        regex: /translate\s+(.+?)\s+(?:to|into)\s+(\w+)(?:\s+from\s+(\w+))?/,
        priority: 14,
        keywords: ['translate'],
        extract: (m) => ({
          text: (m[1] ?? '').trim(),
          targetLanguage: (m[2] ?? '').trim(),
          sourceLanguage: (m[3] ?? undefined)?.trim(),
        }),
      },
    ],
    aliases: ['translate'],
    examples: ['translate hello world to spanish', 'translate bonjour to english from french'],
    inputSchema: z.object({
      text: z.string(),
      targetLanguage: z.string(),
      sourceLanguage: z.string().optional(),
    }),
    executor: 'provider-llm',
    category: 'llm',
    classification: 'communication',
    aiFallback: true,
    execute: async () => ({}),
  }),

  pattern('llm.explain', 'llm.explain', 'Explain something using provider LLM', {
    patterns: [
      {
        regex:
          /(?:explain|what\s+is|what\s+are|define|describe)\s+(.+?)(?:\s+(?:to\s+me|please))?$/,
        priority: 10,
        keywords: ['explain', 'what is', 'define', 'describe'],
        extract: (m) => ({ topic: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['explain', 'what is', 'define', 'describe'],
    examples: ['explain quantum computing', 'what is machine learning', 'define recursion'],
    inputSchema: z.object({
      topic: z.string(),
      content: z.string().optional(),
    }),
    executor: 'provider-llm',
    category: 'llm',
    classification: 'communication',
    aiFallback: true,
    execute: async () => ({}),
  }),

  pattern('llm.rewrite', 'llm.rewrite', 'Rewrite text using provider LLM', {
    patterns: [
      {
        regex: /rewrite\s+(.+?)\s+(?:in\s+a\s+)?(\w+)\s+(?:style|tone|way)/,
        priority: 12,
        keywords: ['rewrite'],
        extract: (m) => ({
          text: (m[1] ?? '').trim(),
          style: (m[2] ?? '').trim(),
        }),
      },
    ],
    aliases: ['rewrite'],
    examples: ['rewrite this paragraph in a formal style', 'rewrite the email in a casual tone'],
    inputSchema: z.object({
      text: z.string(),
      style: z.string().optional(),
    }),
    executor: 'provider-llm',
    category: 'llm',
    classification: 'communication',
    aiFallback: true,
    execute: async () => ({}),
  }),

  pattern('llm.code', 'llm.code', 'Generate code using provider LLM', {
    patterns: [
      {
        regex:
          /(?:write|create|generate|make)\s+(?:code|a\s+function|a\s+script|a\s+program)(?:\s+(?:in|using|with)\s+(\w+))?\s+(?:that|to|which)\s+(.+)/,
        priority: 13,
        keywords: ['write code', 'generate code', 'create function'],
        extract: (m) => ({
          language: (m[1] ?? undefined)?.trim(),
          task: (m[2] ?? '').trim(),
        }),
      },
      {
        regex: /code\s+(.+?)\s+(?:in|using)\s+(\w+)/,
        priority: 12,
        extract: (m) => ({
          task: (m[1] ?? '').trim(),
          language: (m[2] ?? '').trim(),
        }),
      },
    ],
    aliases: ['write code', 'generate code', 'code'],
    examples: [
      'write code that sorts a list in python',
      'create a function to validate email in javascript',
    ],
    inputSchema: z.object({
      task: z.string(),
      language: z.string().optional(),
    }),
    executor: 'provider-llm',
    category: 'llm',
    classification: 'communication',
    aiFallback: true,
    execute: async () => ({}),
  }),

  // ── LLM-as-Human testing (Spec 032) ──────────────────────────────────
  // Source-level NL bindings so "run llm tests" / "check capability parity"
  // resolve through the catalog → UnifiedCapabilityRegistry (One Entry Point).
  pattern('llm.test.run', 'llm.test.run', 'Run the LLM-as-Human test suite', {
    patterns: [
      {
        regex:
          /^(?:run\s+)?llm[- ]?tests?(?:\s+(?:in|on|across)\s+(\w+))?|test\s+(?:the\s+)?(?:platform|system|all\s+surfaces)/,
        priority: 16,
        keywords: ['llm test', 'llm-test', 'run tests', 'test suite'],
        extract: (m) => ({
          mode: 'smoke',
          surfaces: m[1] ? [m[1]] : undefined,
        }),
      },
    ],
    aliases: ['llm-test run', 'run llm tests', 'test platform'],
    examples: ['run llm tests', 'llm-test run --mode full', 'test the platform'],
    inputSchema: z.object({
      mode: z.string().optional(),
      surfaces: z.array(z.string()).optional(),
      providers: z.array(z.string()).optional(),
    }),
    executor: 'capability',
    category: 'llm',
    classification: 'system',
    capabilityId: 'cap:llm_test:run',
    execute: async () => ({}),
  }),

  pattern('llm.test.parity', 'llm.test.parity', 'Verify cross-surface capability parity', {
    patterns: [
      {
        regex:
          /(?:check|verify|show)\s+(?:cross[- ]?surface\s+)?(?:parity|capability\s+parity)|is\s+(?:everything\s+)?frontend\s*=?\s*backend/,
        priority: 16,
        keywords: ['parity', 'cross-surface', 'frontend backend'],
        extract: () => ({}),
      },
    ],
    aliases: ['llm-test parity', 'check parity', 'verify parity'],
    examples: ['check parity', 'verify cross-surface parity', 'is frontend = backend'],
    inputSchema: z.object({}),
    executor: 'capability',
    category: 'llm',
    classification: 'system',
    capabilityId: 'cap:llm_test:parity',
    execute: async () => ({}),
  }),

  pattern('llm.test.status', 'llm.test.status', 'Show LLM test coverage and priorities', {
    patterns: [
      {
        regex: /llm[- ]?test\s+(?:status|coverage)|test\s+coverage/,
        priority: 15,
        keywords: ['llm test status', 'test coverage'],
        extract: () => ({}),
      },
    ],
    aliases: ['llm-test status', 'test coverage'],
    examples: ['llm-test status', 'show test coverage'],
    inputSchema: z.object({}),
    executor: 'capability',
    category: 'llm',
    classification: 'system',
    capabilityId: 'cap:llm_test:status',
    execute: async () => ({}),
  }),
]
