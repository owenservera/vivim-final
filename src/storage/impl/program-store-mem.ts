// src/storage/impl/program-store-mem.ts
// Unit 22.2 - In-memory ProgramStore implementation.
// Satisfies the ProgramStore contract without touching Prisma (the binding<->program
// link is intentionally not on the canonical binding row). Swap for a Prisma impl
// when persistence is required; engines depend only on the contract.

import { recipeToConfig } from '../../engines/harness/program-schema.js'
import { ulid } from '../../ids.js'
import type { CapabilityProgramRow } from '../contracts/capability-store.js'
import type { ProgramStore, ProgramUpsert } from '../contracts/program-store.js'

export class MemoryProgramStore implements ProgramStore {
  private readonly programs = new Map<string, CapabilityProgramRow>()
  private readonly byBinding = new Map<string, Map<number, string>>()
  private readonly best = new Map<string, string>()
  private readonly byCapability = new Map<string, string>() // `${slug}:${providerId}` -> programId

  async upsertProgram(input: ProgramUpsert): Promise<CapabilityProgramRow> {
    const id = ulid()
    const now = Date.now()
    const row: CapabilityProgramRow = {
      id,
      bindingId: input.bindingId,
      version: input.version,
      status: input.status,
      configJson: recipeToConfig(input.recipe),
      createdAt: now,
      updatedAt: now,
    }
    this.programs.set(id, row)
    const bindingMap = this.byBinding.get(input.bindingId) ?? new Map<number, string>()
    bindingMap.set(input.version, id)
    this.byBinding.set(input.bindingId, bindingMap)
    this.byCapability.set(`${input.recipe.capabilitySlug}:${input.recipe.providerId}`, id)
    return row
  }

  async getProgramById(programId: string): Promise<CapabilityProgramRow | null> {
    return this.programs.get(programId) ?? null
  }

  async getPrograms(bindingId: string): Promise<CapabilityProgramRow[]> {
    const m = this.byBinding.get(bindingId)
    if (!m) return []
    return [...m.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, id]) => this.programs.get(id))
      .filter((r): r is CapabilityProgramRow => r !== undefined)
  }

  async getBestProgram(bindingId: string): Promise<CapabilityProgramRow | null> {
    const id = this.best.get(bindingId)
    return id ? (this.programs.get(id) ?? null) : null
  }

  async setBestProgram(bindingId: string, programId: string): Promise<void> {
    this.best.set(bindingId, programId)
  }

  async getBestProgramByCapability(
    capabilitySlug: string,
    providerId: string,
  ): Promise<CapabilityProgramRow | null> {
    const id = this.byCapability.get(`${capabilitySlug}:${providerId}`)
    return id ? (this.programs.get(id) ?? null) : null
  }
}
