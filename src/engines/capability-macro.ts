// src/engines/capability-macro.ts
// Stored, reusable capability DAG macros.
// Sole owner of capability_macro table.

import { newId } from '../ids.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CapabilityMacroRow {
  id: string
  name: string
  description: string | null
  providerId: string | null
  dagJson: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface MacroRunResult {
  macroId: string
  ok: boolean
  output?: unknown
  error?: string
}

export interface HarnessRuntime {
  executeDag(
    dagJson: string,
    input: Record<string, unknown>,
  ): Promise<{ ok: boolean; output?: unknown; error?: string }>
}

export interface CapabilityMacroStore {
  list(opts?: { providerId?: string; activeOnly?: boolean }): Promise<CapabilityMacroRow[]>
  get(id: string): Promise<CapabilityMacroRow | null>
  create(input: CapabilityMacroRow): Promise<CapabilityMacroRow>
  update(id: string, patch: Partial<CapabilityMacroRow>): Promise<void>
  delete(id: string): Promise<void>
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class CapabilityMacroEngine {
  constructor(
    private store: CapabilityMacroStore,
    private runtime: HarnessRuntime,
  ) {}

  async define(
    input: Omit<CapabilityMacroRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CapabilityMacroRow> {
    const now = Date.now()
    const row: CapabilityMacroRow = {
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    }
    return this.store.create(row)
  }

  async list(opts?: { providerId?: string; activeOnly?: boolean }): Promise<CapabilityMacroRow[]> {
    return this.store.list(opts)
  }

  async get(id: string): Promise<CapabilityMacroRow | null> {
    return this.store.get(id)
  }

  async toggle(id: string, isActive: boolean): Promise<void> {
    await this.store.update(id, { isActive, updatedAt: Date.now() })
  }

  async remove(id: string): Promise<void> {
    await this.store.delete(id)
  }

  async run(macroId: string, input: Record<string, unknown>): Promise<MacroRunResult> {
    const macro = await this.store.get(macroId)
    if (!macro) {
      return { macroId, ok: false, error: `Macro not found: ${macroId}` }
    }

    if (!macro.isActive) {
      return { macroId, ok: false, error: `Macro is inactive: ${macroId}` }
    }

    try {
      const result = await this.runtime.executeDag(macro.dagJson, input)
      return {
        macroId,
        ok: result.ok,
        output: result.output,
        error: result.error,
      }
    } catch (err: unknown) {
      return {
        macroId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
