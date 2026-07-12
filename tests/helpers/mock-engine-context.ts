// tests/helpers/mock-engine-context.ts
// Canonical mock engine context for integration and unit tests.
import { CapabilityEventBus } from '../../src/engines/capability-event-bus.js'
import { createMockConversationStore } from './mocks/conversation-store.mock.js'
import { createMockCapabilityStore } from './mocks/capability-store.mock.js'
import { createMockGovernorStore } from './mocks/governor-store.mock.js'
import { createMockRegistrationStore } from './mocks/registration-store.mock.js'
import { createMockHealthStore } from './mocks/health-store.mock.js'
import { createMockVersionStore } from './mocks/version-store.mock.js'
import { createMockConfigStore } from './mocks/config-store.mock.js'
import { createMockStreamBlockStore } from './mocks/stream-block-store.mock.js'
import { createMockParserStore } from './mocks/parser-store.mock.js'
import { createMockRouterStore } from './mocks/router-store.mock.js'
import { createMockDiscoveryStore } from './mocks/discovery-store.mock.js'

export interface MockEngineContext {
  eventBus: CapabilityEventBus
  stores: {
    conversation: ReturnType<typeof createMockConversationStore>
    capability: ReturnType<typeof createMockCapabilityStore>
    governor: ReturnType<typeof createMockGovernorStore>
    registration: ReturnType<typeof createMockRegistrationStore>
    health: ReturnType<typeof createMockHealthStore>
    version: ReturnType<typeof createMockVersionStore>
    config: ReturnType<typeof createMockConfigStore>
    streamBlock: ReturnType<typeof createMockStreamBlockStore>
    parser: ReturnType<typeof createMockParserStore>
    router: ReturnType<typeof createMockRouterStore>
    discovery: ReturnType<typeof createMockDiscoveryStore>
  }
}

export function createMockEngineContext(): MockEngineContext {
  CapabilityEventBus.resetInstance()
  const eventBus = CapabilityEventBus.getInstance()

  return {
    eventBus,
    stores: {
      conversation: createMockConversationStore(),
      capability: createMockCapabilityStore(),
      governor: createMockGovernorStore(),
      registration: createMockRegistrationStore(),
      health: createMockHealthStore(),
      version: createMockVersionStore(),
      config: createMockConfigStore(),
      streamBlock: createMockStreamBlockStore(),
      parser: createMockParserStore(),
      router: createMockRouterStore(),
      discovery: createMockDiscoveryStore(),
    },
  }
}