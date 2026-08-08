import type { ProfileAllocator } from '../../executor/profile-allocator.js'
import type { ConversationStore } from '../../storage/contracts/conversation-store.js'
import type { LocalAgentStore } from '../../storage/contracts/local-agent-store.js'
import type { CapStoreDb } from '../../storage/db.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { ConversationManager } from '../conversation-manager.js'
import type { CrossConversationSynthesizer } from '../cross-conversation-synthesis.js'
import type { KnowledgeIngestionEngine } from '../knowledge-ingestion.js'
import type { LocalAgentProviderExecutor } from '../local-agent/local-agent-executor.js'
import type { OpenCodeModelSync } from '../local-agent/opencode-model-sync.js'
import type { MemoryEngine } from '../memory-engine.js'
import type { OpenCodeClient } from '../opencode/opencode-client.js'
import type { OpenCodeIngest } from '../opencode/opencode-ingest.js'
import type { SemanticSearchEngine } from '../semantic-search.js'
import type { StorageRelocationEngine } from '../storage-relocation-engine.js'
import type { CapabilitySurface, UnifiedCapability } from '../unified-registry.js'

export interface BootstrapServices {
  db: CapStoreDb
  conversationStore: ConversationStore
  governor: ChromeGovernor
  conversationManager: ConversationManager
  profileAllocator: ProfileAllocator
  memoryEngine?: MemoryEngine
  semanticSearch?: SemanticSearchEngine
  knowledgeIngestion?: KnowledgeIngestionEngine
  synthesizer?: CrossConversationSynthesizer
  localAgentStore?: LocalAgentStore
  localAgentExecutor?: LocalAgentProviderExecutor
  opencodeModelSync?: OpenCodeModelSync
  opencodeClient?: OpenCodeClient
  opencodeIngest?: OpenCodeIngest
  relocationEngine?: StorageRelocationEngine
}

export const ALL_SURFACES: CapabilitySurface[] = ['cli', 'ui', 'workflow', 'mcp', 'api']

export function makeCapability(
  partial: Omit<
    UnifiedCapability,
    'isAsync' | 'requiresConfirmation' | 'tags' | 'surfaces' | 'handler'
  > & {
    surfaces?: CapabilitySurface[]
    requiresConfirmation?: boolean
  },
  handler: UnifiedCapability['handler'],
): UnifiedCapability {
  return {
    ...partial,
    surfaces: partial.surfaces ?? ALL_SURFACES,
    handler,
    isAsync: true,
    requiresConfirmation: partial.requiresConfirmation ?? false,
    tags: [],
  }
}

/**
 * Register the default capabilities every vivim instance has.
 * Handlers are Option-A closures over `services`; stubs here return safe defaults
 * and are fleshed out by later phases. Called once after the registry is constructed.
 */
