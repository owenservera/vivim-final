// src/domain/index.ts
// Barrel exports for Domain Layer.
// Phase 2: Domain Layer isolates business logic from runtime mechanics.

export { SlaveStateStore } from './slave-state-store.js'
export type {
  AccountId,
  BrowserEndpoint,
  Capability,
  ConversationId,
  Lease,
  LeaseId,
  Provider,
  ProviderId,
  ResourceRequirements,
  Slave,
  SlaveId,
} from './types.js'
export {
  createAccountId,
  createConversationId,
  createLeaseId,
  createProviderId,
  createSlaveId,
} from './types.js'
