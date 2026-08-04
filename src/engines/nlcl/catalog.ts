// src/engines/nlcl/catalog.ts
// Consumer Command Catalog — all NL command patterns for 95% consumer volume.
// Every pattern is deterministic (regex + keyword). NO AI required.
// Categories: file, browser, web+ai, email, app, conversation, llm, system, memory.

import { z } from 'zod'
import type { CommandPattern } from './types.js'

// ── Builder helper ────────────────────────────────────────────────────────

function pattern(
  id: string,
  intent: string,
  description: string,
  opts: {
    patterns: CommandPattern['patterns']
    aliases?: string[]
    examples?: string[]
    inputSchema?: z.ZodSchema
    outputSchema?: z.ZodSchema
    executor: CommandPattern['executor']
    category: string
    surfaces?: CommandPattern['surfaces']
    requiresConfirmation?: boolean
    classification?: CommandPattern['classification']
    aiFallback?: boolean
    tags?: string[]
    execute: CommandPattern['execute']
    capabilityId?: string
  },
): CommandPattern {
  return {
    id,
    intent,
    description,
    patterns: opts.patterns,
    aliases: opts.aliases ?? [],
    examples: opts.examples ?? [],
    inputSchema: opts.inputSchema ?? z.object({}).passthrough(),
    outputSchema: opts.outputSchema ?? z.unknown(),
    executor: opts.executor,
    execute: opts.execute,
    category: opts.category,
    surfaces: opts.surfaces ?? ['cli', 'ui', 'frontend', 'mcp', 'api'],
    requiresConfirmation: opts.requiresConfirmation ?? false,
    classification: opts.classification ?? 'read',
    aiFallback: opts.aiFallback ?? false,
    tags: opts.tags ?? [],
    capabilityId: opts.capabilityId,
  }
}

// ── FILE patterns ─────────────────────────────────────────────────────────

const filePatterns: CommandPattern[] = [
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

// ── BROWSER patterns ──────────────────────────────────────────────────────

const browserPatterns: CommandPattern[] = [
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

// ── PROVIDER LLM patterns ─────────────────────────────────────────────────

const llmPatterns: CommandPattern[] = [
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

// ── EMAIL patterns ────────────────────────────────────────────────────────

const emailPatterns: CommandPattern[] = [
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

// ── APP patterns ──────────────────────────────────────────────────────────

const appPatterns: CommandPattern[] = [
  pattern('app.launch', 'app.launch', 'Launch a native application', {
    patterns: [
      {
        regex:
          /(?:open|launch|start|run)\s+(notepad|calculator|calc|terminal|cmd|powershell|explorer|paint|word|excel|chrome|edge|settings|textedit|safari|finder|notes|mail|calendar|files|file|firefox|screenshot|snipping|snip)/,
        priority: 13,
        keywords: ['open', 'launch', 'start app'],
        extract: (m) => ({ app: (m[1] ?? '').toLowerCase().trim() }),
      },
    ],
    aliases: ['open app', 'launch app'],
    examples: ['open notepad', 'launch calculator', 'start terminal'],
    inputSchema: z.object({ app: z.string(), name: z.string().optional() }),
    executor: 'app',
    category: 'app',
    classification: 'system',
    execute: async () => ({}),
  }),
]

// ── CONVERSATION patterns ─────────────────────────────────────────────────

const conversationPatterns: CommandPattern[] = [
  pattern('conversation.create', 'conversation.create', 'Create a new conversation', {
    patterns: [
      {
        regex:
          /(?:new|create|start)\s+(?:a\s+)?(?:conversation|chat|session)(?:\s+(?:with|on)\s+(chatgpt|claude|gemini))?/,
        priority: 12,
        keywords: ['new conversation', 'create chat', 'start session'],
        extract: (m) => ({
          providerId: (m[1] ?? undefined)?.toLowerCase(),
        }),
      },
    ],
    aliases: ['new chat', 'new conversation', 'create conversation'],
    examples: ['new conversation', 'create a chat with claude', 'start a session on gemini'],
    inputSchema: z.object({
      providerId: z.string().optional(),
      title: z.string().optional(),
    }),
    executor: 'conversation',
    category: 'conversation',
    classification: 'system',
    capabilityId: 'cap:conversation:create',
    execute: async () => ({}),
  }),

  pattern('conversation.list', 'conversation.list', 'List conversations', {
    patterns: [
      {
        regex: /(?:list|show|my)\s+(?:my\s+)?(?:conversations|chats|sessions)/,
        priority: 11,
        keywords: ['list conversations', 'show chats'],
        extract: () => ({}),
      },
    ],
    aliases: ['list chats', 'show conversations', 'my conversations'],
    examples: ['list my conversations', 'show chats'],
    inputSchema: z.object({ limit: z.number().optional() }),
    executor: 'conversation',
    category: 'conversation',
    classification: 'read',
    capabilityId: 'cap:conversation:list',
    execute: async () => ({}),
  }),

  pattern('conversation.switch', 'conversation.switch', 'Switch to a different provider', {
    patterns: [
      {
        regex: /(?:switch\s+to|use|change\s+to)\s+(chatgpt|claude|gemini|gpt)/,
        priority: 14,
        keywords: ['switch to', 'use provider'],
        extract: (m) => {
          const p = (m[1] ?? '').toLowerCase()
          return { providerId: p === 'gpt' ? 'chatgpt' : p }
        },
      },
    ],
    aliases: ['switch to', 'use provider'],
    examples: ['switch to claude', 'use gemini', 'change to chatgpt'],
    inputSchema: z.object({ providerId: z.string() }),
    executor: 'conversation',
    category: 'conversation',
    classification: 'navigate',
    capabilityId: 'cap:conversation:switch',
    execute: async () => ({}),
  }),
]

// ── SYSTEM patterns ───────────────────────────────────────────────────────

const systemPatterns: CommandPattern[] = [
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

// ── CANVAS patterns ───────────────────────────────────────────────────────

const canvasPatterns: CommandPattern[] = [
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

// ── CHANNEL patterns (Phase 27.4) ─────────────────────────────────────────

const channelPatterns: CommandPattern[] = [
  pattern('channel.add', 'channel.add', 'Add a streaming channel', {
    patterns: [
      {
        regex:
          /(?:add|connect)\s+(?:my\s+|a\s+)?(whatsapp|facebook|telegram|slack|dispatch)\s+(?:feed|channel|messaging)/i,
        priority: 16,
        keywords: ['add channel', 'connect channel', 'stream channel'],
        extract: (m) => ({ providerId: (m[1] ?? '').toLowerCase() }),
      },
    ],
    aliases: ['add channel', 'add feed'],
    examples: ['add my whatsapp channel', 'connect my facebook messaging feed'],
    inputSchema: z.object({
      providerId: z.string(),
      name: z.string().optional(),
    }),
    executor: 'capability',
    category: 'channel',
    classification: 'system',
    capabilityId: 'cap:channel:add',
    execute: async () => ({}),
  }),

  pattern('channel.connect', 'channel.connect', 'Connect a streaming channel', {
    patterns: [
      {
        regex: /connect\s+(?:my\s+)?(.+)$/,
        priority: 15,
        keywords: ['connect channel'],
        extract: (m) => ({ channelId: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['connect channel'],
    examples: ['connect my whatsapp', 'connect channel ch:whatsapp:abc'],
    inputSchema: z.object({
      channelId: z.string(),
    }),
    executor: 'capability',
    category: 'channel',
    classification: 'system',
    capabilityId: 'cap:channel:connect',
    execute: async () => ({}),
  }),

  pattern('channel.list', 'channel.list', 'List streaming channels', {
    patterns: [
      {
        regex: /(?:list|show|my)\s+(?:my\s+)?(?:channels|feeds|messaging)/,
        priority: 14,
        keywords: ['list channels', 'show feeds'],
        extract: () => ({}),
      },
    ],
    aliases: ['list channels', 'show feeds'],
    examples: ['list my channels', 'show messaging feeds'],
    inputSchema: z.object({}),
    executor: 'capability',
    category: 'channel',
    classification: 'read',
    capabilityId: 'cap:channel:list',
    execute: async () => ({}),
  }),

  pattern('channel.remove', 'channel.remove', 'Remove a streaming channel', {
    patterns: [
      {
        regex: /(?:remove|delete|disconnect)\s+(?:my\s+)?(.+?)\s+(?:channel|feed)/,
        priority: 13,
        keywords: ['remove channel', 'delete feed'],
        extract: (m) => ({ channelId: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['remove channel', 'delete feed'],
    examples: ['remove my whatsapp channel', 'delete channel ch:telegram:abc'],
    inputSchema: z.object({
      channelId: z.string(),
    }),
    executor: 'capability',
    category: 'channel',
    classification: 'destructive',
    requiresConfirmation: true,
    capabilityId: 'cap:channel:remove',
    execute: async () => ({}),
  }),
]

// ── Helper functions for workflow patterns ─────────────────────────────────

function extractEmails(text: string): string[] {
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g
  const matches = text.match(emailRegex)
  return matches ?? []
}

function dayToCron(day: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayIdx = days.indexOf(day.toLowerCase())
  if (dayIdx >= 0) {
    return `0 9 * * ${dayIdx}`
  }
  if (day === 'day') return '0 9 * * *'
  if (day === 'hour') return '0 * * * *'
  return '0 9 * * *'
}

// ── WORKFLOW patterns (Phase 28.6) ───────────────────────────────────────

const workflowPatterns: CommandPattern[] = [
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
      actionConfig: z.record(z.unknown()).optional(),
      name: z.string().optional(),
    }),
    executor: 'capability',
    category: 'schedule',
    classification: 'system',
    capabilityId: 'cap:schedule:register',
    execute: async () => ({}),
  }),
]

// ── SESSION patterns (Phase 29.1) ───────────────────────────────────────────

const sessionPatterns: CommandPattern[] = [
  pattern('session.load', 'session.load', 'Load an interactive session', {
    patterns: [
      {
        regex:
          /(?:load|start|open)\s+(?:my\s+)?(chatgpt|claude|gemini|gpt|ai)\s+(?:session|chat|conversation)/i,
        priority: 14,
        keywords: ['load session', 'start chat'],
        extract: (m) => ({
          providerId: (m[1] ?? '').toLowerCase() === 'gpt' ? 'chatgpt' : (m[1] ?? '').toLowerCase(),
        }),
      },
    ],
    aliases: ['load session', 'start chat', 'open ai'],
    examples: ['load my chatgpt session', 'start claude chat', 'open ai conversation'],
    inputSchema: z.object({
      providerId: z.string(),
      accountId: z.string().optional(),
    }),
    executor: 'capability',
    category: 'session',
    classification: 'system',
    capabilityId: 'cap:session:load',
    execute: async () => ({}),
  }),

  pattern('session.start', 'session.start', 'Start a new session', {
    patterns: [
      {
        regex: /(?:start|begin)\s+(?:a\s+)?new\s+(?:session|chat)/i,
        priority: 13,
        keywords: ['start session', 'new chat'],
        extract: () => ({}),
      },
    ],
    aliases: ['start session', 'new chat'],
    examples: ['start a new session', 'begin session on claude'],
    inputSchema: z.object({
      providerId: z.string().optional(),
      accountId: z.string().optional(),
    }),
    executor: 'capability',
    category: 'session',
    classification: 'system',
    capabilityId: 'cap:session:start',
    execute: async () => ({}),
  }),

  pattern('session.list', 'session.list', 'List active sessions', {
    patterns: [
      {
        regex: /(?:list|show)\s+(?:my\s+)?(?:sessions|chats)/i,
        priority: 12,
        keywords: ['list sessions', 'show chats'],
        extract: () => ({}),
      },
    ],
    aliases: ['list sessions', 'my sessions'],
    examples: ['list sessions', 'show my chats'],
    inputSchema: z.object({}),
    executor: 'capability',
    category: 'session',
    classification: 'read',
    capabilityId: 'cap:session:list',
    execute: async () => ({}),
  }),
]

// ── MEMORY patterns ───────────────────────────────────────────────────────

const memoryPatterns: CommandPattern[] = [
  pattern('memory.recall', 'memory.recall', 'Recall something you know', {
    patterns: [
      {
        regex:
          /(?:remember|recall|what\s+(?:do\s+you\s+know|is)\s+(?:about\s+)?(.+)|what\s+(?:is|was)\s+(?:the\s+)?(.+?)\s+you\s+told\s+me)/,
        priority: 12,
        keywords: ['recall', 'remember', 'what do you know'],
        extract: (m) => ({ topic: (m[1] ?? m[2] ?? '').trim() }),
      },
    ],
    aliases: ['recall', 'remember', 'remind me'],
    examples: ['recall the secret key', 'remember what we discussed about quantum computing'],
    inputSchema: z.object({ topic: z.string().optional() }),
    executor: 'memory',
    category: 'memory',
    classification: 'read',
    execute: async () => ({}),
  }),

  pattern('memory.store', 'memory.store', 'Store something for later', {
    patterns: [
      {
        regex:
          /(?:remember|store|save)\s+(?:this\s+)?(?:key|secret|password|api\s+key)\s+(?:is\s+)?(.+)$/,
        priority: 11,
        keywords: ['remember', 'store', 'save'],
        extract: (m) => ({ key: 'secret', value: (m[1] ?? '').trim() }),
      },
    ],
    aliases: ['store', 'save', 'remember'],
    examples: ['remember my api key is abc123', 'store this password: hunter2'],
    inputSchema: z.object({
      key: z.string().optional(),
      value: z.string().optional(),
    }),
    executor: 'memory',
    category: 'memory',
    classification: 'write',
    execute: async () => ({}),
  }),
]

// ── Export all patterns ───────────────────────────────────────────────────

// ── AUTOMATION patterns (B8) ───────────────────────────────────────────────
// Provider-free browser automation via GenericBrowserExecutor. These route to
// the AutomationOrchestrator with a config-role agent (researcher/extractor/
// synthesizer/monitor/tester) + a declarative recipe. No scenario brains.

const automationPatterns: CommandPattern[] = [
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

// ── OpenCode patterns ─────────────────────────────────────────────────────

const opencodePatterns: CommandPattern[] = [
  pattern('opencode.send', 'opencode.send', 'Send a prompt to OpenCode serve', {
    patterns: [
      {
        regex: /(?:ask|talk\s+to|send\s+to)\s+opencode\s+(?:to\s+|about\s+|that\s+)?(.+)$/i,
        priority: 16,
        keywords: ['opencode', 'ask', 'send'],
        extract: (m) => ({
          prompt: (m[1] ?? '').trim(),
        }),
      },
      {
        regex: /opencode\s*:\s*(.+)$/i,
        priority: 15,
        keywords: ['opencode'],
        extract: (m) => ({
          prompt: (m[1] ?? '').trim(),
        }),
      },
      {
        regex: /(?:send|give|run)\s+(?:a\s+)?(?:prompt\s+)?(?:to\s+)?opencode\s+(.+)$/i,
        priority: 14,
        keywords: ['opencode', 'send', 'run'],
        extract: (m) => ({
          prompt: (m[1] ?? '').trim(),
        }),
      },
    ],
    aliases: ['opencode', 'ask opencode', 'send to opencode'],
    examples: [
      'ask opencode to refactor the auth module',
      'send to opencode: explain this codebase',
      'opencode: write unit tests for the parser',
    ],
    inputSchema: z.object({
      prompt: z.string(),
      sessionId: z.string().optional(),
      model: z.string().optional(),
    }),
    executor: 'opencode',
    category: 'agent',
    classification: 'communication',
    aiFallback: true,
    capabilityId: 'cap:opencode:send',
    execute: async () => ({}),
  }),

  pattern('opencode.session.create', 'opencode.session.create', 'Create an OpenCode session', {
    patterns: [
      {
        regex: /opencode\s+(?:session\s+)?create(?:\s+session)?$/i,
        priority: 12,
        keywords: ['opencode', 'create', 'session'],
        extract: () => ({}),
      },
    ],
    aliases: ['opencode create', 'opencode session create'],
    examples: ['opencode session create', 'opencode create session'],
    inputSchema: z.object({
      model: z.string().optional(),
      cwd: z.string().optional(),
    }),
    executor: 'opencode',
    category: 'agent',
    classification: 'system',
    capabilityId: 'cap:opencode:session.create',
    execute: async () => ({}),
  }),

  pattern('opencode.session.list', 'opencode.session.list', 'List OpenCode sessions', {
    patterns: [
      {
        regex: /opencode\s+(?:session\s+)?(?:list|ls|show)$/i,
        priority: 12,
        keywords: ['opencode', 'list', 'session'],
        extract: () => ({}),
      },
    ],
    aliases: ['opencode list', 'opencode sessions'],
    examples: ['opencode session list', 'opencode sessions'],
    inputSchema: z.object({}),
    executor: 'opencode',
    category: 'agent',
    classification: 'read',
    capabilityId: 'cap:opencode:session.list',
    execute: async () => ({}),
  }),
]

// ── PROVIDER CAPABILITIES ────────────────────────────────────────────────────
// NL patterns for 10x provider upgrade capabilities (Claude, ChatGPT, Gemini).

const providerCapPatterns: CommandPattern[] = [
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

// ── EXPORT ─────────────────────────────────────────────────────────────────

export { extractEmails, dayToCron }
export function getDefaultCommandPatterns(): CommandPattern[] {
  return [
    ...filePatterns,
    ...browserPatterns,
    ...llmPatterns,
    ...emailPatterns,
    ...appPatterns,
    ...conversationPatterns,
    ...systemPatterns,
    ...canvasPatterns,
    ...channelPatterns,
    ...sessionPatterns,
    ...workflowPatterns,
    ...memoryPatterns,
    ...automationPatterns,
    ...opencodePatterns,
    ...providerCapPatterns,
  ]
}

export function getPatternsByCategory(): Record<string, CommandPattern[]> {
  const all = getDefaultCommandPatterns()
  const result: Record<string, CommandPattern[]> = {}
  for (const p of all) {
    if (!result[p.category]) result[p.category] = []
    result[p.category]?.push(p)
  }
  return result
}
