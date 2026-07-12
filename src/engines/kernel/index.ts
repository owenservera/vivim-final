// src/engines/kernel/index.ts
// Kernel barrel — the self-understanding layer.

export { KernelRegistry } from './kernel-registry.js'
export { KernelTracer } from './kernel-tracer.js'
export { KernelProvenance, type ProvenanceChain } from './kernel-provenance.js'
export {
  createKernel,
  KernelImpl,
  ConsoleKernelLogger,
  type Kernel,
  type KernelContext,
  type KernelLogger,
} from './kernel-context.js'
export { bootstrapKernel, type KernelBootstrapDeps } from './kernel-bootstrap.js'

// ── Kernel Oracle (Phase 15) ───────────────────────────────────────────────
export {
  OracleQueryEngine,
  type SystemQuery,
  type QueryResult,
  type TopologyDescription,
  type HealthSnapshot,
  type Explanation,
  type CapabilitySummary,
  type SystemQueryType,
} from './oracle-query.js'
export {
  OracleDiagnosticEngine,
  type DiagnosticIssue,
  type DiagnosticSeverity,
  type DiagnosticCategory,
} from './oracle-diagnostic.js'
export {
  OracleActuator,
  type HealAction,
  type HealKind,
  type AutoHealPolicy,
} from './oracle-actuator.js'
export {
  OracleEventStream,
  type OracleEvent,
  type OracleEventKind,
} from './oracle-event-stream.js'
