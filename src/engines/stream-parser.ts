// src/engines/stream-parser.ts
// StreamParserEngine — parse raw provider responses into typed ContentBlock[] (04-merged-engines.md §3).
// All parser logic loaded from DB — engine is a loader/executor, not a parser repository.
// Fallback chain: provider → generic → system → error (all from DB).

import { EngineError } from '../errors.js'
import type { ParserStore } from '../storage/contracts/parser-store.js'
import { assertTrustedExpressionSource } from './safe-eval.js'
import type { SandboxRunner } from './sandbox-runner.js'
import type { SandboxPermissions } from './sandbox-runner.js'

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
  preloadProviders?: string[]
}

function errorBlock(_providerId: string, message: string): ContentBlock[] {
  return [{ kind: 'error', message, code: 'PARSE_FAILED', index: 0 }]
}

export class StreamParserEngine {
  private parserCache = new Map<string, { module: ParserModule; hash: string }>()
  private inlineCache = new Map<string, ParserModule>()

  // Hardened execution environment for inline parser code (Unit 31.1). When
  // present, inline parser logic is compiled inside a frozen vm context with a
  // CPU/memory budget and an audit row — replacing the raw `new Function` path.
  private static readonly SANDBOX_PERMISSIONS: SandboxPermissions = {
    canFetch: [],
    canReadFile: [],
    canWriteFile: [],
    canUseClipboard: false,
  }

  constructor(
    private store: ParserStore,
    private config?: ParserConfig,
    private sandbox?: SandboxRunner,
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
        module = await this.loadGenericParser()
        blocks = module.parse(rawBody)
      } catch {
        try {
          module = await this.loadSystemFallbackParser()
          blocks = module.parse(rawBody)
        } catch {
          blocks = errorBlock(providerId, 'all parsers failed — check provider_parser table')
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
        return (await this.loadGenericParser()).detectCompletion(rawBody)
      } catch {
        return (await this.loadSystemFallbackParser()).detectCompletion(rawBody)
      }
    }
  }

  async reloadParser(providerId: string): Promise<void> {
    this.parserCache.delete(providerId)
    await this.loadProviderParser(providerId)
  }

  async preloadAll(): Promise<void> {
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
    if (!row) throw new EngineError(`No active parser for provider '${providerId}' in DB`)

    const cached = this.parserCache.get(providerId)
    if (cached && cached.hash === row.hash) return cached.module

    let module: ParserModule

    if (row.logicType === 'inline' && row.logicCode) {
      module = await this.loadInlineParser(row.logicCode, row.hash)
    } else if (row.logicType === 'file' && row.filePath) {
      module = await this.loadFileParser(row.filePath)
    } else {
      throw new EngineError(`Parser for '${providerId}' has no logic (logicType=${row.logicType})`)
    }

    this.parserCache.set(providerId, { module, hash: row.hash })
    return module
  }

  private async loadGenericParser(): Promise<ParserModule> {
    const row = await this.store.getGenericParser()
    if (!row) throw new EngineError('No generic parser in DB')

    const cached = this.parserCache.get('generic')
    if (cached && cached.hash === row.hash) return cached.module

    let module: ParserModule
    if (row.logicType === 'inline' && row.logicCode) {
      module = await this.loadInlineParser(row.logicCode, row.hash)
    } else if (row.logicType === 'file' && row.filePath) {
      module = await this.loadFileParser(row.filePath)
    } else {
      throw new EngineError('Generic parser has no logic')
    }

    this.parserCache.set('generic', { module, hash: row.hash })
    return module
  }

  private async loadSystemFallbackParser(): Promise<ParserModule> {
    const row = await this.store.getSystemFallbackParser()
    if (!row) throw new EngineError('No system fallback parser in DB')

    const cached = this.parserCache.get('system')
    if (cached && cached.hash === row.hash) return cached.module

    let module: ParserModule
    if (row.logicType === 'inline' && row.logicCode) {
      module = await this.loadInlineParser(row.logicCode, row.hash)
    } else if (row.logicType === 'file' && row.filePath) {
      module = await this.loadFileParser(row.filePath)
    } else {
      throw new EngineError('System fallback parser has no logic')
    }

    this.parserCache.set('system', { module, hash: row.hash })
    return module
  }

  private async loadInlineParser(code: string, hash: string): Promise<ParserModule> {
    const cached = this.inlineCache.get(hash)
    if (cached) return cached

    const mod = { exports: {} as Record<string, unknown> }

    if (!this.sandbox) {
      // Legacy fallback: raw host evaluation. Inline parser code is admin-defined
      // (DB-backed); prefer the SandboxRunner path above whenever available.
      try {
        // eslint-disable-next-line no-new-func
        // Trusted: inline parser code is admin-defined and DB-backed. The
        // SandboxRunner path above is preferred; this is a legacy host fallback.
        assertTrustedExpressionSource(code, 'inline parser')
        const factory = new Function('module', 'exports', code)
        factory(mod, mod.exports)
      } catch (error) {
        throw new EngineError(`Failed to compile inline parser: ${error}`)
      }
    } else {
      const res = await this.sandbox.run(code, {}, StreamParserEngine.SANDBOX_PERMISSIONS, {
        handlerSlug: `parser:${hash}`,
        globals: { module: mod, exports: mod.exports },
      })
      if (!res.ok) {
        throw new EngineError(
          `Failed to compile inline parser: ${res.error ?? 'unknown sandbox error'}`,
        )
      }
    }

    const candidate = (mod.exports.default ?? mod.exports) as Partial<ParserModule>
    if (typeof candidate.parse !== 'function') {
      throw new EngineError('Inline parser has no parse() method')
    }

    const module = candidate as ParserModule
    this.inlineCache.set(hash, module)
    return module
  }

  private async loadFileParser(filePath: string): Promise<ParserModule> {
    const imported = await import(filePath)
    const candidate = (imported.default ?? imported) as Partial<ParserModule>
    if (typeof candidate.parse !== 'function') {
      throw new EngineError(`Parser at ${filePath} has no parse() method`)
    }
    return candidate as ParserModule
  }
}
