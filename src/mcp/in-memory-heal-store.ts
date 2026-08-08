// src/mcp/in-memory-heal-store.ts
// In-memory SelectorHealStore impl for the standalone MCP server. The repo has
// no persisted SelectorHealStore implementation; the MCP server runs standalone
// (no vivim DB writes), so strategies live in memory for the process lifetime.

import type {
  SelectorHealStore,
  SelectorStrategyRow,
} from '../storage/contracts/selector-heal-store.js'

export class InMemoryHealStore implements SelectorHealStore {
  private rows = new Map<string, SelectorStrategyRow>()

  async upsertStrategy(input: {
    targetKey: string
    selectorFormat: string
    mode: string
    semanticData?: Record<string, unknown>
  }): Promise<SelectorStrategyRow> {
    const existing = this.rows.get(input.targetKey)
    const now = Date.now()
    const row: SelectorStrategyRow = {
      id: existing?.id ?? `mem_${input.targetKey}`,
      targetKey: input.targetKey,
      selectorFormat: input.selectorFormat,
      mode: input.mode,
      semanticData: input.semanticData ?? {},
      healCount: existing?.healCount ?? 0,
      lastUsed: now,
      createdAt: existing?.createdAt ?? now,
    }
    this.rows.set(input.targetKey, row)
    return row
  }

  async getStrategy(targetKey: string): Promise<SelectorStrategyRow | null> {
    return this.rows.get(targetKey) ?? null
  }

  async bumpHealCount(targetKey: string): Promise<void> {
    const row = this.rows.get(targetKey)
    if (row) this.rows.set(targetKey, { ...row, healCount: row.healCount + 1 })
  }

  async recordUse(targetKey: string): Promise<void> {
    const row = this.rows.get(targetKey)
    if (row) this.rows.set(targetKey, { ...row, lastUsed: Date.now() })
  }
}
