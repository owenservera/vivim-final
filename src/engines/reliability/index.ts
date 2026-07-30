// src/engines/reliability/index.ts
// Barrel exports for Reliability subsystem.
// Phase 9: Failure-class-specific recovery with event store.

export { classifyFailure } from './classifier.js'
export { executeRecovery } from './strategies.js'
export { RecoveryOrchestrator } from './recovery-orchestrator.js'
export { InMemoryEventStore } from './event-store.js'
export type { ClassificationResult } from './classifier.js'
export type { StrategyResult, RecoveryContext } from './strategies.js'
export type { RecoveryAttempt } from './recovery-orchestrator.js'
export type { EventStoreEntry, EventStoreBackend } from './event-store.js'
