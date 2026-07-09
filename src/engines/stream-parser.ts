// src/engines/stream-parser.ts
// StreamParserEngine — parse raw provider responses into typed ContentBlock[] (04-merged-engines.md §3).
// Loads parser modules from .ts seed files via dynamic import(); falls back to built-in
// generic/system parsers when a seed is unavailable, preserving the spec's fallback chain.

import type { ParserStore } from '../storage/contracts/parser-store.js'

export type ContentBlock =
  | { kind: 'text'; content: string; index: number }
  | { kind: 'thinking'; content: string; index: number }
  | { kind: 'code'; content: string; language?: string; index: number }
  | { kind: 'artifact'; content: string; artifactType?: string; index: number }
  | { kind: 'image'; url: string; alt?: string; index: number }
  | { kind: 'citation'; content: string; source?: string; index: number }
  | { kind: 'tool_use'; toolName: string; input: Record<string, unknown>; index: number }
  | { kind: 'error'; message: string; code?: string; index: number }
  | { kind: 'meta'; key: string; value: unknown; index: number }

export interface ParserModule {
  name: string
  version: number
  providerId: string
  parse(rawBody: string): ContentBlock[]
  detectCompletion(rawBody: string): boolean
  getConfidence(rawBody: string): number
}

export interface ParseResult {
  blocks: ContentBlock[]
  confidence: number
  parserName: string
  parserVersion: number
  durationMs: number
}

export interface ParserConfig {
  fallbackTimeoutMs: number
  maxRetries: number
  confidenceMinThreshold: number
  genericFilePath?: string
  fallbackFilePath?: string
  preloadProviders?: string[]
}

// ── Built-in parsers (used when a seed module is unavailable) ───────────────

function builtinClaude(): ParserModule {
  return {
    name: 'claude/001_streaming_sse',
    version: 1,
    providerId: 'claude',
    parse(rawBody: string): ContentBlock[] {
      const blocks: ContentBlock[] = []
      let index = 0
      for (const line of rawBody.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') break
        try {
          const json = JSON.parse(payload)
          const delta = json.delta ?? {}
          if (typeof delta.thinking === 'string') {
            blocks.push({ kind: 'thinking', content: delta.thinking, index: index++ })
          }
          if (typeof delta.content === 'string') {
            blocks.push({ kind: 'text', content: delta.content, index: index++ })
          }
        } catch {
          // skip non-JSON data lines
        }
      }
      if (blocks.length === 0) blocks.push({ kind: 'text', content: rawBody, index: 0 })
      return blocks
    },
    detectCompletion(rawBody: string): boolean {
      return rawBody.includes('[DONE]')
    },
    getConfidence(): number {
      return 0.9
    },
  }
}

function builtinGeneric(): ParserModule {
  return {
    name: 'generic/001_sse_frames',
    version: 1,
    providerId: 'generic',
    parse(rawBody: string): ContentBlock[] {
      const blocks: ContentBlock[] = []
      let index = 0
      for (const frame of rawBody.split('\n\n')) {
        for (const line of frame.split('\n')) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data:')) {
            blocks.push({ kind: 'text', content: trimmed.slice(5).trim(), index: index++ })
          }
        }
      }
      if (blocks.length === 0) blocks.push({ kind: 'text', content: rawBody, index: 0 })
      return blocks
    },
    detectCompletion(rawBody: string): boolean {
      return rawBody.length > 0
    },
    getConfidence(): number {
      return 0.6
    },
  }
}

function builtinSystemFallback(): ParserModule {
  return {
    name: 'system/001_fallback',
    version: 1,
    providerId: 'system',
    parse(rawBody: string): ContentBlock[] {
      return [{ kind: 'text', content: rawBody, index: 0 }]
    },
    detectCompletion(): boolean {
      return true
    },
    getConfidence(): number {
      return 0.3
    },
  }
}

const BUILTIN = {
  claude: builtinClaude,
  gemini: builtinGeneric,
  chatgpt: builtinGeneric,
  generic: builtinGeneric,
} as const

function getBuiltin(key: string): () => ParserModule {
  if (key in BUILTIN) return BUILTIN[key as keyof typeof BUILTIN]
  return BUILTIN.generic
}

function errorBlock(_providerId: string, message: string): ContentBlock[] {
  return [{ kind: 'error', message, code: 'PARSE_FAILED', index: 0 }]
}

export class StreamParserEngine {
  private parserCache = new Map<string, { module: ParserModule; hash: string }>()

  constructor(
    private store: ParserStore,
    private config?: ParserConfig,
  ) {}

  async parse(rawBody: string, providerId: string): Promise<ParseResult> {
    const start = Date.now()
    let module: ParserModule
    let blocks: ContentBlock[]

    try {
      module = await this.loadProviderParser(providerId)
      blocks = module.parse(rawBody)
    } catch {
      try {
        module = await this.loadGenericFallback()
        blocks = module.parse(rawBody)
      } catch {
        try {
          module = await this.loadSystemFallback()
          blocks = module.parse(rawBody)
        } catch {
          blocks = errorBlock(providerId, 'all parsers failed')
          module = {
            name: 'error',
            version: 0,
            providerId,
            parse: () => blocks,
            detectCompletion: () => true,
            getConfidence: () => 0,
          }
        }
      }
    }

    const confidence =
      typeof module.getConfidence === 'function' ? module.getConfidence(rawBody) : 0.5

    return {
      blocks,
      confidence,
      parserName: module.name,
      parserVersion: module.version,
      durationMs: Date.now() - start,
    }
  }

  async detectCompletion(rawBody: string, providerId: string): Promise<boolean> {
    try {
      const module = await this.loadProviderParser(providerId)
      return module.detectCompletion(rawBody)
    } catch {
      try {
        return (await this.loadGenericFallback()).detectCompletion(rawBody)
      } catch {
        return (await this.loadSystemFallback()).detectCompletion(rawBody)
      }
    }
  }

  async reloadParser(providerId: string): Promise<void> {
    this.parserCache.delete(providerId)
    await this.loadProviderParser(providerId)
  }

  async preloadAll(): Promise<void> {
    await this.loadSystemFallback()
    for (const providerId of this.config?.preloadProviders ?? []) {
      try {
        await this.loadProviderParser(providerId)
      } catch {
        // non-fatal: missing parser is handled lazily on parse()
      }
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async loadProviderParser(providerId: string): Promise<ParserModule> {
    const row = await this.store.getActiveParser(providerId)
    if (!row) return this.loadBuiltin(providerId)
    const cached = this.parserCache.get(providerId)
    if (cached && cached.hash === row.hash) return cached.module
    const module = await this.resolveModule(row.filePath, row.providerId)
    this.parserCache.set(providerId, { module, hash: row.hash })
    return module
  }

  private async loadGenericFallback(): Promise<ParserModule> {
    return this.resolveModule(this.config?.genericFilePath, 'generic')
  }

  private async loadSystemFallback(): Promise<ParserModule> {
    return this.resolveModule(this.config?.fallbackFilePath, 'system')
  }

  private async resolveModule(
    filePath: string | undefined,
    builtinKey: string,
  ): Promise<ParserModule> {
    if (filePath) {
      const imported = await import(filePath)
      const candidate = (imported.default ?? imported) as Partial<ParserModule>
      if (typeof candidate.parse !== 'function') {
        throw new Error(`Parser module at ${filePath} has no parse() method`)
      }
      return candidate as ParserModule
    }
    const factory = getBuiltin(builtinKey)
    return factory()
  }

  private loadBuiltin(providerId: string): ParserModule {
    return getBuiltin(providerId)()
  }
}
