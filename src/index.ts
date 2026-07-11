// src/index.ts
// vivim-final — public re-exports

export const VERSION = '1.0.0'
export * from './errors.js'
export * from './ids.js'

// Schema barrel
export * from './schema/index.js'

// Engines
export { CapabilityEventBus } from './engines/capability-event-bus.js'
export { ChromeGovernor } from './engines/chrome-governor.js'
export { ConversationManager } from './engines/conversation-manager.js'
export { StreamParserEngine } from './engines/stream-parser.js'
export { CapabilityEngine } from './engines/capability.js'
export { ProviderRegistrar } from './engines/provider-registrar.js'
export { CapabilityResolutionEngine } from './engines/capability-resolution.js'
export { ProviderHealthKernel } from './engines/provider-health.js'
export { StreamBlockStore } from './engines/stream-block-store.js'
export { RegistrationAuditor } from './engines/registration-auditor.js'
export { VersionManager } from './engines/version-manager.js'
export { TelemetryAggregator } from './engines/telemetry-aggregator.js'
export { ConfigManager } from './engines/config-manager.js'
export { ExecutionMemoizer } from './engines/execution-memoizer.js'
export { HarnessRuntime } from './engines/harness-runtime.js'
export { HarnessCheckpointEngine } from './engines/harness-checkpoint.js'
export { CapabilityMacroEngine } from './engines/capability-macro.js'
export { SessionCheckpointEngine } from './engines/session-checkpoint.js'
export { StateTransitionEngine } from './engines/state-transition.js'
export { MemoryEngine } from './engines/memory-engine.js'

// Executor
export { AsyncMutex } from './executor/async-mutex.js'
export { CircuitBreaker } from './executor/circuit-breaker.js'
export type { FleetConfig } from './executor/fleet-config.js'
export type { ContentBlock } from './executor/content-blocks.js'
export { deriveId, deriveSlaveId } from './executor/ids.js'

// Alerting
export { Alerter } from './alerting/alerter.js'

// Automation
export { AutomationScheduler } from './automation/scheduler.js'

// Router
export { Router } from './router/router.js'
