import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import { seedLocalAgentProvider } from './seed.js'
import type { BootstrapServices } from './types.js'
import {
  buildAdminCaps,
  buildAgentCaps,
  buildAiGatewayCaps,
  buildConversationCaps,
  buildKnowledgeCaps,
  buildMemoryCaps,
  buildOpenCodeModelSyncCaps,
  buildOpenCodeServeCaps,
  buildProviderHealthCaps,
  buildStorageCaps,
  buildSystemCaps,
  buildTelemetryCaps,
} from './default-caps.js'

/**
 * Registers all default unified capabilities into the registry.
 *
 * The capability definitions live in `./default-caps.js`, grouped by domain
 * into builder functions (buildConversationCaps, buildStorageCaps, ...). This
 * function is a thin orchestrator that wires them together and preserves the
 * original registration order: storage + AI-gateway caps are registered first
 * (directly, as in the original), followed by the bulk `defaults` array.
 */
export async function registerDefaultCapabilities(
  registry: UnifiedCapabilityRegistry,
  services: BootstrapServices,
): Promise<void> {
  // Seed the local-agent provider manifest (idempotent) so cap:agent:run can dispatch.
  if (services.localAgentStore && services.localAgentExecutor) {
    await seedLocalAgentProvider(services.localAgentStore)
  }

  // Storage + AI Gateway were registered directly in the original; preserve that.
  for (const cap of buildStorageCaps(services)) registry.register(cap)
  for (const cap of buildAiGatewayCaps(services)) registry.register(cap)

  const defaults = [
    ...buildConversationCaps(services),
    ...buildKnowledgeCaps(services),
    ...buildMemoryCaps(services),
    ...buildAdminCaps(services),
    ...buildSystemCaps(services),
    ...buildProviderHealthCaps(services),
    ...buildTelemetryCaps(services),
    ...buildAgentCaps(services),
    ...buildOpenCodeServeCaps(services),
    ...buildOpenCodeModelSyncCaps(services),
  ]

  for (const cap of defaults) {
    registry.register(cap)
  }
}
