// src/engines/local-agent/opencode-model-sync.ts
// OpenCodeModelSync — keeps vivim's verified opencode free-model allow-list fresh.
//
// Discovers models by spawning `opencode models opencode --verbose [--refresh]`
// (verified against opencode v1.18.4). The CLI emits, per model, a bare
// `opencode/<slug>` line followed by one pretty-printed JSON object carrying
// cost / context / capabilities / release metadata. This engine:
//   1. parses that stream into typed model records,
//   2. keeps only the *free* tier (cost.input === 0 && cost.output === 0 — the
//      `-free` suffix alone misses models like `big-pickle` which have zero cost
//      but no `-free` name),
//   3. persists them through LocalAgentStore.syncAgentModels (deactivating stale
//      rows and preserving the current default when it still exists),
//   4. records the sync timestamp so a daily background timer can skip when the
//      cache is still fresh.
//
// No CDP / ChromeGovernor imports (Governor Canon). No skill/docs assumptions —
// the wire format below was captured live on 2026-08-08.

import { getLogger } from '../../lib/logger.js'
import type { LocalAgentModelRow, LocalAgentStore } from '../../storage/contracts/local-agent-store.js'

const log = getLogger('opencode:model-sync')

export interface OpenCodeDiscoveredModel {
  /** Full slug as opencode reports it, e.g. `opencode/deepseek-v4-flash-free`. */
  slug: string
  /** Bare id, e.g. `deepseek-v4-flash-free`. */
  id: string
  displayName: string
  family: string
  status: string
  costInput: number
  costOutput: number
  contextWindow: number | null
  maxOutputTokens: number | null
  supportsReasoning: boolean
  supportsTools: boolean
  supportsAttachment: boolean
  releaseDate: string | null
}

export interface ModelSyncSummary {
  syncedAt: number
  totalDiscovered: number
  freeCount: number
  added: string[]
  removed: string[]
  kept: string[]
  defaultModel: string
}

export interface OpenCodeModelSyncOptions {
  binary?: string
  /** Default 24h — the interval between background resyncs. */
  intervalMs?: number
  /** Force `--refresh` (re-pull from models.dev) on each background sync. */
  refresh?: boolean
  /** Called after each successful sync (also used for tests). */
  onSync?: (summary: ModelSyncSummary) => void
}

const DEFAULT_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Is this model on the free tier? Zero cost on both input and output. */
export function isFreeModel(m: { costInput: number; costOutput: number }): boolean {
  return m.costInput === 0 && m.costOutput === 0
}

/**
 * Parse the `opencode models opencode --verbose` output: a bare `opencode/<slug>`
 * line followed by a pretty-printed JSON object. Tolerant of any stray text
 * between records (header/notice lines) — only slugs it knows how to pair with a
 * JSON block become models.
 */
export function parseOpencodeModelsVerbose(output: string): OpenCodeDiscoveredModel[] {
  const models: OpenCodeDiscoveredModel[] = []
  const lines = output.split(/\r?\n/)
  let currentSlug: string | null = null
  const jsonLines: string[] = []

  const flush = (): void => {
    if (!currentSlug || jsonLines.length === 0) return
    const json = jsonLines.join('\n')
    let raw: any
    try {
      raw = JSON.parse(json)
    } catch {
      currentSlug = null
      jsonLines.length = 0
      return
    }
    const cost = raw.cost ?? {}
    const limit = raw.limit ?? {}
    const caps = raw.capabilities ?? {}
    const costIn = typeof cost.input === 'number' ? cost.input : 0
    const costOut = typeof cost.output === 'number' ? cost.output : 0
    models.push({
      slug: currentSlug,
      id: raw.id ?? currentSlug.split('/').pop() ?? currentSlug,
      displayName: raw.name ?? currentSlug,
      family: raw.family ?? '',
      status: raw.status ?? 'active',
      costInput: costIn,
      costOutput: costOut,
      contextWindow: typeof limit.context === 'number' ? limit.context : null,
      maxOutputTokens: typeof limit.output === 'number' ? limit.output : null,
      supportsReasoning: caps.reasoning === true,
      supportsTools: caps.toolcall === true,
      supportsAttachment: caps.attachment === true,
      releaseDate: raw.release_date ? String(raw.release_date) : null,
    })
    currentSlug = null
    jsonLines.length = 0
  }

  for (const line of lines) {
    const slugMatch = line.match(/^(\S+)\/([^\s]+)\s*$/)
    if (slugMatch && !line.includes('{')) {
      flush()
      currentSlug = slugMatch[1] + '/' + slugMatch[2]
      continue
    }
    if (currentSlug) {
      jsonLines.push(line)
    }
  }
  flush()

  return models
}

export class OpenCodeModelSync {
  private store: LocalAgentStore
  private binary: string
  private intervalMs: number
  private refresh: boolean
  private onSync?: (summary: ModelSyncSummary) => void
  private timer: ReturnType<typeof setInterval> | null = null
  private syncing = false

  constructor(store: LocalAgentStore, opts: OpenCodeModelSyncOptions = {}) {
    this.store = store
    this.binary = opts.binary ?? 'opencode'
    this.intervalMs = opts.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS
    this.refresh = opts.refresh ?? false
    this.onSync = opts.onSync
  }

  /**
   * Discover all free opencode models from the CLI. Pass `refresh: true` to force
   * a re-pull from models.dev instead of the cached list.
   */
  async discover(opts: { refresh?: boolean; timeoutMs?: number } = {}): Promise<OpenCodeDiscoveredModel[]> {
    const args = ['models', 'opencode', '--verbose']
    if (opts.refresh) args.push('--refresh')
    const timeoutMs = opts.timeoutMs ?? 60_000

    const proc = Bun.spawn([this.binary, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    let timedOut = false
    let out = ''
    try {
      const timeout = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), timeoutMs),
      )
      const read = (async () => {
        const text = await new Response(proc.stdout).text()
        await proc.exited
        return text
      })()
      const race = await Promise.race([read, timeout])
      if (race === 'timeout') {
        timedOut = true
        proc.kill()
        out = (await new Response(proc.stdout).text()) ?? ''
      } else {
        out = race
      }
    } catch {
      out = ''
    }
    // NOTE: `proc.exitCode` stays null until `await proc.exited` resolves (see AGENTS.md).
    await proc.exited
    const exitCode = timedOut ? -1 : proc.exitCode
    if (exitCode !== 0) {
      const err = (await new Response(proc.stderr).text().catch(() => '')) ?? ''
      throw new Error(`opencode models failed (exit ${exitCode}): ${err.slice(0, 400)}`)
    }

    const all = parseOpencodeModelsVerbose(out)
    return all.filter(isFreeModel)
  }

  /**
   * Discover + persist the free model list. Returns a summary of what changed and
   * records the sync timestamp. Idempotent — running twice back-to-back yields
   * empty `added`/`removed`.
   */
  async sync(
    opts: { refresh?: boolean; timeoutMs?: number; defaultModel?: string } = {},
  ): Promise<ModelSyncSummary> {
    if (this.syncing) {
      throw new Error('OpenCodeModelSync: a sync is already in flight')
    }
    this.syncing = true
    try {
      const free = await this.discover(opts)
      const rows: LocalAgentModelRow[] = free.map((m) => ({
        slug: m.slug,
        displayName: m.displayName,
        isDefault: false,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        pricingInputPer1m: m.costInput,
        pricingOutputPer1m: m.costOutput,
      }))
      const result = await this.store.syncAgentModels('opencode', rows, {
        defaultModel: opts.defaultModel,
      })
      const summary: ModelSyncSummary = {
        syncedAt: Date.now(),
        totalDiscovered: free.length,
        freeCount: free.length,
        added: result.added,
        removed: result.removed,
        kept: result.kept,
        defaultModel: result.defaultModel,
      }
      log.info(
        { total: summary.freeCount, added: summary.added.length, removed: summary.removed.length },
        'opencode model sync complete',
      )
      this.onSync?.(summary)
      return summary
    } finally {
      this.syncing = false
    }
  }

  /**
   * Idempotent background daemon: syncs once at launch (skipping when the cache is
   * fresher than `intervalMs`), then every `intervalMs`. Returns a stop() handle.
   */
  start(): () => void {
    // Immediate best-effort sync (non-blocking; failures are logged, never fatal).
    void this.syncWhenStale().catch((err: unknown) => {
      log.warn({ err }, 'initial opencode model sync failed (non-fatal)')
    })

    this.timer = setInterval(() => {
      void this.syncWhenStale().catch((err: unknown) => {
        log.warn({ err }, 'scheduled opencode model sync failed (non-fatal)')
      })
    }, this.intervalMs)

    return () => this.stop()
  }

  /** Run a sync now but skip if a sync happened within the last `intervalMs`. */
  async syncWhenStale(): Promise<ModelSyncSummary> {
    const state = await this.store.getAgentModelSyncState('opencode')
    if (state.lastSyncedAt && Date.now() - state.lastSyncedAt < this.intervalMs) {
      return {
        syncedAt: state.lastSyncedAt,
        totalDiscovered: 0,
        freeCount: 0,
        added: [],
        removed: [],
        kept: [],
        defaultModel: '',
      }
    }
    return this.sync({ refresh: this.refresh })
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
