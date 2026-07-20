// ─── Autocomplete Engine ────────────────────────────────────────────
// Debounced suggestion provider with abort support.

import type { CommandContext, Suggestion, UnifiedCommandSpec } from './types.js'

/**
 * AutocompleteEngine provides debounced command suggestions.
 */
export class AutocompleteEngine {
  private abortController: AbortController | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly debounceMs = 150
  private readonly maxResults = 10

  private specs: UnifiedCommandSpec[] = []

  /**
   * Load command specs for autocomplete.
   */
  loadSpecs(specs: UnifiedCommandSpec[]): void {
    this.specs = specs
  }

  /**
   * Get suggestions for input, debounced.
   */
  suggest(input: string, ctx: CommandContext): Promise<Suggestion[]> {
    // Cancel previous request
    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()

    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      this.debounceTimer = setTimeout(() => {
        const results = this.getSuggestions(input, ctx)
        resolve(results)
      }, this.debounceMs)
    })
  }

  /**
   * Get suggestions immediately (no debounce).
   */
  suggestImmediate(input: string, ctx: CommandContext): Suggestion[] {
    return this.getSuggestions(input, ctx)
  }

  /**
   * Cancel any pending suggestion request.
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  private getSuggestions(input: string, ctx: CommandContext): Suggestion[] {
    if (!input.trim()) return []

    const query = input.toLowerCase().trim()
    const suggestions: Suggestion[] = []

    for (const spec of this.specs) {
      // Check if spec is available on current surfaces
      if (!spec.surfaces.includes('cli') && !spec.surfaces.includes('ui')) {
        continue
      }

      // Check when gate
      if (spec.when && !spec.when(ctx)) {
        continue
      }

      // Match against title, id, and aliases
      const titleMatch = spec.title.toLowerCase().includes(query)
      const idMatch = spec.id.toLowerCase().includes(query)
      const aliasMatch = spec.aliases?.some((a) => a.toLowerCase().includes(query))

      if (titleMatch || idMatch || aliasMatch) {
        const score = this.calculateScore(query, spec)
        suggestions.push({
          id: spec.id,
          title: spec.title,
          category: spec.category,
          prefix: spec.prefix,
          score,
        })
      }
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score)

    return suggestions.slice(0, this.maxResults)
  }

  private calculateScore(query: string, spec: UnifiedCommandSpec): number {
    let score = 0

    // Exact match on id
    if (spec.id.toLowerCase() === query) {
      score += 100
    }

    // Starts with query
    if (spec.id.toLowerCase().startsWith(query)) {
      score += 50
    }

    // Contains query
    if (spec.id.toLowerCase().includes(query)) {
      score += 25
    }

    // Title match
    if (spec.title.toLowerCase().includes(query)) {
      score += 20
    }

    // Alias match
    if (spec.aliases?.some((a) => a.toLowerCase().includes(query))) {
      score += 30
    }

    return score
  }
}
