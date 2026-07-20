// ─── Command Store Contract ─────────────────────────────────────────
// MRU persistence + command lookup for the command language system.

export interface CommandStore {
  /**
   * Get the MRU (Most Recently Used) command IDs for a user.
   */
  getMRU(userId: string, limit?: number): Promise<string[]>

  /**
   * Record a command as recently used.
   */
  recordMRU(userId: string, commandId: string): Promise<void>

  /**
   * Clear MRU history for a user.
   */
  clearMRU(userId: string): Promise<void>
}
