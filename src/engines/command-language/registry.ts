import { resolveCommand } from './resolver.js'
import type { CommandContext, ParsedCommand, UnifiedCommandSpec } from './types.js'

const MRU_LIMIT = 10

export class CommandLanguageRegistry {
  private commands = new Map<string, UnifiedCommandSpec>()
  private mru: string[] = []

  /**
   * Register a command spec. Deduplicates by id (keeps first).
   */
  register(spec: UnifiedCommandSpec): void {
    if (!this.commands.has(spec.id)) {
      this.commands.set(spec.id, spec)
    }
  }

  /**
   * Resolve a parsed command against registered specs.
   */
  resolve(parsed: ParsedCommand, ctx: CommandContext): UnifiedCommandSpec | null {
    return resolveCommand(parsed, ctx, this.getAll(), this.getMRU())
  }

  /**
   * Get a command by its id.
   */
  getById(id: string): UnifiedCommandSpec | undefined {
    return this.commands.get(id)
  }

  /**
   * List all commands with a given prefix.
   */
  listByPrefix(prefix: string): UnifiedCommandSpec[] {
    return this.getAll().filter((s) => s.prefix === prefix)
  }

  /**
   * List all commands in a given category.
   */
  listByCategory(category: string): UnifiedCommandSpec[] {
    return this.getAll().filter((s) => s.category === category)
  }

  /**
   * Get all registered commands.
   */
  getAll(): UnifiedCommandSpec[] {
    return Array.from(this.commands.values())
  }

  /**
   * Get most recently used command ids.
   */
  getMRU(): string[] {
    return [...this.mru]
  }

  /**
   * Record a command as recently used.
   */
  recordMRU(id: string): void {
    const idx = this.mru.indexOf(id)
    if (idx >= 0) {
      this.mru.splice(idx, 1)
    }
    this.mru.unshift(id)
    if (this.mru.length > MRU_LIMIT) {
      this.mru = this.mru.slice(0, MRU_LIMIT)
    }
  }
}
