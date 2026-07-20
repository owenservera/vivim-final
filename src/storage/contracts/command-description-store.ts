// ─── Command Description Store Contract ──────────────────────────────
// NLP description + pattern lookup for the command language system.

export interface CommandDescriptionStore {
  /**
   * Get all enabled command descriptions.
   */
  getAllEnabled(): Promise<CommandDescriptionRow[]>

  /**
   * Get command descriptions by category.
   */
  getByCategory(category: string): Promise<CommandDescriptionRow[]>

  /**
   * Get a command description by command ID.
   */
  getByCommandId(commandId: string): Promise<CommandDescriptionRow | null>

  /**
   * Get command descriptions by prefix.
   */
  getByPrefix(prefix: string): Promise<CommandDescriptionRow[]>

  /**
   * Create or update a command description.
   */
  upsert(row: CommandDescriptionRow): Promise<void>
}

export interface CommandDescriptionRow {
  id: string
  commandId: string
  description: string
  patterns: string[]
  category: string
  prefix: string | null
  confidence: number
  enabled: boolean
}
