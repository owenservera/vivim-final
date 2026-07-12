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
  }
}

// ── FILE patterns ─────────────────────────────────────────────────────────

const filePatterns: CommandPattern[] = [
  pattern('file.open', 'file.open', 'Open a file by name or path', {
    patterns: [
      {
        regex: /(?:open|launch|show|view)\s+(?:my\s+|the\s+|a\s+)?(.+?)(?:\s+(?:file|document|doc|pdf))?$/,
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
    examples: ['open my resume', 'open report.pdf', 'open C:\\Users\\me\\doc.txt', 'open my budget'],
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
        regex: /(?:what|which)\s+(?:files|documents)\s+(?:are\s+)?(?:in|on)\s+(?:my\s+)?(documents|desktop|downloads|pictures)/,
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
        regex: /(?:find|search\s+for|look\s+for|where\s+(?:is|are))\s+(.+?)(?:\s+(?:file|document|doc))?$/,
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
        regex: /(?:create|make|new)\s+(?:a\s+)?(?:file|document|doc|note)\s+(?:called\s+|named\s+)?(.+?)(?:\s+(?:in|under)\s+(documents|desktop|downloads))?$/,
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
        regex: /(?:go\s+to|open|visit)\s+(cnn|bbc|youtube|github|gmail|google|reddit|twitter|x\.com|facebook|instagram|wikipedia|amazon|netflix|linkedin)/,
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
        regex: /(?:search\s+(?:for\s+)?|google|look\s+up)\s*(.+?)(?:\s+on\s+(google|bing|duckduckgo|youtube))?$/,
        priority: 13,
        keywords: ['search', 'google', 'look up'],
        extract: (m) => ({
          query: (m[1] ?? '').trim(),
          engine: (m[2] ?? 'google').toLowerCase(),
        }),
      },
    ],
    aliases: ['search', 'google', 'look up'],
    examples: ['search for best restaurants', 'google weather tomorrow', 'look up python docs on bing'],
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
        regex: /(?:extract|read|get)\s+(?:the\s+)?(?:text|content|page)(?:\s+content)?\s+(?:from\s+)?(?:this\s+)?(?:page|tab|site)?/,
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
        regex: /(?:ask|talk\s+to|tell|question)\s+(chatgpt|gpt|claude|gemini|ai|the\s+ai)\s+(?:about\s+|to\s+|that\s+)?(.+)$/,
        priority: 15,
        keywords: ['ask', 'chatgpt', 'claude', 'gemini'],
        extract: (m) => {
          const providerRaw = (m[1] ?? '').toLowerCase()
          const providerMap: Record<string, string> = {
            chatgpt: 'chatgpt', gpt: 'chatgpt',
            claude: 'claude', gemini: 'gemini',
            ai: 'chatgpt', 'the ai': 'chatgpt',
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
    examples: ['ask chatgpt about quantum physics', 'tell claude to explain recursion', 'ask gemini what is the weather'],
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
        regex: /(?:summarize|summarise|tldr|tl;dr)\s+(?:(?:the\s+)?(?:news|article|page|content|text|document)\s+)?(?:about\s+)?(.+)?$/,
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
        regex: /(?:go\s+to|open|visit)\s+(https?:\/\/[^\s]+|[\w-]+\.[\w.-]+)\s+(?:and\s+)?(?:summarize|summarise|tldr|read\s+and\s+summarize)/,
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
        regex: /(?:summarize|summarise)\s+(?:the\s+)?(?:news|latest)\s+(?:from\s+|on\s+)?(cnn|bbc|reuters|nytimes|wsj|techcrunch|the\s+verge|hacker\s+news)/,
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
    examples: ['go to cnn and summarize the news', 'summarize bbc.com', 'summarize the news from cnn'],
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
        regex: /(?:explain|what\s+is|what\s+are|define|describe)\s+(.+?)(?:\s+(?:to\s+me|please))?$/,
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
        regex: /(?:write|create|generate|make)\s+(?:code|a\s+function|a\s+script|a\s+program)(?:\s+(?:in|using|with)\s+(\w+))?\s+(?:that|to|which)\s+(.+)/,
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
    examples: ['write code that sorts a list in python', 'create a function to validate email in javascript'],
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
]

// ── EMAIL patterns ────────────────────────────────────────────────────────

const emailPatterns: CommandPattern[] = [
  pattern('email.send', 'email.send', 'Send an email', {
    patterns: [
      {
        regex: /(?:send|write|compose)\s+(?:an\s+)?email\s+(?:to\s+)?([\w.+-]+@[\w-]+\.[\w.-]+|[\w\s]+)(?:\s+(?:about|re|subject)\s+(.+?))?(?:\s+saying\s+(.+))?$/,
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
    examples: ['send email to john@example.com about the meeting', 'email boss@example.com saying I will be late'],
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
        regex: /(?:open|launch|start|run)\s+(notepad|calculator|calc|terminal|cmd|powershell|explorer|paint|word|excel|chrome|edge|settings|textedit|safari|finder|notes|mail|calendar|files|file|firefox|screenshot|snipping|snip)/,
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
        regex: /(?:new|create|start)\s+(?:a\s+)?(?:conversation|chat|session)(?:\s+(?:with|on)\s+(chatgpt|claude|gemini))?/,
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
    execute: async () => ({}),
  }),
]

// ── SYSTEM patterns ───────────────────────────────────────────────────────

const systemPatterns: CommandPattern[] = [
  pattern('system.health', 'system.health', 'Check system health', {
    patterns: [
      {
        regex: /(?:what'?s?\s+)?(?:the\s+)?(?:system\s+)?health|how\s+(?:is|are)\s+(?:you|the\s+system|things)|status\s+check/,
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
    execute: async () => ({}),
  }),

  pattern('system.fleet', 'system.fleet', 'Show Chrome fleet status', {
    patterns: [
      {
        regex: /(?:fleet|chrome)\s+(?:status|state|info)|what'?s?\s+(?:the\s+)?fleet\s+(?:status|doing)/,
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
    execute: async () => ({}),
  }),

  pattern('system.capabilities', 'system.capabilities', 'List available capabilities', {
    patterns: [
      {
        regex: /(?:list|show|what)\s+(?:my\s+)?(?:capabilities|commands|actions)|what\s+can\s+(?:you|i)\s+do/,
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
    execute: async () => ({}),
  }),

  pattern('system.workspace', 'system.workspace', 'Show current workspace', {
    patterns: [
      {
        regex: /(?:what'?s?\s+)?(?:my|the)\s+workspace|where\s+(?:is|am)\s+(?:my|i|the)\s+(?:workspace|working\s+directory)/,
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
    execute: async () => ({}),
  }),
]

// ── Export all patterns ───────────────────────────────────────────────────

export function getDefaultCommandPatterns(): CommandPattern[] {
  return [
    ...filePatterns,
    ...browserPatterns,
    ...llmPatterns,
    ...emailPatterns,
    ...appPatterns,
    ...conversationPatterns,
    ...systemPatterns,
  ]
}

export function getPatternsByCategory(): Record<string, CommandPattern[]> {
  const all = getDefaultCommandPatterns()
  const result: Record<string, CommandPattern[]> = {}
  for (const p of all) {
    if (!result[p.category]) result[p.category] = []
    result[p.category]!.push(p)
  }
  return result
}
