// src/server/bootstrap/orchestrator.ts
// The boot-ORDER pipeline. This file IS the dependency graph: the phase list
// here dictates exactly what order engines/stores are created, mirroring the
// original single-mega-function in bootstrap-engines.ts but now as named,
// individually-testable stages. Adding a new boot stage = add a phase module
// that writes to BootstrapContext and append it here.
//
// Stage order (must match the original sequencing):
//   seeds         seeds.ts       — DB scaffolding + snapshot/individual seeds + provider registry
//   stores        stores.ts      — store impls + parsing/memory + governor + CDP + conversation manager
//   knowledge     knowledge.ts   — OPTIONAL: knowledge/export/mux/cost engines
//   capabilities  capabilities.ts— OPTIONAL-but-central: registry + all cap sets + MCP + memory fabric
//   lifecycle     lifecycle.ts   — NLCL + kernel + health kernel + reliability engines + router stores

import { UnifiedCapabilityRegistry } from '../../engines/unified-registry.js'
import { getLogger } from '../../lib/logger.js'
import type { BootstrapContext, BootstrapEnginesResult } from './context.js'
import { createBootstrapContext } from './context.js'
import { bootstrapCapabilitiesPhase } from './phases/capabilities.js'
import { bootstrapKnowledgePhase } from './phases/knowledge.js'
import { bootstrapLifecyclePhase } from './phases/lifecycle.js'
import { bootstrapSeedsPhase } from './phases/seeds.js'
import { bootstrapStoresPhase } from './phases/stores.js'

const log = getLogger('bootstrap:orchestrator')

/** Resolve the mutable context into the fixed public result shape. */
function resolveResult(ctx: BootstrapContext): BootstrapEnginesResult {
  // The original code validated nothing here — every field these constructors
  // return was guaranteed by phase ordering. Preserve that contract exactly.
  return {
    db: ctx.db!,
    eventBus: ctx.eventBus!,
    convStore: ctx.convStore!,
    governor: ctx.governor!,
    conversationManager: ctx.conversationManager!,
    resolutionEngine: ctx.resolutionEngine!,
    parserEngine: ctx.parserEngine!,
    streamBlocks: ctx.streamBlocks!,
    memoryEngine: ctx.memoryEngine!,
    memoryFabric: ctx.memoryFabric,
    agentBuilder: ctx.agentBuilder,
    knowledgeIngestion: ctx.knowledgeIngestion,
    semanticSearch: ctx.semanticSearch,
    synthesizer: ctx.synthesizer,
    exportEngine: ctx.exportEngine,
    providerMux: ctx.providerMux,
    costOptimizer: ctx.costOptimizer,
    autonomousEngine: ctx.autonomousEngine,
    policyEngine: ctx.policyEngine,
    registry: ctx.registry ?? new UnifiedCapabilityRegistry(),
    nlclEngine: ctx.nlclEngine!,
    automationOrchestrator: ctx.automationOrchestrator!,
    kernel: ctx.kernel!,
    healthKernel: ctx.healthKernel!,
    lockManager: ctx.lockManager!,
    idempotencyGuard: ctx.idempotencyGuard!,
    retryEngine: ctx.retryEngine!,
    conceptualModel: ctx.conceptualModel,
    userIdentity: ctx.userIdentity,
    relocationEngine: ctx.relocationEngine,
    nodeStore: ctx.nodeStore!,
    containerStore: ctx.containerStore!,
    contentStore: ctx.contentStore!,
    notificationStore: ctx.notificationStore!,
    contactStore: ctx.contactStore!,
    syncStore: ctx.syncStore!,
    mediaStore: ctx.mediaStore!,
    collectionEngine: ctx.collectionEngine,
    lifecycleEngine: ctx.lifecycleEngine,
    compactionManager: ctx.compactionManager,
    backupManager: ctx.backupManager,
  }
}

/**
 * Run the full boot pipeline in dependency order. Phase modules read what they
 * need off `ctx` and write what they create; a missing dependency surfaces as
 * a clear non-null assertion error at the exact phase boundary rather than a
 * deep, opaque error deep inside a 1000-line function.
 */
export async function orchestrateBootstrap(port: number): Promise<BootstrapEnginesResult> {
  const ctx = createBootstrapContext(port)

  await bootstrapSeedsPhase(ctx)
  await bootstrapStoresPhase(ctx)
  await bootstrapKnowledgePhase(ctx)
  await bootstrapCapabilitiesPhase(ctx)
  await bootstrapLifecyclePhase(ctx)

  const result = resolveResult(ctx)
  log.info('[boot] bootstrap pipeline complete')
  return result
}
