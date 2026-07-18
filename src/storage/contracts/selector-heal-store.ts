// src/storage/contracts/selector-heal-store.ts
// Store Contract for persisted selector strategies (SelectorHealer audit trail).
// Engines depend on this contract only (never the impl).

export interface SelectorStrategyRow {
  id: string
  /** The logical capability target key (e.g. "github:submit" or sha of selector). */
  targetKey: string
  /** Final working selector format. */
  selectorFormat: string
  /** Mode that produced it (aria|css|text|xpath|healed...). */
  mode: string
  /** Free-form semantic metadata (original description, last url). */
  semanticData: Record<string, unknown>
  /** How many times this selector was repaired. */
  healCount: number
  lastUsed: number
  createdAt: number
}

export interface SelectorHealStore {
  upsertStrategy(input: {
    targetKey: string
    selectorFormat: string
    mode: string
    semanticData?: Record<string, unknown>
  }): Promise<SelectorStrategyRow>
  getStrategy(targetKey: string): Promise<SelectorStrategyRow | null>
  bumpHealCount(targetKey: string): Promise<void>
  recordUse(targetKey: string): Promise<void>
}
