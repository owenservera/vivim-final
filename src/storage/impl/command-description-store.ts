// ─── Command Description Store Implementation ────────────────────────
// Prisma-backed NLP description + pattern lookup for the command language system.

import type {
  CommandDescriptionRow,
  CommandDescriptionStore,
} from '../contracts/command-description-store.js'

/**
 * In-memory command description store.
 * For v1, we use an in-memory cache populated from the seed script.
 */
export class CommandDescriptionStoreImpl implements CommandDescriptionStore {
  private descriptions: Map<string, CommandDescriptionRow> = new Map()

  async getAllEnabled(): Promise<CommandDescriptionRow[]> {
    return Array.from(this.descriptions.values()).filter((d) => d.enabled)
  }

  async getByCategory(category: string): Promise<CommandDescriptionRow[]> {
    return Array.from(this.descriptions.values()).filter(
      (d) => d.category === category && d.enabled,
    )
  }

  async getByCommandId(commandId: string): Promise<CommandDescriptionRow | null> {
    return this.descriptions.get(commandId) ?? null
  }

  async getByPrefix(prefix: string): Promise<CommandDescriptionRow[]> {
    return Array.from(this.descriptions.values()).filter((d) => d.prefix === prefix && d.enabled)
  }

  async upsert(row: CommandDescriptionRow): Promise<void> {
    this.descriptions.set(row.commandId, row)
  }

  /**
   * Load descriptions from an array (e.g., from seed data or DB).
   */
  load(rows: CommandDescriptionRow[]): void {
    for (const row of rows) {
      this.descriptions.set(row.commandId, row)
    }
  }
}
