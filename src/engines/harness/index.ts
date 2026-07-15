// src/engines/harness/index.ts
// Unit 25.4 - v14 verification / composition root.
// Wires the cap-store-proven harness onto vivim-final's governor-gated,
// registry-backed architecture. This is the single place that assembles the
// HarnessExecutorEngine from injected deps so engines depend only on contracts.

import type { CapabilityStore } from '../../storage/contracts/capability-store.js'
import type { ProgramStore, Recipe } from '../../storage/contracts/program-store.js'
import type { StreamBlockStoreContract } from '../../storage/contracts/stream-block-store.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import { programToCapability } from '../cdp-capability-registrar.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import { CapabilityProgramRegistrar } from './capability-program-registrar.js'
import { createGovernorSlaveResolver } from './fleet-lifecycle-adapter.js'
import type { HarnessExecutorDeps } from './harness-contract.js'
import { HarnessExecutorEngine } from './harness-executor-engine.js'

export interface HarnessComposition {
  executor: HarnessExecutorEngine
  registrar: CapabilityProgramRegistrar
}

export interface ComposeHarnessDeps {
  governor: ChromeGovernor
  capabilityStore: CapabilityStore
  programStore: ProgramStore
  blockStore: StreamBlockStoreContract
  eventBus: CapabilityEventBus
  /** Optional registry to auto-publish seeded programs as capabilities (One Entry Point). */
  registry?: UnifiedCapabilityRegistry
  defaultTimeoutMs?: number
}

/** Assemble the harness from injected deps (Store Contracts, Governor Canon intact). */
export function composeHarness(deps: ComposeHarnessDeps): HarnessComposition {
  const executorDeps: HarnessExecutorDeps = {
    governor: deps.governor,
    programStore: deps.programStore,
    store: deps.capabilityStore,
    blockStore: deps.blockStore,
    eventBus: deps.eventBus,
    slaveResolver: createGovernorSlaveResolver(deps.governor),
    defaultTimeoutMs: deps.defaultTimeoutMs ?? 30_000,
  }
  const executor = new HarnessExecutorEngine(executorDeps)
  const registrar = new CapabilityProgramRegistrar({
    programStore: deps.programStore,
    registry: deps.registry,
  })
  return { executor, registrar }
}

/**
 * Seed recipes and (optionally) publish each as a UnifiedCapability so the
 * program is reachable through all surfaces (One Entry Point). Returns the
 * published capabilities and their program ids.
 */
export async function seedAndPublish(
  composition: HarnessComposition,
  recipes: Recipe[],
  registry?: UnifiedCapabilityRegistry,
): Promise<Array<{ recipeId: string; programId: string; capabilityId: string }>> {
  const reg = registry ?? composition.registrar.registry
  const seeded = await composition.registrar.seedAll(recipes)
  const out: Array<{ recipeId: string; programId: string; capabilityId: string }> = []
  for (const s of seeded) {
    const program = await composition.registrar.programStore.getProgramById(s.programId)
    let capabilityId = ''
    if (program && reg) {
      const cap = programToCapability(program, { executor: composition.executor })
      reg.register(cap)
      capabilityId = cap.id
    }
    out.push({ recipeId: s.recipeId, programId: s.programId, capabilityId })
  }
  return out
}
