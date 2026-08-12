// src/engines/stream-parser.ts
// StreamParserEngine — parse raw provider responses into typed ContentBlock[] (04-merged-engines.md §3).
// All parser logic loaded from DB — engine is a loader/executor, not a parser repository.
// Fallback chain: provider → generic → system → error (all from DB).
//
// ContentBlock is the canonical ContentPart from schema/streaming.
// Legacy {kind,content,index} blocks from seed parsers are auto-migrated at the boundary.

import { EngineError } from '../errors.js'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import { ContentPartSchema, isLegacyBlock, migrateLegacyParts } from '../schema/streaming.js'

const log = getLogger('stream-parser')
import type { ContentPart } from '../schema/streaming.js'
import type { ParserExecutionLogStore } from '../storage/contracts/parser-execution-log-store.js'
import type { ParserStore, ProviderParserRow } from '../storage/contracts/parser-store.js'
import { repairLowConfidenceParser } from './parser-repair.js'
import { SandboxRunner } from './sandbox-runner.js'
import type { SandboxPermissions } from './sandbox-runner.js'

export type ContentBlock = ContentPart

export interface ParserModule {
  name: string
  version: number
  providerId: string
  parse(rawBody: string): ContentBlock[]
  detectCompletion(rawBody: string): boolean
  getConfidence(rawBody: string): number
}

/** Block-level classification counts for diagnostics. */
export interface BlockDiagnostics {
  textBlocks: number
  toolCallBlocks: number
  fileBlocks: number
  errorBlocks: number
  reasoningBlocks: number
  codeBlocks: number
  sourceBlocks: number
}

/** Wire format detection for diagnostics. */
export type WireFormat =
  | 'sse'
  | 'ndjson'
  | 'json-array'
  | 'batchexecute'
  | 'xssi'
  | 'plain-text'
  | 'unknown'

export interface ParseResult {
  blocks: ContentBlock[]
  confidence: number
  parserName: string
  parserVersion: number
  durationMs: number
  /** Block-level classification counts. */
  blockDiagnostics: BlockDiagnostics
  /** Detected wire format of the raw input. */
  wireFormat: WireFormat
  /** Number of fallback parsers tried before success. */
  fallbackDepth: number
  /** Size of the raw input in bytes. */
  rawSizeBytes: number
}

export interface ParserConfig {
  fallbackTimeoutMs: number
  maxRetries: number
  confidenceMinThreshold: number
  preloadProviders?: string[]
  /**
   * When false (default), the engine NEVER executes parser logic loaded from a
   * file on disk — only DB-stored `inline`/`composed` logic is executed. This
   * enforces the architectural rule that parsing logic lives in the DB, and
   * code only executes it by need. Set true only for trusted, out-of-band
   * file-based parser loading (e.g. local dev).
   */
  allowFileLogic?: boolean
}

function errorBlock(_providerId: string, message: string): ContentBlock[] {
  return [{ type: 'error', message, code: 'PARSE_FAILED' }]
}

// ── Diagnostic helpers ────────────────────────────────────────────────────

function classifyBlocks(blocks: ContentBlock[]): BlockDiagnostics {
  const diag: BlockDiagnostics = {
    textBlocks: 0,
    toolCallBlocks: 0,
    fileBlocks: 0,
    errorBlocks: 0,
    reasoningBlocks: 0,
    codeBlocks: 0,
    sourceBlocks: 0,
  }
  for (const b of blocks) {
    switch (b.type) {
      case 'text':
        diag.textBlocks++
        break
      case 'tool-call':
        diag.toolCallBlocks++
        break
      case 'file':
        diag.fileBlocks++
        break
      case 'error':
        diag.errorBlocks++
        break
      case 'reasoning':
        diag.reasoningBlocks++
        break
      case 'code':
        diag.codeBlocks++
        break
      case 'source':
        diag.sourceBlocks++
        break
    }
  }
  return diag
}

function detectWireFormat(raw: string): WireFormat {
  const trimmed = raw.trimStart()
  if (trimmed.startsWith('data:') || trimmed.includes('\n\n')) {
    if (trimmed.includes('data:')) return 'sse'
  }
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) return 'json-array'
    } catch (e) {
      catchDebug(e, 'stream-parser: JSON detection partial')
    }
  }
  if (trimmed.includes(")]}'") || trimmed.startsWith(')]}')) return 'xssi'
  if (trimmed.includes('$rpc')) return 'batchexecute'
  const lines = trimmed.split('\n').filter((l) => l.trim())
  if (
    lines.length > 0 &&
    lines.every((l) => {
      try {
        JSON.parse(l)
        return true
      } catch (e) {
        catchDebug(e, 'stream-parser: JSON detection failed')
        return false
      }
    })
  )
    return 'ndjson'
  if (lines.some((l) => l.startsWith('data:') || l.startsWith('event:'))) return 'sse'
  return 'plain-text'
}

// ── Legacy migration helper ───────────────────────────────────────────────
// Detects old {kind,content,index} blocks from seed parsers and converts them
// to canonical {type,text,...} ContentPart. Runs as a pass over parser output.

function normalizeBlocks(blocks: ContentBlock[]): ContentBlock[] {
  if (blocks.length === 0) return blocks
  if (isLegacyBlock(blocks[0])) {
    return migrateLegacyParts(blocks as unknown as Parameters<typeof migrateLegacyParts>[0])
  }
  return validateBlocks(blocks)
}

/**
 * Enforce the unified ContentPart contract at the parser boundary. A parser
 * (DB-inline or protocol-primed) may emit malformed parts; we drop them here
 * rather than letting bad shapes reach the ContentUnit decomposition / DB layer.
 * Returns only schema-valid parts and logs a warning for any rejected ones.
 */
function validateBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const valid: ContentBlock[] = []
  let rejected = 0
  for (const block of blocks) {
    const result = ContentPartSchema.safeParse(block)
    if (result.success) {
      valid.push(result.data as ContentBlock)
    } else {
      rejected++
    }
  }
  if (rejected > 0) {
    log.warn(`[stream-parser] rejected ${rejected} schema-invalid block(s) at boundary`)
  }
  return valid
}

export class StreamParserEngine {
  private parserCache = new Map<string, { module: ParserModule; hash: string }>()
  private inlineCache = new Map<string, ParserModule>()
  /**
   * Provider-prime cache: compiled modules from the generated protocol, keyed by
   * `${providerId}/${parserName}`. When populated by `primeFromProtocol()`, the
   * hot parse path reads ONLY from here and performs ZERO DB queries. The DB
   * fallback chain in `resolveFallbackChain()` remains as a runtime safety net.
   */
  private primedParsers = new Map<string, ParserModule>()

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
    private logStore?: ParserExecutionLogStore,
  ) {}

  async parse(rawBody: string, providerId: string): Promise<ParseResult> {
    const start = Date.now()

    // Fast path: if primed from the generated protocol, parse with zero DB reads.
    const primed = this.resolvePrimed(providerId, rawBody)
    if (primed) {
      const module = primed
      const blocks = normalizeBlocks(module.parse(rawBody))
      const confidence =
        typeof module.getConfidence === 'function' ? module.getConfidence(rawBody) : 0.5
      const result: ParseResult = {
        blocks,
        confidence,
        parserName: module.name,
        parserVersion: module.version,
        durationMs: Date.now() - start,
        blockDiagnostics: classifyBlocks(blocks),
        wireFormat: detectWireFormat(rawBody),
        fallbackDepth: 0,
        rawSizeBytes: rawBody.length,
      }
      this.logParseResult(result, providerId)
      return result
    }

    // Walk the DB-driven fallback graph (provider → fallbackParserId → …) until
    // one parser succeeds. No hardcoded tiers: the chain is entirely data.
    const chain = await this.resolveFallbackChain(providerId)
    let module: ParserModule | null = null
    let blocks: ContentBlock[] = []

    for (const row of chain) {
      try {
        module = await this.loadModuleFromRow(row)
        blocks = normalizeBlocks(module.parse(rawBody))
        break
      } catch (e) {
        catchDebug(e, 'stream-parser: module load failed')
        module = null
      }
    }

    if (!module) {
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

    const confidence =
      typeof module.getConfidence === 'function' ? module.getConfidence(rawBody) : 0.5

    const result: ParseResult = {
      blocks,
      confidence,
      parserName: module.name,
      parserVersion: module.version,
      durationMs: Date.now() - start,
      blockDiagnostics: classifyBlocks(blocks),
      wireFormat: detectWireFormat(rawBody),
      fallbackDepth: Math.max(0, chain.length - 1),
      rawSizeBytes: rawBody.length,
    }
    this.logParseResult(result, providerId)

    // Auto-repair: when confidence drops below threshold or the system fallback
    // was used, asynchronously regenerate an inline parser and persist it to DB.
    // The fire-and-forget pattern avoids blocking the parse path; the next parse
    // call will pick up the repaired parser via the cache or fallback chain.
    const threshold = this.config?.confidenceMinThreshold ?? 0.7
    if (result.confidence < threshold && this.store) {
      void repairLowConfidenceParser(this, this.store, providerId, rawBody, {
        minConfidence: threshold,
      })
        .then((report) => {
          if (report.repaired) {
            log.info(
              `[stream-parser] auto-repaired parser for ${providerId}: ${report.beforeConfidence.toFixed(3)} → ${report.afterConfidence.toFixed(3)}`,
            )
          }
        })
        .catch((err: unknown) => {
          log.warn(`[stream-parser] auto-repair failed for ${providerId}: ${String(err)}`)
        })
    }

    return result
  }

  async detectCompletion(rawBody: string, providerId: string): Promise<boolean> {
    const primed = this.resolvePrimed(providerId, rawBody)
    if (primed) return primed.detectCompletion(rawBody)

    const chain = await this.resolveFallbackChain(providerId)
    for (const row of chain) {
      try {
        const module = await this.loadModuleFromRow(row)
        return module.detectCompletion(rawBody)
      } catch (e) {
        catchDebug(e, 'stream-parser: detectCompletion failed, trying next')
      }
    }
    return true
  }

  /**
   * Resolve a parser module from the protocol-primed cache. Splits an optional
   * `@version` suffix and walks the provider's primed parsers (no DB access).
   * Returns null when the provider was not primed, falling back to the DB chain.
   */
  private resolvePrimed(
    providerId: string,
    rawBodyForSelection: string | null = null,
  ): ParserModule | null {
    if (this.primedParsers.size === 0) return null
    const [baseId, version] = providerId.split('@')
    const entries = [...this.primedParsers.entries()].filter(
      ([k]) => k === `${baseId}/` || k.startsWith(`${baseId}/`),
    )
    if (entries.length === 0) return null
    if (version) {
      const exact = this.primedParsers.get(`${baseId}/${version}`)
      if (exact) return exact
    }
    // Score every candidate parser against the actual payload and pick the
    // highest-confidence one. A blind "highest version wins" pick is wrong
    // when a provider serves multiple wire formats (e.g. gemini: batchexecute
    // RPC vs Google AI Studio SSE) — the chosen parser must understand
    // the bytes it is given, not just be the newest. Falls back to the
    // highest version when no parser reports a usable confidence.
    if (rawBodyForSelection != null) {
      let best: ParserModule | null = null
      let bestC = -1
      for (const [, mod] of entries) {
        const c =
          typeof mod.getConfidence === 'function' ? mod.getConfidence(rawBodyForSelection) : 0
        if (c > bestC) {
          bestC = c
          best = mod
        }
      }
      if (best && bestC > 0) return best
    }
    let best: ParserModule | null = null
    let bestV = -1
    for (const [, mod] of entries) {
      if (mod.version > bestV) {
        bestV = mod.version
        best = mod
      }
    }
    return best
  }

  /**
   * Resolve the chain of parser rows to try, walking the `fallbackParserId`
   * edge from the by-need resolved provider parser. `providerId` may carry an
   * `@version` suffix (e.g. `claude@2`) for semver-aware selection; `@latest`
   * or no suffix picks the highest active version.
   *
   * Guards against cycles via a visited-set. Terminal parsers (no fallback
   * edge) end the chain. This replaces the previous hardcoded
   * provider→generic→system ordering.
   */
  private async resolveFallbackChain(providerId: string): Promise<ProviderParserRow[]> {
    const atIdx = providerId.indexOf('@')
    const baseId = atIdx >= 0 ? providerId.slice(0, atIdx) : providerId
    const version = atIdx >= 0 ? providerId.slice(atIdx + 1) : 'latest'
    let start = await this.store.getParserByProviderAndVersion(baseId, version)

    // No provider-specific parser? Fall back to the generic parser so unknown
    // providers still get best-effort parsing instead of an immediate error.
    if (!start && baseId !== 'generic') {
      start = await this.store.getParserByProviderAndVersion('generic', 'latest')
    }
    if (!start) return []

    const chain: ProviderParserRow[] = []
    const visited = new Set<string>()
    let cursor: ProviderParserRow | null = start
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id)
      chain.push(cursor)
      if (!cursor.fallbackParserId) break
      cursor = await this.store.getParserById(cursor.fallbackParserId)
    }
    return chain
  }

  async reloadParser(providerId: string): Promise<void> {
    const atIdx = providerId.indexOf('@')
    const baseId = atIdx >= 0 ? providerId.slice(0, atIdx) : providerId
    const version = atIdx >= 0 ? providerId.slice(atIdx + 1) : 'latest'
    const row = await this.store.getParserByProviderAndVersion(baseId, version)
    if (row) this.parserCache.delete(row.id)
  }

  async preloadAll(): Promise<void> {
    for (const providerId of this.config?.preloadProviders ?? []) {
      try {
        const row = await this.store.getParserByProviderAndVersion(providerId, 'latest')
        if (row) await this.loadModuleFromRow(row)
      } catch (e) {
        catchDebug(e, 'stream-parser: parser load deferred')
      }
    }
  }

  /**
   * Prime the parser cache from the generated protocol's inline logic_code, so
   * the hot parse path performs ZERO DB reads. The DB-backed fallback chain
   * (resolveFallbackChain) remains as a runtime safety net if a protocol-derived
   * module is missing or fails to compile. Compiled modules are keyed by their
   * parser hash; the generated protocol carries the same hash the DB row has.
   */
  async primeFromProtocol(protocol: {
    providers: Array<{
      slug: string
      parsers: Array<{
        name: string
        version: number
        logicCode: string
        hash: string
        isActive: boolean
      }>
    }>
  }): Promise<void> {
    for (const p of protocol.providers) {
      for (const pr of p.parsers) {
        if (!pr.isActive || !pr.logicCode) continue
        try {
          const module = await this.loadInlineParser(pr.logicCode, pr.hash)
          // Tag so resolvePrimed() can pick by version + fallback to highest.
          const tagged: ParserModule = {
            ...module,
            name: pr.name,
            version: pr.version,
            providerId: p.slug,
          }
          this.primedParsers.set(`${p.slug}/${pr.version}`, tagged)
          this.primedParsers.set(`${p.slug}/${pr.name.split('/')[1] ?? pr.version}`, tagged)
        } catch (err) {
          catchDebug(err, 'engines:stream-parser:471')
          // non-fatal: DB chain resolves it lazily on parse()
        }
      }
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async loadModuleFromRow(row: ProviderParserRow): Promise<ParserModule> {
    const cached = this.parserCache.get(row.id)
    if (cached && cached.hash === row.hash) return cached.module

    let module: ParserModule

    if (row.logicType === 'inline' && row.logicCode) {
      module = await this.loadInlineParser(row.logicCode, row.hash)
    } else if (row.logicType === 'file' && row.filePath) {
      // File-based parser loading is gated: off by default so the engine only
      // ever executes DB-stored logic. See ParserConfig.allowFileLogic.
      if (!this.config?.allowFileLogic) {
        throw new EngineError(
          `Parser '${row.name}' uses file logic but allowFileLogic is false — parsing logic must live in the DB`,
        )
      }
      module = await this.loadFileParser(row.filePath)
    } else {
      throw new EngineError(`Parser '${row.name}' has no logic (logicType=${row.logicType})`)
    }

    this.parserCache.set(row.id, { module, hash: row.hash })
    return module
  }

  private async loadInlineParser(code: string, hash: string): Promise<ParserModule> {
    const cached = this.inlineCache.get(hash)
    if (cached) return cached

    const mod = { exports: {} as Record<string, unknown> }

    if (!this.sandbox) {
      this.sandbox = new SandboxRunner({
        create: async () => {},
        list: async () => [],
      })
    }

    const res = await this.sandbox.run(code, {}, StreamParserEngine.SANDBOX_PERMISSIONS, {
      handlerSlug: `parser:${hash}`,
      globals: { module: mod, exports: mod.exports },
    })
    if (!res.ok) {
      throw new EngineError(
        `Failed to compile inline parser in sandbox: ${res.error ?? 'unknown sandbox error'}`,
      )
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

  /**
   * Best-effort diagnostic logging. Failures are swallowed — logging must never
   * break the parse path. When logStore is absent (default), this is a no-op.
   */
  private logParseResult(result: ParseResult, providerId: string): void {
    if (!this.logStore) return
    const d = result.blockDiagnostics
    void this.logStore
      .logExecution({
        providerId,
        parserName: result.parserName,
        parserVersion: result.parserVersion,
        conversationId: null,
        messageId: null,
        confidence: result.confidence,
        blockCount: result.blocks.length,
        textBlocks: d.textBlocks,
        toolCallBlocks: d.toolCallBlocks,
        fileBlocks: d.fileBlocks,
        errorBlocks: d.errorBlocks,
        durationMs: result.durationMs,
        rawSizeBytes: result.rawSizeBytes,
        wireFormat: result.wireFormat,
        fallbackUsed: result.fallbackDepth > 0 ? 1 : 0,
        metadataJson: JSON.stringify({
          reasoningBlocks: d.reasoningBlocks,
          codeBlocks: d.codeBlocks,
          sourceBlocks: d.sourceBlocks,
          fallbackDepth: result.fallbackDepth,
        }),
      })
      .catch(() => {}) // swallow — diagnostic logging is best-effort
  // [audit] log the error with context here
  }
}
