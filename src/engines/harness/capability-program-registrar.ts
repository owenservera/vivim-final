// src/engines/harness/capability-program-registrar.ts
// Unit 22.3 - Capability program registrar.
// Seeds recipes into programs and marks the best one per binding (cap-store
// "bind recipe -> promote"). Also auto-registers a UnifiedCapability so the
// program is reachable through the One Entry Point (22.4 wires the capability).

import type { ProgramStore, Recipe } from '../../storage/contracts/program-store.js'
import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import { PROGRAM_STATUS } from './program-schema.js'

export interface ProgramRegistrarDeps {
  programStore: ProgramStore
  registry?: UnifiedCapabilityRegistry
}

export class CapabilityProgramRegistrar {
  constructor(private readonly deps: ProgramRegistrarDeps) {}

  /**
   * Seed a recipe into a candidate program and promote it to the best program.
   * The binding<->program link is owned by ProgramStore (22.4) and resolved by
   * capability slug + provider — CapabilityStore bindings are read-only here.
   */
  async register(recipe: Recipe): Promise<{ programId: string; bindingId: string }> {
    const { programStore } = this.deps
    const bindingId = `binding:${recipe.capabilitySlug}:${recipe.providerId}`
    const existing = await programStore.getPrograms(bindingId)
    const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map((p) => p.version)) + 1

    const program = await programStore.upsertProgram({
      bindingId,
      version: nextVersion,
      status: PROGRAM_STATUS.CANDIDATE,
      recipe,
    })
    await programStore.setBestProgram(bindingId, program.id)
    return { programId: program.id, bindingId }
  }

  /** Seed many recipes (used by `seedAll`). */
  async seedAll(
    recipes: Recipe[],
  ): Promise<Array<{ recipeId: string; programId: string; bindingId: string }>> {
    const out: Array<{ recipeId: string; programId: string; bindingId: string }> = []
    for (const r of recipes) {
      const res = await this.register(r)
      out.push({ recipeId: r.id, ...res })
    }
    return out
  }

  /** Public accessor for the program store (used by the composition root). */
  get programStore(): ProgramStore {
    return this.deps.programStore
  }

  /** Public accessor for the optional registry. */
  get registry(): UnifiedCapabilityRegistry | undefined {
    return this.deps.registry
  }
}
