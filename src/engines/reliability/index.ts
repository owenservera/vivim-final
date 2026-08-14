// src/engines/reliability/index.ts
// Barrel exports for Reliability subsystem.
// Phase 9: Failure-class-specific recovery with event store.

export type { ClassificationResult } from './classifier.js'
export { classifyFailure } from './classifier.js'
export type { EventStoreBackend, EventStoreEntry } from './event-store.js'
export { InMemoryEventStore } from './event-store.js'
export type { RecoveryAttempt } from './recovery-orchestrator.js'
export { RecoveryOrchestrator } from './recovery-orchestrator.js'
export type { RecoveryContext, StrategyResult } from './strategies.js'
export { executeRecovery } from './strategies.js'
