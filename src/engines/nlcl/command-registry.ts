// src/engines/nlcl/command-registry.ts
// CommandPatternRegistry — kernel-level registry for NL command patterns.
// Every command the system understands is registered here at boot time.
// Patterns auto-derive from UnifiedCapabilityRegistry + explicit consumer catalog.

import { EngineError } from '../../errors.js'
import type { CommandPattern, NLCLSurface } from './types.js'

type RegisterCallback = (pattern: CommandPattern) => void

export class CommandPatternRegistry {
  private patterns = new Map<string, CommandPattern>()
  private intentIndex = new Map<string, CommandPattern>()
  private categoryIndex = new Map<string, Set<string>>()
  private surfaceIndex = new Map<string, Set<string>>()
  private registerCallbacks: Set<RegisterCallback> = new Set()

  register(pattern: CommandPattern): void {
    if (this.patterns.has(pattern.id)) {
      throw new EngineError(`CommandPattern ${pattern.id} already registered`)
    }
    if (this.intentIndex.has(pattern.intent)) {
      throw new EngineError(
        `Intent ${pattern.intent} already registered by ${this.intentIndex.get(pattern.intent)?.id}`,
      )
    }
    this.patterns.set(pattern.id, pattern)
    this.intentIndex.set(pattern.intent, pattern)

    const catSet = this.categoryIndex.get(pattern.category) ?? new Set()
    catSet.add(pattern.id)
    this.categoryIndex.set(pattern.category, catSet)

    for (const surface of pattern.surfaces) {
      const surfSet = this.surfaceIndex.get(surface) ?? new Set()
      surfSet.add(pattern.id)
      this.surfaceIndex.set(surface, surfSet)
    }

    for (const cb of this.registerCallbacks) {
      try {
        cb(pattern)
      } catch {
        /* callback errors are non-fatal */
      }
    }
  }

  unregister(id: string): void {
    const pattern = this.patterns.get(id)
    if (!pattern) throw new EngineError(`CommandPattern ${id} not found`)
    this.patterns.delete(id)
    this.intentIndex.delete(pattern.intent)
    const catSet = this.categoryIndex.get(pattern.category)
    if (catSet) {
      catSet.delete(id)
      if (catSet.size === 0) this.categoryIndex.delete(pattern.category)
    }
    for (const surface of pattern.surfaces) {
      const surfSet = this.surfaceIndex.get(surface)
      if (surfSet) {
        surfSet.delete(id)
        if (surfSet.size === 0) this.surfaceIndex.delete(surface)
      }
    }
  }

  get(id: string): CommandPattern | undefined {
    return this.patterns.get(id)
  }

  getByIntent(intent: string): CommandPattern | undefined {
    return this.intentIndex.get(intent)
  }

  /** Get pattern by id (alias for get for semantic clarity). */
  getPattern(id: string): CommandPattern | undefined {
    return this.patterns.get(id)
  }

  list(filter?: {
    category?: string
    surface?: NLCLSurface
    executor?: string
    tag?: string
  }): CommandPattern[] {
    let ids: Set<string> | undefined

    if (filter?.category) {
      ids = this.categoryIndex.get(filter.category)
      if (!ids) return []
    }
    if (filter?.surface) {
      const surfIds = this.surfaceIndex.get(filter.surface)
      if (!surfIds) return []
      ids = ids ? new Set([...ids].filter((id) => surfIds.has(id))) : surfIds
    }

    let result: CommandPattern[]
    if (ids) {
      result = [...ids].map((id) => this.patterns.get(id)!).filter(Boolean)
    } else {
      result = [...this.patterns.values()]
    }

    if (filter?.executor) {
      result = result.filter((p) => p.executor === filter.executor)
    }
    if (filter?.tag) {
      result = result.filter((p) => p.tags.includes(filter.tag!))
    }
    return result
  }

  listByCategory(): Record<string, CommandPattern[]> {
    const result: Record<string, CommandPattern[]> = {}
    for (const [category, ids] of this.categoryIndex) {
      result[category] = [...ids].map((id) => this.patterns.get(id)!).filter(Boolean)
    }
    return result
  }

  search(query: string): CommandPattern[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return [...this.patterns.values()].filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.intent.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.aliases.some((a) => a.toLowerCase().includes(q)) ||
        p.examples.some((e) => e.toLowerCase().includes(q)) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }

  onRegister(callback: RegisterCallback): () => void {
    this.registerCallbacks.add(callback)
    return () => {
      this.registerCallbacks.delete(callback)
    }
  }

  size(): number {
    return this.patterns.size
  }

  exportForSurface(surface: NLCLSurface): Array<{
    id: string
    intent: string
    description: string
    examples: string[]
    aliases: string[]
    category: string
  }> {
    return this.list({ surface }).map((p) => ({
      id: p.id,
      intent: p.intent,
      description: p.description,
      examples: p.examples,
      aliases: p.aliases,
      category: p.category,
    }))
  }
}
