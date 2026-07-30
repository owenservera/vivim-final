// src/domain/index.ts
// Barrel exports for Domain Layer.
// Phase 2: Domain Layer isolates business logic from runtime mechanics.

export type {
  SlaveId,
  ProviderId,
  AccountId,
  LeaseId,
  ConversationId,
  Slave,
  Lease,
  Provider,
  Capability,
  BrowserEndpoint,
  ResourceRequirements,
} from './types.js'

export {
  createSlaveId,
  createProviderId,
  createAccountId,
  createLeaseId,
  createConversationId,
} from './types.js'

export { SlaveStateStore } from './slave-state-store.js'
