// src/engines/nlcl/prerouter.ts
// Tier 3 unit 15.11 — Prerouter with live-fetch.
//
// Closes audit finding A.7: the previous implementation (planned in the design
// doc but never implemented) hardcoded a LOCAL_INTENTS regex table to route
// purely-local commands (help, clear, reset) without consulting the catalog.
// This had two problems:
//   1. The table drifted from the actual command registry — commands renamed
//      in catalog.ts were not updated in LOCAL_INTENTS, causing silent
//      misroutes.
//   2. The "local vs remote" decision was based on the regex match, not on
//      the command's actual executor/tags. A command that LOOKED local
//      (matched the regex) but had `executor: 'browser'` would be incorrectly
//      routed as local.
//
// New approach:
//   • Fetch the live command list from the engine's CommandPatternRegistry.
//   • Derive `route: 'local' | 'remote'` from each command's `executor` and
//     `tags` fields — `executor ∈ {system, file}` OR `tags.includes('local')`
//     → local; everything else → remote.
//   • Match the raw input against the local commands' patterns first; if a
//     match is found, return a ParsedIntent marked `route: 'local'` so the
//     engine can short-circuit remote-capability execution.
//   • If no local match, return null — the engine proceeds to the full
//     5-layer resolver.
//
// This is a true "pre" router — it runs BEFORE the resolver and can short-
// circuit the entire pipeline for trivially-local commands, saving the cost
// of fuzzy/semantic/LLM retrieval for commands like "help" or "clear".

import type { CommandPatternRegistry } from './command-registry.js'
import { buildIntentFromPattern } from './pattern-match.js'
import type { CommandPattern, NLCContext, ParsedIntent } from './types.js'

/** The set of executors that are always local (no provider/slave needed). */
const LOCAL_EXECUTORS = new Set(['system', 'file'])

export interface PrerouterResult {
  intent: ParsedIntent
  /** 'local' = can execute in-process; 'remote' = needs provider/slave. */
  route: 'local' | 'remote'
}

export interface PrerouterOpts {
  /**
   * Override the local-executor set. Defaults to {system, file}.
   * Useful for tests / custom executors.
   */
  localExecutors?: Set<string>
  /** Pattern matching options. */
  minConfidence?: number
}

export class Prerouter {
  private readonly registry: CommandPatternRegistry
  private readonly localExecutors: Set<string>
  private readonly minConfidence: number
  /** Cache of local patterns; invalidated when registry size changes. */
  private cachedLocalPatterns: CommandPattern[] = []
  private cachedRegistrySize = -1

  constructor(registry: CommandPatternRegistry, opts?: PrerouterOpts) {
    this.registry = registry
    this.localExecutors = opts?.localExecutors ?? LOCAL_EXECUTORS
    this.minConfidence = opts?.minConfidence ?? 0.5
  }

  /**
   * Try to match the raw input against local-only commands.
   * Returns null if no local match — caller should proceed to the full resolver.
   */
  match(rawInput: string, ctx: NLCContext): PrerouterResult | null {
    this.refreshCache()
    if (this.cachedLocalPatterns.length === 0) return null

    // Walk local patterns in priority order; first match wins.
    for (const pattern of this.cachedLocalPatterns) {
      if (!pattern.surfaces.includes(ctx.surface as never)) continue
      const intent = this.tryMatch(pattern, rawInput)
      if (intent) {
        return { intent, route: 'local' }
      }
    }
    return null
  }

  /** Live-fetch the list of local commands (for the /api/nlcl/commands?route=local endpoint). */
  listLocalCommands(): CommandPattern[] {
    this.refreshCache()
    return [...this.cachedLocalPatterns]
  }

  /** Live-fetch the full command list with route annotations. */
  listAllWithRoutes(): Array<{ pattern: CommandPattern; route: 'local' | 'remote' }> {
    const all = this.registry.list()
    return all.map((pattern) => ({
      pattern,
      route: this.isLocal(pattern) ? 'local' : 'remote',
    }))
  }

  private refreshCache(): void {
    const size = this.registry.size()
    if (size === this.cachedRegistrySize && this.cachedLocalPatterns.length >= 0) return
    this.cachedLocalPatterns = this.registry
      .list()
      .filter((p) => this.isLocal(p))
      .sort((a, b) => priorityFor(b) - priorityFor(a))
    this.cachedRegistrySize = size
  }

  private isLocal(pattern: CommandPattern): boolean {
    if (this.localExecutors.has(pattern.executor)) return true
    if (pattern.tags.includes('local')) return true
    return false
  }

  private tryMatch(pattern: CommandPattern, rawInput: string): ParsedIntent | null {
    for (const np of pattern.patterns) {
      const match = rawInput.match(np.regex)
      if (!match) continue
      const input = np.extract(match, rawInput)
      // Validate against the pattern's input schema (loose — just check required fields exist).
      const validation = pattern.inputSchema.safeParse(input)
      if (!validation.success) continue
      const confidence = Math.max(0.8, 1 - 0.05 * pattern.patterns.indexOf(np))
      return buildIntentFromPattern(pattern, rawInput, confidence, 'prerouter:local')
    }
    return null
  }
}

/** Higher priority = checked first. Patterns with `priority: 10` beat `priority: 1`. */
function priorityFor(pattern: CommandPattern): number {
  let max = 0
  for (const p of pattern.patterns) {
    if (p.priority > max) max = p.priority
  }
  return max
}
